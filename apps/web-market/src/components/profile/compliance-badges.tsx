'use client';

import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@skillancer/ui';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ComplianceType = 'hipaa' | 'soc2' | 'pci-dss' | 'gdpr' | 'iso27001' | 'fedramp';
type ClearanceLevel = 'public-trust' | 'confidential' | 'secret' | 'top-secret';
type CertificationStatus = 'active' | 'expired' | 'pending';

interface ComplianceCertification {
  id: string;
  type: ComplianceType;
  verifiedAt: string;
  expiresAt?: string;
  status: CertificationStatus;
}

interface SecurityClearance {
  id: string;
  level: ClearanceLevel;
  verifiedAt: string;
  expiresAt?: string;
  status: CertificationStatus;
}

interface ComplianceBadgesProps {
  certifications: ComplianceCertification[];
  clearances: SecurityClearance[];
  variant?: 'badges' | 'list' | 'compact';
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusText(status: CertificationStatus): string {
  if (status === 'active') return 'Verified';
  if (status === 'expired') return 'Expired';
  return 'Pending';
}

function getClearanceStatusText(status: CertificationStatus): string {
  if (status === 'active') return 'Active';
  if (status === 'expired') return 'Expired';
  return 'Pending';
}

// ============================================================================
// Config
// ============================================================================

const complianceConfig: Record<
  ComplianceType,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: typeof Shield;
    color: string;
    bgColor: string;
  }
