/**
 * CloudWatch Alarm integration for PagerDuty
 *
 * Handles CloudWatch alarm events and forwards them to PagerDuty
 */

import { triggerAlert, resolveAlert, createDedupKey, type AlertPayload } from './pagerduty';

// =============================================================================
// CloudWatch Alarm Event Types
// =============================================================================

export interface CloudWatchAlarmEvent {
  AlarmName: string;
  AlarmDescription?: string;
  AWSAccountId: string;
  NewStateValue: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  NewStateReason: string;
  StateChangeTime: string;
  Region: string;
  AlarmArn?: string;
  OldStateValue: 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';
  Trigger: {
    MetricName: string;
    Namespace: string;
    StatisticType?: string;
    Statistic?: string;
    Unit?: string;
    Dimensions?: Array<{ name: string; value: string }>;
    Period: number;
    EvaluationPeriods: number;
    DatapointsToAlarm?: number;
    ComparisonOperator: string;
    Threshold: number;
    TreatMissingData?: string;
    EvaluateLowSampleCountPercentile?: string;
  };
}

export interface SNSEvent {
  Records: Array<{
    EventSource: string;
    EventVersion: string;
    EventSubscriptionArn: string;
    Sns: {
      Type: string;
      MessageId: string;
      TopicArn: string;
      Subject?: string;
      Message: string;
      Timestamp: string;
      SignatureVersion: string;
      Signature: string;
      SigningCertUrl: string;
      UnsubscribeUrl: string;
      MessageAttributes?: Record<string, { Type: string; Value: string }>;
    };
  }>;
}

// =============================================================================
// Alarm Severity Mapping
// =============================================================================

interface AlarmSeverityRule {
  pattern: RegExp | string;
  severity: AlertPayload['severity'];
}

const DEFAULT_SEVERITY_RULES: AlarmSeverityRule[] = [
  // Critical alarms
  { pattern: /critical/i, severity: 'critical' },
  { pattern: /production.*down/i, severity: 'critical' },
  { pattern: /database.*connection/i, severity: 'critical' },
  { pattern: /high.*error.*rate/i, severity: 'critical' },
  { pattern: /availability/i, severity: 'critical' },

  // Error alarms
  { pattern: /error/i, severity: 'error' },
  { pattern: /5xx/i, severity: 'error' },
  { pattern: /failed/i, severity: 'error' },

  // Warning alarms
  { pattern: /warning/i, severity: 'warning' },
  { pattern: /high.*cpu/i, severity: 'warning' },
  { pattern: /high.*memory/i, severity: 'warning' },
  { pattern: /4xx/i, severity: 'warning' },
  { pattern: /latency/i, severity: 'warning' },
];

/**
 * Determine alert severity based on alarm name and rules
 */
export function determineSeverity(
  alarmName: string,
  rules: AlarmSeverityRule[] = DEFAULT_SEVERITY_RULES
): AlertPayload['severity'] {
  for (const rule of rules) {
    if (typeof rule.pattern === 'string') {
      if (alarmName.toLowerCase().includes(rule.pattern.toLowerCase())) {
        return rule.severity;
      }
    } else if (rule.pattern.test(alarmName)) {
      return rule.severity;
    }
  }
  return 'error'; // Default to error
}

/**
 * Map CloudWatch namespace to component name
 */
export function mapNamespaceToComponent(namespace: string): string {
  const mappings: Record<string, string> = {
    'AWS/EC2': 'compute',
    'AWS/ECS': 'containers',
    'AWS/RDS': 'database',
    'AWS/ElastiCache': 'cache',
    'AWS/ApplicationELB': 'load-balancer',
    'AWS/NetworkELB': 'load-balancer',
    'AWS/Lambda': 'serverless',
    'AWS/SQS': 'messaging',
    'AWS/SNS': 'messaging',
    'AWS/S3': 'storage',
    'AWS/CloudFront': 'cdn',
    'AWS/ApiGateway': 'api-gateway',
    'Skillancer/Application': 'application',
    'Skillancer/Business': 'business',
  };

  return mappings[namespace] || namespace.toLowerCase().replace(/[^a-z0-9]/gi, '-');
}

/**
 * Map CloudWatch namespace to group name
 */
export function mapNamespaceToGroup(namespace: string): string {
  if (namespace.startsWith('AWS/')) {
    return 'infrastructure';
  }
  if (namespace.startsWith('Skillancer/')) {
    return 'application';
  }
  return 'custom';
}

