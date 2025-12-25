/* eslint-disable @typescript-eslint/no-unused-vars */
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
} from '@skillancer/ui';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

import { PersonaEmbed } from '@/components/verification/persona-embed';

// ============================================================================
// Types
// ============================================================================

type VerificationTier = 'BASIC' | 'ENHANCED' | 'PREMIUM';

interface VerificationStatus {
  level: string;
  identityVerified: boolean;
  identityVerifiedAt?: string;
  paymentVerified: boolean;
  paymentVerifiedAt?: string;
  phoneVerified: boolean;
  phoneVerifiedAt?: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  pendingVerification?: {
    inquiryId: string;
    tier: VerificationTier;
    status: string;
    startedAt: string;
  };
}

// ============================================================================
// Mock Data (replace with API call)
// ============================================================================

const mockStatus: VerificationStatus = {
  level: 'EMAIL',
  identityVerified: false,
  paymentVerified: true,
  paymentVerifiedAt: '2024-01-15T10:00:00Z',
  phoneVerified: false,
  emailVerified: true,
  emailVerifiedAt: '2024-01-10T09:00:00Z',
};

// ============================================================================
// Verification Tier Card
// ============================================================================

function TierCard({
  tier,
  title,
  description,
  features,
  icon: Icon,
  isCurrentTier,
  isCompleted,
  onStart,
}: {
  tier: VerificationTier;
  title: string;
  description: string;
  features: string[];
  icon: React.ElementType;
  isCurrentTier: boolean;
  isCompleted: boolean;
  onStart: () => void;
}) {
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
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
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
// Main Component
// ============================================================================

export function VerificationCenter() {
  const [status] = useState<VerificationStatus>(mockStatus);
  const [showPersona, setShowPersona] = useState(false);
  const [selectedTier, setSelectedTier] = useState<VerificationTier | null>(null);

  const handleStartVerification = (tier: VerificationTier) => {
    setSelectedTier(tier);
    setShowPersona(true);
  };

  const handleVerificationComplete = () => {
    setShowPersona(false);
    setSelectedTier(null);
    // Refresh status
  };

  const isBasicComplete =
    status.level === 'BASIC' || status.level === 'ENHANCED' || status.level === 'PREMIUM';
  const isEnhancedComplete = status.level === 'ENHANCED' || status.level === 'PREMIUM';
  const isPremiumComplete = status.level === 'PREMIUM';

  return (
    <div className="space-y-8">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Verification Status</CardTitle>
          <CardDescription>Your account verification progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Email */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Mail
                className={cn(
                  'h-5 w-5',
                  status.emailVerified ? 'text-emerald-600' : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-muted-foreground text-xs">
                  {status.emailVerified ? 'Verified' : 'Not verified'}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Phone
                className={cn(
                  'h-5 w-5',
                  status.phoneVerified ? 'text-emerald-600' : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-muted-foreground text-xs">
                  {status.phoneVerified ? 'Verified' : 'Not verified'}
                </p>
              </div>
            </div>

            {/* Payment */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <CreditCard
                className={cn(
                  'h-5 w-5',
                  status.paymentVerified ? 'text-emerald-600' : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="text-sm font-medium">Payment</p>
                <p className="text-muted-foreground text-xs">
                  {status.paymentVerified ? 'Verified' : 'Not verified'}
                </p>
              </div>
            </div>

            {/* Identity */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Shield
                className={cn(
                  'h-5 w-5',
                  status.identityVerified ? 'text-emerald-600' : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="text-sm font-medium">Identity</p>
                <p className="text-muted-foreground text-xs">
                  {status.identityVerified ? status.level : 'Not verified'}
                </p>
              </div>
            </div>
          </div>

          {/* Pending verification alert */}
          {status.pendingVerification && (
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
