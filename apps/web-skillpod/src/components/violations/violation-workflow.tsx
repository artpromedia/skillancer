/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
'use client';

/**
 * Violation Workflow Component
 *
 * Resolution workflow with action selection, notification preview,
 * approval chain, and audit confirmation.
 *
 * @module components/violations/violation-workflow
 */

import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  AlertOctagon,
  UserX,
  ArrowUpRight,
  Send,
  ChevronDown,
  ChevronUp,
  Eye,
  Mail,
  MessageSquare,
  Shield,
  Clock,
  Lock,
  Check,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

interface Violation {
  id: string;
  type: string;
  subtype?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'investigating' | 'pending_action' | 'resolved' | 'dismissed';
  timestamp: Date;
  userId: string;
  userName: string;
  userEmail: string;
  description: string;
  resolution?: ViolationResolution;
}

interface ViolationResolution {
  action: 'dismissed' | 'warned' | 'acknowledged' | 'suspended' | 'banned' | 'escalated';
  reason: string;
  resolvedBy: string;
  resolvedAt: Date;
}

interface ViolationWorkflowProps {
  violation: Violation;
  onResolve: (action: string, reason: string) => Promise<void>;
}

interface ResolutionAction {
  id: string;
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  color: string;
  bgColor: string;
  borderColor: string;
  requiresApproval: boolean;
  notificationTypes: ('email' | 'inApp' | 'sms')[];
  consequences: string[];
  recommendedFor: string[];
}

// ============================================================================
// Constants
// ============================================================================

const RESOLUTION_ACTIONS: ResolutionAction[] = [
  {
    id: 'dismissed',
    label: 'Dismiss',
    description:
      'Close this violation without taking action. Use for false positives or minor issues.',
    icon: XCircle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    requiresApproval: false,
    notificationTypes: [],
    consequences: ['Violation marked as dismissed', 'No impact on user trust score'],
    recommendedFor: ['False positive', 'Technical glitch', 'Minor one-time issue'],
  },
  {
    id: 'warned',
    label: 'Issue Warning',
    description: 'Send a formal warning to the user. This is recorded in their history.',
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
    requiresApproval: false,
    notificationTypes: ['email', 'inApp'],
    consequences: [
      'Warning added to user record',
      'Trust score reduced by 5-10 points',
      'User notified via email',
    ],
    recommendedFor: [
      'First-time low severity violation',
      'Accidental policy breach',
      'Minor repeat offenses',
    ],
  },
  {
    id: 'acknowledged',
    label: 'Acknowledge & Monitor',
    description: 'Acknowledge the violation and increase monitoring for this user.',
    icon: Eye,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-300 dark:border-blue-700',
    requiresApproval: false,
    notificationTypes: ['inApp'],
    consequences: [
      'Enhanced monitoring enabled',
      'Trust score reduced by 3-5 points',
      'User notified in-app',
    ],
    recommendedFor: ['Suspicious activity', 'Pattern forming', 'User needs closer observation'],
  },
  {
    id: 'suspended',
    label: 'Suspend Session',
    description: "Immediately suspend the user's active session and prevent new sessions.",
    icon: AlertOctagon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-300 dark:border-orange-700',
    requiresApproval: true,
    notificationTypes: ['email', 'inApp', 'sms'],
    consequences: [
      'Active session terminated immediately',
      'New sessions blocked for 24 hours',
      'Trust score reduced by 20-30 points',
      'Incident reported to client',
    ],
    recommendedFor: [
      'High severity violations',
      'Active data exfiltration attempt',
      'Repeated policy breaches',
    ],
  },
  {
    id: 'banned',
    label: 'Ban User',
    description:
      'Permanently ban the user from the platform. This action is severe and reversible only by admins.',
    icon: UserX,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-300 dark:border-red-700',
    requiresApproval: true,
    notificationTypes: ['email', 'inApp', 'sms'],
    consequences: [
      'All sessions terminated immediately',
      'Account permanently banned',
      'All active contracts terminated',
      'Client notified',
      'Legal team alerted',
    ],
    recommendedFor: [
      'Critical security breaches',
      'Malicious activity',
      'Severe policy violations',
      'Legal compliance requirements',
    ],
  },
  {
    id: 'escalated',
    label: 'Escalate',
    description: 'Escalate to a senior security team member or legal for further review.',
    icon: ArrowUpRight,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-300 dark:border-purple-700',
    requiresApproval: false,
    notificationTypes: ['email'],
    consequences: ['Assigned to senior reviewer', 'Priority increased', 'SLA timer started'],
    recommendedFor: [
      'Complex cases requiring review',
      'Legal implications',
      'VIP users',
      'Unclear policy interpretation',
    ],
  },
];

