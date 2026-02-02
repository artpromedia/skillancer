'use client';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Progress,
} from '@skillancer/ui';
import {
  Award,
  BadgeCheck,
  Banknote,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Gauge,
  Headphones,
  Lock,
  Mail,
  Phone,
  Shield,
  Star,
  Verified,
  Zap,
} from 'lucide-react';

import type { VerificationLevel } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface Benefit {
  icon: React.ElementType;
  title: string;
  description: string;
  requiredLevel: VerificationLevel;
}

interface VerificationBenefitsDisplayProps {
  readonly currentLevel: VerificationLevel;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly paymentVerified: boolean;
  readonly skillsVerified: number;
  readonly businessVerified: boolean;
  readonly className?: string;
}

// ============================================================================
// Benefits Data
// ============================================================================

const VERIFICATION_BENEFITS: Benefit[] = [
  {
    icon: Briefcase,
    title: 'Access All Job Categories',
    description: 'Apply to any job listing on the platform',
    requiredLevel: 'EMAIL',
  },
  {
    icon: DollarSign,
    title: 'Receive Payments',
    description: 'Get paid for completed work',
    requiredLevel: 'EMAIL',
  },
  {
    icon: BadgeCheck,
    title: 'Verified Badge',
    description: 'Display a trusted verification badge on your profile',
    requiredLevel: 'BASIC',
  },
  {
    icon: Star,
    title: 'Priority in Search',
    description: 'Appear higher in client search results',
    requiredLevel: 'BASIC',
  },
  {
    icon: Shield,
    title: 'Higher Project Limits',
    description: 'Take on projects worth up to $50,000',
    requiredLevel: 'ENHANCED',
  },
  {
    icon: Headphones,
    title: 'Priority Support',
    description: 'Get faster responses from our support team',
    requiredLevel: 'ENHANCED',
  },
  {
    icon: Zap,
    title: 'Instant Withdrawals',
    description: 'Access your earnings immediately',
    requiredLevel: 'ENHANCED',
  },
  {
    icon: Award,
    title: 'Enterprise Clients',
    description: 'Access exclusive enterprise job listings',
    requiredLevel: 'PREMIUM',
  },
  {
    icon: Lock,
    title: 'Sensitive Projects',
    description: 'Work on NDA-protected and confidential projects',
    requiredLevel: 'PREMIUM',
  },
  {
    icon: Banknote,
    title: 'Unlimited Project Value',
    description: 'No limits on project size or earnings',
    requiredLevel: 'PREMIUM',
  },
];

const LEVEL_ORDER: Record<VerificationLevel, number> = {
  NONE: 0,
  EMAIL: 1,
  BASIC: 2,
  ENHANCED: 3,
  PREMIUM: 4,
};

// ============================================================================
// Component
// ============================================================================

