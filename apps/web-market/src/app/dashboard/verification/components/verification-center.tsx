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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  Award,
  Building2,
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
  Sparkles,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

import { BusinessVerificationPanel } from './business-verification-panel';
import { PaymentVerificationPanel } from './payment-verification-panel';
import { SkillsVerificationPanel } from './skills-verification-panel';
import { VerificationBenefits } from './verification-benefits';
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
  const [activeTab, setActiveTab] = useState('overview');

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
      {/* Benefits Overview */}
      <VerificationBenefits className="mb-2" />

      {/* Tabbed Verification Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="identity" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Identity</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Payment</span>
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
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
                  onClick={() => setActiveTab('payment')}
                />

                {/* Identity */}
                <button
                  type="button"
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-4 text-left transition-colors"
                  onClick={() => setActiveTab('identity')}
                >
                  <Shield
                    className={cn(
                      'h-5 w-5',
                      status?.identityVerified ? 'text-emerald-600' : 'text-muted-foreground'
                    )}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Identity</p>
                    <p className="text-muted-foreground text-xs">
                      {status?.identityVerified ? level : 'Not verified'}
                    </p>
                  </div>
                  <CheckCircle2 className="text-primary h-4 w-4" />
                </button>
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

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-primary h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Complete these verifications to unlock more benefits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-2 p-4"
                  onClick={() => setActiveTab('identity')}
                >
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium">Verify Identity</p>
                    <p className="text-muted-foreground text-xs">Get a trust badge</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-2 p-4"
                  onClick={() => setActiveTab('skills')}
                >
                  <Award className="h-5 w-5 text-purple-600" />
                  <div className="text-left">
                    <p className="font-medium">Verify Skills</p>
                    <p className="text-muted-foreground text-xs">Take skill assessments</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-2 p-4"
                  onClick={() => setActiveTab('payment')}
                >
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-medium">Verify Payment</p>
                    <p className="text-muted-foreground text-xs">Faster payouts</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start gap-2 p-4"
                  onClick={() => setActiveTab('business')}
                >
                  <Building2 className="h-5 w-5 text-orange-600" />
                  <div className="text-left">
                    <p className="font-medium">Business Verify</p>
                    <p className="text-muted-foreground text-xs">For agencies</p>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Identity Tab */}
        <TabsContent value="identity" className="space-y-6">
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
                  <div
                    key={cert}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
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
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <SkillsVerificationPanel />
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment">
          <PaymentVerificationPanel />
        </TabsContent>

        {/* Business Tab */}
        <TabsContent value="business">
          <BusinessVerificationPanel />
        </TabsContent>
      </Tabs>

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