> = {
  hipaa: {
    label: 'HIPAA Trained',
    shortLabel: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act compliance training',
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  soc2: {
    label: 'SOC 2 Aware',
    shortLabel: 'SOC 2',
    description: 'Service Organization Control 2 security awareness',
    icon: ShieldCheck,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  'pci-dss': {
    label: 'PCI-DSS Compliant',
    shortLabel: 'PCI-DSS',
    description: 'Payment Card Industry Data Security Standard compliance',
    icon: Lock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  gdpr: {
    label: 'GDPR Trained',
    shortLabel: 'GDPR',
    description: 'General Data Protection Regulation compliance training',
    icon: FileText,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  iso27001: {
    label: 'ISO 27001',
    shortLabel: 'ISO 27001',
    description: 'Information Security Management System certification',
    icon: ShieldCheck,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  fedramp: {
    label: 'FedRAMP',
    shortLabel: 'FedRAMP',
    description: 'Federal Risk and Authorization Management Program',
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};

const clearanceConfig: Record<
  ClearanceLevel,
  {
    label: string;
    shortLabel: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  'public-trust': {
    label: 'Public Trust',
    shortLabel: 'PT',
    description: 'Public Trust clearance for non-sensitive positions',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  confidential: {
    label: 'Confidential',
    shortLabel: 'C',
    description: 'Confidential security clearance',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
  },
  secret: {
    label: 'Secret',
    shortLabel: 'S',
    description: 'Secret security clearance',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-400',
  },
  'top-secret': {
    label: 'Top Secret',
    shortLabel: 'TS',
    description: 'Top Secret security clearance',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-400',
  },
};

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return { icon: CheckCircle, color: 'text-green-500' };
    case 'expired':
      return { icon: AlertTriangle, color: 'text-red-500' };
    case 'pending':
      return { icon: Clock, color: 'text-yellow-500' };
    default:
      return { icon: CheckCircle, color: 'text-gray-500' };
  }
}

// ============================================================================
// Badge Variant
// ============================================================================

function ComplianceBadge({ cert }: Readonly<{ cert: ComplianceCertification }>) {
  const config = complianceConfig[cert.type];
  const status = getStatusIcon(cert.status);
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
              config.bgColor,
              config.color,
              cert.status === 'expired' && 'opacity-50'
            )}
          >
            <Icon className="h-4 w-4" />
            {config.shortLabel}
            {cert.status !== 'active' && <status.icon className={cn('h-3 w-3', status.color)} />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs opacity-80">{config.description}</p>
            <p className="mt-1 text-xs">
              {getStatusText(cert.status)} {formatDate(cert.verifiedAt)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ClearanceBadge({ clearance }: Readonly<{ clearance: SecurityClearance }>) {
  const config = clearanceConfig[clearance.level];
  const status = getStatusIcon(clearance.status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-medium',
              config.bgColor,
              config.color,
              config.borderColor,
              clearance.status === 'expired' && 'opacity-50'
            )}
          >
            <ShieldAlert className="h-4 w-4" />
            {config.label}
            {clearance.status !== 'active' && (
              <status.icon className={cn('h-3 w-3', status.color)} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-medium">{config.label} Clearance</p>
            <p className="text-xs opacity-80">{config.description}</p>
            <p className="mt-1 text-xs">
              {getClearanceStatusText(clearance.status)} since {formatDate(clearance.verifiedAt)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// List Variant
// ============================================================================

function ComplianceList({
  certifications,
  clearances,
}: Readonly<{
  certifications: ComplianceCertification[];
  clearances: SecurityClearance[];
}>) {
  return (
    <div className="space-y-4">
      {/* Compliance Certifications */}
      {certifications.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">Compliance Training</h4>
          <div className="space-y-2">
            {certifications.map((cert) => {
              const config = complianceConfig[cert.type];
              const status = getStatusIcon(cert.status);
              const Icon = config.icon;

              return (
                <div
                  key={cert.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('rounded-lg p-2', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{config.label}</p>
                      <p className="text-xs text-gray-500">
                        Verified {formatDate(cert.verifiedAt)}
                        {cert.expiresAt && ` • Expires ${formatDate(cert.expiresAt)}`}
                      </p>
                    </div>
                  </div>
                  <status.icon className={cn('h-5 w-5', status.color)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Security Clearances */}
      {clearances.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-700">Security Clearances</h4>
          <div className="space-y-2">
            {clearances.map((clearance) => {
              const config = clearanceConfig[clearance.level];
              const status = getStatusIcon(clearance.status);

              return (
                <div
                  key={clearance.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border-2 p-3',
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className={cn('h-5 w-5', config.color)} />
                    <div>
                      <p className={cn('font-medium', config.color)}>{config.label}</p>
                      <p className="text-xs text-gray-500">
                        Active since {formatDate(clearance.verifiedAt)}
                        {clearance.expiresAt && ` • Expires ${formatDate(clearance.expiresAt)}`}
                      </p>
                    </div>
                  </div>
                  <status.icon className={cn('h-5 w-5', status.color)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ComplianceBadges({
  certifications,
  clearances,
  variant = 'badges',
  className,
}: Readonly<ComplianceBadgesProps>) {
  const activeCerts = certifications.filter((c) => c.status === 'active');
  const activeClearances = clearances.filter((c) => c.status === 'active');

  if (activeCerts.length === 0 && activeClearances.length === 0) {
    return null;
  }

  if (variant === 'list') {
    return (
      <div className={cn('rounded-xl border border-gray-200 bg-white p-4', className)}>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Compliance & Security</h3>
        <ComplianceList certifications={certifications} clearances={clearances} />
      </div>
    );
  }

  if (variant === 'compact') {
    const total = activeCerts.length + activeClearances.length;
    const sortedClearances = [...activeClearances].sort((a, b) => {
      const order = ['public-trust', 'confidential', 'secret', 'top-secret'];
      return order.indexOf(b.level) - order.indexOf(a.level);
    });
    const highestClearance = sortedClearances.length > 0 ? sortedClearances[0] : undefined;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium',
                highestClearance
                  ? clearanceConfig[highestClearance.level].bgColor
                  : 'bg-green-100 text-green-700'
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              {highestClearance
                ? clearanceConfig[highestClearance.level].shortLabel
                : `${total} Compliance`}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p className="mb-1 font-medium">Compliance & Clearances</p>
              {activeCerts.map((c) => (
                <p key={c.id}>✓ {complianceConfig[c.type].label}</p>
              ))}
              {activeClearances.map((c) => (
                <p key={c.id}>🔒 {clearanceConfig[c.level].label}</p>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default: badges variant
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {activeCerts.map((cert) => (
        <ComplianceBadge key={cert.id} cert={cert} />
      ))}
      {activeClearances.map((clearance) => (
        <ClearanceBadge key={clearance.id} clearance={clearance} />
      ))}
    </div>
  );
}

export default ComplianceBadges;
