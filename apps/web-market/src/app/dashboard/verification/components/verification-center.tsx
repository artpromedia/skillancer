'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
} from '@skillancer/ui';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

import { VerificationDialog } from './verification-dialog';

import { PersonaEmbed } from '@/components/verification/persona-embed';
import { useVerificationStatus, type VerificationTier } from '@/hooks/use-verification';

// ============================================================================
// Verification Tier Card
// ============================================================================

interface TierCardProps {
  readonly tier: VerificationTier;
  readonly title: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly icon: React.ElementType;
  readonly isCurrentTier: boolean;
  readonly isCompleted: boolean;
  readonly onStart: () => void;
}

function TierCard({
  tier,
  title,
  description,
  features,
  icon: Icon,
  isCurrentTier,
  isCompleted,
  onStart,
}: TierCardProps) {
  return (
    <Card
      className={cn(
        'relative transition-all',
        isCurrentTier && 'ring-primary ring-2',
        isCompleted && 'bg-muted/30'
      )}
    >
      {isCompleted && (
        <div className="absolute right-4 top-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'rounded-lg p-2',
              tier === 'BASIC' && 'bg-blue-100',
              tier === 'ENHANCED' && 'bg-purple-100',
              tier === 'PREMIUM' && 'bg-emerald-100'
            )}
          >
            <Icon
              className={cn(
                'h-6 w-6',
                tier === 'BASIC' && 'text-blue-600',
                tier === 'ENHANCED' && 'text-purple-600',
                tier === 'PREMIUM' && 'text-emerald-600'
              )}
            />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {feature}
            </li>
          ))}
        </ul>
        {!isCompleted && (
          <Button
            className="w-full"
            variant={isCurrentTier ? 'default' : 'outline'}
            onClick={onStart}
          >
            {isCurrentTier ? 'Start Verification' : 'Upgrade'}
          </Button>
        )}
        {isCompleted && (
          <Badge className="w-full justify-center py-2" variant="secondary">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Completed
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Status Item Component
// ============================================================================

interface StatusItemProps {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly verified: boolean;
  readonly verifiedAt?: string;
  readonly onClick?: () => void;
  readonly isLoading?: boolean;
}

function getStatusText(
  isLoading: boolean | undefined,
  verified: boolean,
  verifiedAt?: string
): React.ReactNode {
  if (isLoading) {
    return <Skeleton className="h-3 w-16" />;
  }
  if (verified) {
    return verifiedAt ? `Verified ${new Date(verifiedAt).toLocaleDateString()}` : 'Verified';
  }
  return 'Click to verify';
}

function StatusItem({
  icon: Icon,
  label,
  verified,
  verifiedAt,
  onClick,
  isLoading,
}: StatusItemProps) {
  const canVerify = !verified && onClick;

  return (
    <button
      className={cn(
        'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
        canVerify && 'hover:bg-muted/50 cursor-pointer',
        !canVerify && 'cursor-default'
      )}
      disabled={!canVerify}
      type="button"
      onClick={canVerify ? onClick : undefined}
    >
      <Icon className={cn('h-5 w-5', verified ? 'text-emerald-600' : 'text-muted-foreground')} />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">
          {getStatusText(isLoading, verified, verifiedAt)}
        </p>
      </div>
      {canVerify && (
        <div className="text-primary">
          <CheckCircle2 className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VerificationCenter() {
  const [showPersona, setShowPersona] = useState(false);
  const [selectedTier, setSelectedTier] = useState<VerificationTier | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);

  const { status, isLoading, isFetching, error, invalidate } = useVerificationStatus({
    // Poll for updates when there's a pending verification
    refetchInterval: status?.pendingVerification ? 5000 : false,
  });

  const handleStartVerification = (tier: VerificationTier) => {
    setSelectedTier(tier);
    setShowPersona(true);
  };

  const handleVerificationComplete = () => {
    setShowPersona(false);
    setSelectedTier(null);
    void invalidate();
  };

  const handleEmailVerified = () => {
    void invalidate();
  };

  const handlePhoneVerified = () => {
    void invalidate();
  };

  // Compute tier completion status
  const level = status?.level ?? 'NONE';
  const isBasicComplete = level === 'BASIC' || level === 'ENHANCED' || level === 'PREMIUM';
  const isEnhancedComplete = level === 'ENHANCED' || level === 'PREMIUM';
  const isPremiumComplete = level === 'PREMIUM';

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg border p-4">
                  <Skeleton className="mb-2 h-5 w-5" />
                  <Skeleton className="mb-1 h-4 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="text-destructive h-12 w-12" />
          <div className="text-center">
            <p className="font-medium">Failed to load verification status</p>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
          <Button onClick={() => void invalidate()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Current Verification Status</CardTitle>
            <CardDescription>Your account verification progress</CardDescription>
          </div>
          {isFetching && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Email */}
            <StatusItem
              icon={Mail}
              isLoading={isLoading}
              label="Email"
              verified={status?.emailVerified ?? false}
              verifiedAt={status?.emailVerifiedAt}
              onClick={() => setShowEmailDialog(true)}
            />

            {/* Phone */}
            <StatusItem
              icon={Phone}
              isLoading={isLoading}
              label="Phone"
              verified={status?.phoneVerified ?? false}
              verifiedAt={status?.phoneVerifiedAt}
              onClick={() => setShowPhoneDialog(true)}
            />

            {/* Payment */}
            <StatusItem
              icon={CreditCard}
              isLoading={isLoading}
              label="Payment"
              verified={status?.paymentVerified ?? false}
              verifiedAt={status?.paymentVerifiedAt}
            />

            {/* Identity */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Shield
                className={cn(
                  'h-5 w-5',
                  status?.identityVerified ? 'text-emerald-600' : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="text-sm font-medium">Identity</p>
                <p className="text-muted-foreground text-xs">
                  {status?.identityVerified ? level : 'Not verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Pending verification alert */}
          {status?.pendingVerification && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-yellow-50 p-4 text-yellow-800">
              <Clock className="h-5 w-5" />
              <div>
                <p className="font-medium">Verification in progress</p>
                <p className="text-sm">
                  Your {status.pendingVerification.tier} verification is being processed.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Identity Verification Tiers */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Identity Verification Tiers</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <TierCard
            description="ID + Selfie Match"
            features={[
              'Government ID verification',
              'Selfie matching',
              'Basic profile badge',
              'Access to all job categories',
            ]}
            icon={Shield}
            isCompleted={isBasicComplete}
            isCurrentTier={!isBasicComplete}
            tier="BASIC"
            title="Basic Verification"
            onStart={() => handleStartVerification('BASIC')}
          />
          <TierCard
            description="Basic + AML Screening"
            features={[
              'Everything in Basic',
              'AML/PEP screening',
              'Background check',
              'Enhanced trust badge',
              'Priority in search results',
            ]}
            icon={ShieldCheck}
            isCompleted={isEnhancedComplete}
            isCurrentTier={isBasicComplete && !isEnhancedComplete}
            tier="ENHANCED"
            title="Enhanced Verification"
            onStart={() => handleStartVerification('ENHANCED')}
          />
          <TierCard
            description="Enhanced + Biometrics"
            features={[
              'Everything in Enhanced',
              'Biometric liveness detection',
              'Address verification',
              'Continuous monitoring',
              'Premium trust badge',
              'Top placement in search',
            ]}
            icon={ShieldPlus}
            isCompleted={isPremiumComplete}
            isCurrentTier={isEnhancedComplete && !isPremiumComplete}
            tier="PREMIUM"
            title="Premium Verification"
            onStart={() => handleStartVerification('PREMIUM')}
          />
        </div>
      </div>

      {/* Compliance Certifications */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Certifications</CardTitle>
          <CardDescription>
            Upload industry-specific certifications to showcase your expertise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {['HIPAA', 'SOC 2', 'GDPR', 'PCI DSS'].map((cert) => (
              <div key={cert} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <FileCheck className="text-muted-foreground h-5 w-5" />
                  <span className="font-medium">{cert}</span>
                </div>
                <Button size="sm" variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Verification Dialog */}
      <VerificationDialog
        open={showEmailDialog}
        type="email"
        onOpenChange={setShowEmailDialog}
        onSuccess={handleEmailVerified}
      />

      {/* Phone Verification Dialog */}
      <VerificationDialog
        open={showPhoneDialog}
        type="phone"
        onOpenChange={setShowPhoneDialog}
        onSuccess={handlePhoneVerified}
      />

      {/* Persona Embed Modal */}
      {showPersona && selectedTier && (
        <PersonaEmbed
          tier={selectedTier}
          onCancel={() => setShowPersona(false)}
          onComplete={handleVerificationComplete}
        />
      )}
    </div>
  );
}