const REASON_TEMPLATES: Record<string, string[]> = {
  dismissed: [
    'False positive - system error',
    'False positive - legitimate user action',
    'Duplicate of existing violation',
    'Insufficient evidence',
  ],
  warned: [
    'First-time violation of screenshot policy',
    'Accidental clipboard usage with sensitive data',
    'Minor policy breach during onboarding',
  ],
  acknowledged: [
    'Suspicious pattern detected - monitoring increased',
    'Multiple low-severity violations - observation required',
  ],
  suspended: [
    'Active data exfiltration attempt detected',
    'Multiple high-severity violations in short period',
    'User bypassed security controls',
  ],
  banned: [
    'Malicious activity confirmed',
    'Severe breach of NDA/contract terms',
    'Legal compliance requirement',
  ],
  escalated: [
    'Requires legal review',
    'Complex case requiring senior input',
    'VIP user - executive decision needed',
  ],
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

// ============================================================================
// Sub-Components
// ============================================================================

function ActionCard({
  action,
  isSelected,
  onSelect,
}: Readonly<{
  action: ResolutionAction;
  isSelected: boolean;
  onSelect: () => void;
}>) {
  const Icon = action.icon;

  return (
    <button
      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
        isSelected
          ? `${action.borderColor} ${action.bgColor}`
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${action.bgColor}`}>
          <Icon className={`h-5 w-5 ${action.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">{action.label}</span>
            {action.requiresApproval && (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                Requires Approval
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{action.description}</p>
        </div>
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>
      </div>
    </button>
  );
}

function ConsequencesPanel({ action }: Readonly<{ action: ResolutionAction }>) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Consequences</h4>
      <ul className="space-y-2">
        {action.consequences.map((consequence) => (
          <li key={consequence} className="flex items-start gap-2 text-sm">
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${action.color}`} />
            <span className="text-gray-600 dark:text-gray-400">{consequence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotificationPreview({
  action,
  violation,
  reason,
}: Readonly<{
  action: ResolutionAction;
  violation: Violation;
  reason: string;
}>) {
  const [expanded, setExpanded] = useState(false);

  if (action.notificationTypes.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        className="flex w-full items-center justify-between p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Notification Preview
          </span>
          <div className="ml-2 flex items-center gap-1">
            {action.notificationTypes.includes('email') && (
              <Mail className="h-4 w-4 text-gray-400" />
            )}
            {action.notificationTypes.includes('inApp') && (
              <MessageSquare className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 pb-4 pt-4 dark:border-gray-700">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-white">
                Security Notification
              </span>
            </div>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              Dear {violation.userName},
            </p>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              {action.id === 'warned' && (
                <>
                  We have detected a policy violation on your account regarding:{' '}
                  <strong>{violation.type.replaceAll('_', ' ')}</strong>. This is a formal warning
                  that has been recorded in your account history.
                </>
              )}
              {action.id === 'suspended' && (
                <>
                  Your session has been suspended due to a security policy violation:{' '}
                  <strong>{violation.type.replaceAll('_', ' ')}</strong>. Please contact support for
                  more information.
                </>
              )}
              {action.id === 'banned' && (
                <>
                  Your account has been permanently banned due to severe policy violations. All
                  active sessions have been terminated. Please contact our legal team for further
                  information.
                </>
              )}
              {action.id === 'acknowledged' && (
                <>
                  We have noticed some activity on your account that requires attention:{' '}
                  <strong>{violation.type.replaceAll('_', ' ')}</strong>. Please review our security
                  policies.
                </>
              )}
            </p>
            {reason && (
              <p className="mb-3 text-sm text-gray-500">
                <em>Reason: {reason}</em>
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Best regards,
              <br />
              The SkillPod Security Team
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalChain({ action }: Readonly<{ action: ResolutionAction }>) {
  if (!action.requiresApproval) {
    return null;
  }

  const approvers = [
    { id: 'security-lead', name: 'Security Lead', status: 'pending' },
    { id: 'platform-admin', name: 'Platform Admin', status: 'pending' },
  ];

  if (action.id === 'banned') {
    approvers.push({ id: 'legal-team', name: 'Legal Team', status: 'pending' });
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
          Approval Required
        </span>
      </div>
      <p className="mb-3 text-sm text-orange-600 dark:text-orange-400">
        This action requires approval from the following:
      </p>
      <div className="space-y-2">
        {approvers.map((approver) => (
          <div key={approver.id} className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-orange-300">
              <Clock className="h-3 w-3 text-orange-400" />
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{approver.name}</span>
            <span className="text-xs text-orange-600 dark:text-orange-400">Pending</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditConfirmation({
  confirmed,
  onChange,
}: Readonly<{
  confirmed: boolean;
  onChange: (confirmed: boolean) => void;
}>) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
      <span className="sr-only">Confirm audit log recording</span>
      <input
        checked={confirmed}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        type="checkbox"
        onChange={(e) => onChange(e.target.checked)}
      />
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          I confirm this action will be recorded in the audit log
        </span>
        <p className="mt-1 text-xs text-gray-500">
          This action, along with your identity and timestamp, will be permanently recorded for
          compliance and auditing purposes.
        </p>
      </div>
    </label>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ViolationWorkflow({ violation, onResolve }: Readonly<ViolationWorkflowProps>) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [auditConfirmed, setAuditConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentAction = useMemo(
    () => RESOLUTION_ACTIONS.find((a) => a.id === selectedAction),
    [selectedAction]
  );

  const reasonTemplates = useMemo(
    () => (selectedAction ? REASON_TEMPLATES[selectedAction] || [] : []),
    [selectedAction]
  );

  const canSubmit = selectedAction && reason.trim() && auditConfirmed && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAction) return;

    setIsSubmitting(true);
    try {
      await onResolve(selectedAction, reason);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Already resolved
  if (violation.resolution) {
    const resolvedAction = RESOLUTION_ACTIONS.find((a) => a.id === violation.resolution?.action);
    const Icon = resolvedAction?.icon || CheckCircle;

    return (
      <div className="py-8 text-center">
        <div
          className={`inline-flex rounded-full p-4 ${resolvedAction?.bgColor || 'bg-green-100'} mb-4`}
        >
          <Icon className={`h-8 w-8 ${resolvedAction?.color || 'text-green-600'}`} />
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
          Violation {violation.resolution.action === 'dismissed' ? 'Dismissed' : 'Resolved'}
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          {resolvedAction?.label || violation.resolution.action}
        </p>
        <div className="mx-auto max-w-md rounded-lg bg-gray-50 p-4 text-left dark:bg-gray-900">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Reason:</span>
              <span className="text-right text-gray-900 dark:text-white">
                {violation.resolution.reason}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Resolved by:</span>
              <span className="text-gray-900 dark:text-white">
                {violation.resolution.resolvedBy}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Resolved at:</span>
              <span className="text-gray-900 dark:text-white">
                {formatDate(violation.resolution.resolvedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
        <Clock className="h-5 w-5 text-yellow-600" />
        <div>
          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            Violation is pending resolution
          </span>
          <p className="text-xs text-yellow-600 dark:text-yellow-500">
            Select an action below to resolve this violation
          </p>
        </div>
      </div>

      {/* Action Selection */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Select Resolution Action
        </h3>
        <div className="space-y-3">
          {RESOLUTION_ACTIONS.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              isSelected={selectedAction === action.id}
              onSelect={() => setSelectedAction(action.id)}
            />
          ))}
        </div>
      </div>

      {/* Action Details */}
      {currentAction && (
        <>
          {/* Consequences */}
          <ConsequencesPanel action={currentAction} />

          {/* Reason */}
          <div>
            <label
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="violation-reason"
            >
              Reason / Notes *
            </label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="violation-reason"
              placeholder="Provide a reason for this action..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {reasonTemplates.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {reasonTemplates.map((template) => (
                  <button
                    key={template}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    onClick={() => setReason(template)}
                  >
                    {template}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification Preview */}
          <NotificationPreview action={currentAction} reason={reason} violation={violation} />

          {/* Approval Chain */}
          <ApprovalChain action={currentAction} />

          {/* Audit Confirmation */}
          <AuditConfirmation confirmed={auditConfirmed} onChange={setAuditConfirmed} />

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              onClick={() => setSelectedAction(null)}
            >
              Cancel
            </button>
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${(() => {
                if (currentAction.id === 'banned') return 'bg-red-600 hover:bg-red-700';
                if (currentAction.id === 'suspended') return 'bg-orange-600 hover:bg-orange-700';
                return 'bg-blue-600 hover:bg-blue-700';
              })()}`}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {(() => {
                if (isSubmitting) {
                  return (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Processing...
                    </>
                  );
                }
                if (currentAction.requiresApproval) {
                  return (
                    <>
                      <Send className="h-4 w-4" />
                      Submit for Approval
                    </>
                  );
                }
                return (
                  <>
                    <Check className="h-4 w-4" />
                    {currentAction.label}
                  </>
                );
              })()}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
