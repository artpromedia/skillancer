/**
 * CloudWatch to PagerDuty Forwarder Lambda
 *
 * Receives CloudWatch alarm events via SNS and forwards them to PagerDuty Events API v2
 */

const https = require('https');

// Environment variables
const PAGERDUTY_ROUTING_KEY = process.env.PAGERDUTY_ROUTING_KEY;
const ENVIRONMENT = process.env.ENVIRONMENT || 'production';
const PROJECT = process.env.PROJECT || 'skillancer';
const SOURCE_PREFIX = process.env.SOURCE_PREFIX || 'aws';

// PagerDuty Events API v2 endpoint
const PAGERDUTY_HOST = 'events.pagerduty.com';
const PAGERDUTY_PATH = '/v2/enqueue';

// Severity mapping based on alarm name patterns
const SEVERITY_RULES = [
  { pattern: /critical/i, severity: 'critical' },
  { pattern: /production.*down/i, severity: 'critical' },
  { pattern: /database.*connection/i, severity: 'critical' },
  { pattern: /high.*error.*rate/i, severity: 'critical' },
  { pattern: /availability/i, severity: 'critical' },
  { pattern: /error/i, severity: 'error' },
  { pattern: /5xx/i, severity: 'error' },
  { pattern: /failed/i, severity: 'error' },
  { pattern: /warning/i, severity: 'warning' },
  { pattern: /high.*cpu/i, severity: 'warning' },
  { pattern: /high.*memory/i, severity: 'warning' },
  { pattern: /4xx/i, severity: 'warning' },
  { pattern: /latency/i, severity: 'warning' },
];

// Namespace to component mapping
const NAMESPACE_COMPONENT_MAP = {
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

/**
 * Determine severity from alarm name
 */
function determineSeverity(alarmName) {
  for (const rule of SEVERITY_RULES) {
    if (rule.pattern.test(alarmName)) {
      return rule.severity;
    }
  }
  return 'error'; // Default
}

/**
 * Map namespace to component
 */
function mapComponent(namespace) {
  return NAMESPACE_COMPONENT_MAP[namespace] || namespace.toLowerCase().replace(/[^a-z0-9]/gi, '-');
}

/**
 * Map namespace to group
 */
function mapGroup(namespace) {
  if (namespace.startsWith('AWS/')) return 'infrastructure';
  if (namespace.startsWith('Skillancer/')) return 'application';
  return 'custom';
}

/**
 * Create a deduplication key
 */
function createDedupKey(alarmName) {
  return `cloudwatch-${alarmName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

/**
 * Make HTTPS request to PagerDuty
 */
function sendToPagerDuty(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: PAGERDUTY_HOST,
      port: 443,
      path: PAGERDUTY_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`PagerDuty returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Process CloudWatch alarm and send to PagerDuty
 */
async function processAlarm(alarm) {
  const dedupKey = createDedupKey(alarm.AlarmName);
  const severity = determineSeverity(alarm.AlarmName);
  const component = mapComponent(alarm.Trigger?.Namespace || 'unknown');
  const group = mapGroup(alarm.Trigger?.Namespace || 'unknown');

  if (alarm.NewStateValue === 'ALARM') {
    // Trigger alert
    const payload = {
      routing_key: PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      dedup_key: dedupKey,
      payload: {
        summary: `[${ENVIRONMENT}] ${alarm.AlarmName}: ${alarm.NewStateReason}`.slice(0, 1024),
        severity,
        source: `${SOURCE_PREFIX}:${alarm.Region}`,
        component,
        group,
        class: 'cloudwatch-alarm',
        timestamp: alarm.StateChangeTime || new Date().toISOString(),
        custom_details: {
          alarm_name: alarm.AlarmName,
          alarm_description: alarm.AlarmDescription,
          reason: alarm.NewStateReason,
          previous_state: alarm.OldStateValue,
          metric_name: alarm.Trigger?.MetricName,
          namespace: alarm.Trigger?.Namespace,
          threshold: alarm.Trigger?.Threshold,
          comparison: alarm.Trigger?.ComparisonOperator,
          evaluation_periods: alarm.Trigger?.EvaluationPeriods,
          period: alarm.Trigger?.Period,
          statistic: alarm.Trigger?.Statistic,
          dimensions: alarm.Trigger?.Dimensions,
          account_id: alarm.AWSAccountId,
          region: alarm.Region,
          environment: ENVIRONMENT,
          project: PROJECT,
        },
      },
      links: [
        {
          href: `https://${alarm.Region}.console.aws.amazon.com/cloudwatch/home?region=${alarm.Region}#alarmsV2:alarm/${encodeURIComponent(alarm.AlarmName)}`,
          text: 'View in CloudWatch',
        },
      ],
    };

    console.log('Triggering PagerDuty alert:', alarm.AlarmName);
    return sendToPagerDuty(payload);
  } else if (alarm.NewStateValue === 'OK') {
    // Resolve alert
    const payload = {
      routing_key: PAGERDUTY_ROUTING_KEY,
      event_action: 'resolve',
      dedup_key: dedupKey,
    };

    console.log('Resolving PagerDuty alert:', alarm.AlarmName);
    return sendToPagerDuty(payload);
  }

  // INSUFFICIENT_DATA - do nothing
  console.log('Ignoring INSUFFICIENT_DATA state for:', alarm.AlarmName);
  return null;
}

/**
 * Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (!PAGERDUTY_ROUTING_KEY) {
    console.error('PAGERDUTY_ROUTING_KEY environment variable not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing PagerDuty configuration' }),
    };
  }

  const results = [];

  // Process each SNS record
  for (const record of event.Records || []) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const result = await processAlarm(message);
      results.push({ alarmName: message.AlarmName, result });
    } catch (error) {
      console.error('Failed to process record:', error);
      results.push({ error: error.message });
    }
  }

  console.log('Processing complete:', results);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Processed successfully',
      results,
      requestId: context.awsRequestId,
    }),
  };
};