// =============================================================================
// CloudWatch Alarm Handler
// =============================================================================

export interface HandleCloudWatchAlarmOptions {
  /** Custom severity rules */
  severityRules?: AlarmSeverityRule[];
  /** Environment name */
  environment?: string;
  /** Custom source prefix */
  sourcePrefix?: string;
  /** Additional custom details to include */
  additionalDetails?: Record<string, unknown>;
}

/**
 * Handle a CloudWatch alarm event and forward to PagerDuty
 */
export async function handleCloudWatchAlarm(
  alarmEvent: CloudWatchAlarmEvent,
  options: HandleCloudWatchAlarmOptions = {}
): Promise<void> {
  const dedupKey = createDedupKey(['cloudwatch', alarmEvent.AlarmName]);
  const severity = determineSeverity(alarmEvent.AlarmName, options.severityRules);
  const component = mapNamespaceToComponent(alarmEvent.Trigger.Namespace);
  const group = mapNamespaceToGroup(alarmEvent.Trigger.Namespace);

  if (alarmEvent.NewStateValue === 'ALARM') {
    // Trigger alert
    const summary = `[${options.environment || 'prod'}] ${alarmEvent.AlarmName}: ${alarmEvent.NewStateReason}`;

    await triggerAlert({
      summary,
      severity,
      source: `${options.sourcePrefix || 'aws'}:${alarmEvent.Region}`,
      component,
      group,
      class: 'cloudwatch-alarm',
      dedupKey,
      customDetails: {
        alarmName: alarmEvent.AlarmName,
        alarmDescription: alarmEvent.AlarmDescription,
        reason: alarmEvent.NewStateReason,
        stateChangeTime: alarmEvent.StateChangeTime,
        previousState: alarmEvent.OldStateValue,
        metricName: alarmEvent.Trigger.MetricName,
        namespace: alarmEvent.Trigger.Namespace,
        threshold: alarmEvent.Trigger.Threshold,
        comparisonOperator: alarmEvent.Trigger.ComparisonOperator,
        evaluationPeriods: alarmEvent.Trigger.EvaluationPeriods,
        period: alarmEvent.Trigger.Period,
        statistic: alarmEvent.Trigger.Statistic,
        dimensions: alarmEvent.Trigger.Dimensions,
        accountId: alarmEvent.AWSAccountId,
        region: alarmEvent.Region,
        alarmArn: alarmEvent.AlarmArn,
        environment: options.environment,
        ...options.additionalDetails,
      },
      ...(alarmEvent.AlarmArn
        ? {
            links: [
              {
                href: `https://${alarmEvent.Region}.console.aws.amazon.com/cloudwatch/home?region=${alarmEvent.Region}#alarmsV2:alarm/${encodeURIComponent(alarmEvent.AlarmName)}`,
                text: 'View in CloudWatch',
              },
            ],
          }
        : {}),
    });
  } else if (alarmEvent.NewStateValue === 'OK') {
    // Resolve alert
    await resolveAlert(dedupKey);
  }
  // INSUFFICIENT_DATA state is ignored (neither trigger nor resolve)
}

/**
 * Handle SNS event containing CloudWatch alarm
 */
export async function handleSNSEvent(
  snsEvent: SNSEvent,
  options: HandleCloudWatchAlarmOptions = {}
): Promise<void> {
  for (const record of snsEvent.Records) {
    try {
      const message = JSON.parse(record.Sns.Message) as CloudWatchAlarmEvent;
      await handleCloudWatchAlarm(message, options);
    } catch (error) {
      console.error('Failed to process SNS record:', error);
    }
  }
}

// =============================================================================
// Lambda Handler Export
// =============================================================================

/**
 * Lambda handler for CloudWatch -> SNS -> Lambda -> PagerDuty integration
 */
export async function lambdaHandler(
  event: SNSEvent,
  context?: { functionName?: string; awsRequestId?: string }
): Promise<{ statusCode: number; body: string }> {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    await handleSNSEvent(event, {
      environment: process.env['ENVIRONMENT'] || 'production',
      sourcePrefix: process.env['SOURCE_PREFIX'] || 'aws',
      additionalDetails: {
        lambdaFunction: context?.functionName,
        lambdaRequestId: context?.awsRequestId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Processed successfully' }),
    };
  } catch (error) {
    console.error('Failed to process event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process event' }),
    };
  }
}