export function VerificationBenefitsDisplay({
  currentLevel,
  emailVerified,
  phoneVerified,
  paymentVerified,
  skillsVerified,
  businessVerified,
  className,
}: VerificationBenefitsDisplayProps) {
  const currentLevelOrder = LEVEL_ORDER[currentLevel];

  // Calculate overall progress
  const verificationItems = [
    { name: 'Email', verified: emailVerified, weight: 10 },
    { name: 'Phone', verified: phoneVerified, weight: 10 },
    { name: 'Identity', verified: currentLevel !== 'NONE' && currentLevel !== 'EMAIL', weight: 30 },
    { name: 'Payment', verified: paymentVerified, weight: 20 },
    { name: 'Skills', verified: skillsVerified > 0, weight: 20 },
    { name: 'Business', verified: businessVerified, weight: 10 },
  ];

  const totalWeight = verificationItems.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = verificationItems
    .filter((item) => item.verified)
    .reduce((sum, item) => sum + item.weight, 0);
  const progressPercent = Math.round((completedWeight / totalWeight) * 100);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="text-primary h-5 w-5" />
            Verification Progress
          </CardTitle>
          <CardDescription>
            Complete more verifications to unlock additional benefits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{progressPercent}%</span>
            <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
              {currentLevel === 'NONE' ? 'Unverified' : currentLevel}
            </Badge>
          </div>
          <Progress className="h-2" value={progressPercent} />

          {/* Verification Checklist */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <VerificationCheckItem icon={Mail} label="Email" verified={emailVerified} />
            <VerificationCheckItem icon={Phone} label="Phone" verified={phoneVerified} />
            <VerificationCheckItem
              icon={Shield}
              label="Identity"
              verified={currentLevel !== 'NONE' && currentLevel !== 'EMAIL'}
            />
            <VerificationCheckItem icon={CreditCard} label="Payment" verified={paymentVerified} />
            <VerificationCheckItem
              icon={BookOpen}
              label={`Skills (${skillsVerified})`}
              verified={skillsVerified > 0}
            />
            <VerificationCheckItem icon={Briefcase} label="Business" verified={businessVerified} />
          </div>
        </CardContent>
      </Card>

      {/* Benefits Grid */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Verification Benefits</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VERIFICATION_BENEFITS.map((benefit) => {
            const isUnlocked = currentLevelOrder >= LEVEL_ORDER[benefit.requiredLevel];
            return <BenefitCard key={benefit.title} benefit={benefit} isUnlocked={isUnlocked} />;
          })}
        </div>
      </div>

      {/* Level Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Levels</CardTitle>
          <CardDescription>Each level unlocks more features and higher trust</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <LevelCard
              description="Basic account access"
              features={['Job browsing', 'Profile creation', 'Basic messaging']}
              isCompleted={currentLevelOrder >= LEVEL_ORDER.EMAIL}
              isCurrent={currentLevel === 'EMAIL'}
              level="EMAIL"
              title="Email Verified"
            />
            <LevelCard
              description="ID + Selfie verification"
              features={['Verified badge', 'All job categories', 'Priority search']}
              isCompleted={currentLevelOrder >= LEVEL_ORDER.BASIC}
              isCurrent={currentLevel === 'BASIC'}
              level="BASIC"
              title="Basic"
            />
            <LevelCard
              description="Background & AML check"
              features={['Higher limits', 'Instant payouts', 'Priority support']}
              isCompleted={currentLevelOrder >= LEVEL_ORDER.ENHANCED}
              isCurrent={currentLevel === 'ENHANCED'}
              level="ENHANCED"
              title="Enhanced"
            />
            <LevelCard
              description="Full verification suite"
              features={['Enterprise clients', 'Unlimited projects', 'VIP status']}
              isCompleted={currentLevelOrder >= LEVEL_ORDER.PREMIUM}
              isCurrent={currentLevel === 'PREMIUM'}
              level="PREMIUM"
              title="Premium"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface VerificationCheckItemProps {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly verified: boolean;
}

function VerificationCheckItem({ icon: Icon, label, verified }: VerificationCheckItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2 text-sm',
        verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-muted-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {verified && <CheckCircle2 className="ml-auto h-4 w-4" />}
    </div>
  );
}

interface BenefitCardProps {
  readonly benefit: Benefit;
  readonly isUnlocked: boolean;
}

function BenefitCard({ benefit, isUnlocked }: BenefitCardProps) {
  const Icon = benefit.icon;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        isUnlocked ? 'border-emerald-200 bg-emerald-50' : 'bg-muted/30 border-dashed opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('rounded-lg p-2', isUnlocked ? 'bg-emerald-100' : 'bg-muted')}>
          <Icon
            className={cn('h-5 w-5', isUnlocked ? 'text-emerald-600' : 'text-muted-foreground')}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">{benefit.title}</h4>
            {isUnlocked && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{benefit.description}</p>
          {!isUnlocked && (
            <Badge className="mt-2 text-xs" variant="outline">
              <Lock className="mr-1 h-3 w-3" />
              {benefit.requiredLevel}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

interface LevelCardProps {
  readonly level: VerificationLevel;
  readonly title: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly isCurrent: boolean;
  readonly isCompleted: boolean;
}

function LevelCard({
  level,
  title,
  description,
  features,
  isCurrent,
  isCompleted,
}: LevelCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all',
        isCurrent && 'ring-primary ring-2',
        isCompleted && !isCurrent && 'border-emerald-200 bg-emerald-50/50'
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        {isCompleted && <Verified className="h-5 w-5 text-emerald-600" />}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      <ul className="mt-3 space-y-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-xs">
            <CheckCircle2
              className={cn('h-3 w-3', isCompleted ? 'text-emerald-600' : 'text-muted-foreground')}
            />
            <span className={isCompleted ? '' : 'text-muted-foreground'}>{feature}</span>
          </li>
        ))}
      </ul>
      {isCurrent && (
        <Badge className="mt-3" variant="secondary">
          Current Level
        </Badge>
      )}
    </div>
  );
}
