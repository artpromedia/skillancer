'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileCheck,
  Fingerprint,
  GraduationCap,
  Mail,
  Phone,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function VerificationPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 bg-blue-500/10 text-blue-500">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Trust & Verification
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Skill <span className="text-primary">Verification</span>
              </h1>
              <p className="text-muted-foreground mt-6 text-lg">
                Build trust and stand out from the crowd. Our multi-tier verification system lets
                you prove your identity, validate your skills, and earn badges that clients trust —
                so you win more projects at higher rates.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Get Verified
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/how-it-works">
                    <Play className="mr-2 h-4 w-4" />
                    Learn More
                  </Link>
                </Button>
              </div>
              <div className="text-muted-foreground mt-6 flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Verified freelancers earn 40% more
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  3x more interview invitations
                </span>
              </div>
            </div>

            <div className="from-primary/20 via-primary/10 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br to-transparent">
              <ShieldCheck className="text-primary h-32 w-32 opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* Verification Types */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ways to Get Verified</h2>
            <p className="text-muted-foreground mt-2">
              Multiple verification paths to build a comprehensive trust profile
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <VerificationTypeCard
              badge="Quick"
              color="green"
              description="Confirm your email and phone number to unlock basic platform features and show clients you're reachable."
              icon={Mail}
              items={['Email confirmation', 'Phone number verification', 'Instant activation']}
              title="Contact Verification"
            />
            <VerificationTypeCard
              badge="Recommended"
              color="blue"
              description="Verify your real identity with government-issued ID. Three tiers available depending on project requirements."
              icon={Fingerprint}
              items={[
                'Basic ID check',
                'Enhanced document review',
                'Premium biometric verification',
              ]}
              title="Identity Verification"
            />
            <VerificationTypeCard
              badge="Stand Out"
              color="purple"
              description="Prove your expertise through our five-tier skill verification journey — from self-assessed to certified."
              icon={Award}
              items={['Skills assessments', 'Peer endorsements', 'Expert-proctored exams']}
              title="Skill Verification"
            />
            <VerificationTypeCard
              badge="Enterprise"
              color="amber"
              description="Verify your business entity for enterprise clients. Show you're a legitimate, registered organization."
              icon={FileCheck}
              items={['Business registration', 'Tax ID verification', 'Insurance documentation']}
              title="Business Verification"
            />
            <VerificationTypeCard
              badge="Secure"
              color="cyan"
              description="Add a verified payment method to enable faster payouts and demonstrate financial credibility."
              icon={CreditCard}
              items={['Bank account verification', 'Payment method on file', 'Faster payouts']}
              title="Payment Verification"
            />
            <VerificationTypeCard
              badge="Elite"
              color="rose"
              description="Earn the Top Rated badge by maintaining exceptional performance, high ratings, and consistent delivery."
              icon={Star}
              items={['90%+ job success', '4.8+ average rating', '$10K+ lifetime earnings']}
              title="Top Rated Status"
            />
          </div>
        </div>
      </section>

      {/* Skill Verification Tiers */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Skill Verification Journey
            </h2>
            <p className="text-muted-foreground mt-2">
              Progress through five tiers to maximize your credibility and earning potential
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <TierCard
              color="bg-gray-100 border-gray-300"
              description="No verification yet"
              features={['Basic profile visibility']}
              tier="Unverified"
              tierNumber={0}
            />
            <TierCard
              color="bg-blue-50 border-blue-300"
              description="List your skills"
              features={['Skill tags on profile', 'Self-declared expertise']}
              tier="Self-Assessed"
              tierNumber={1}
            />
            <TierCard
              color="bg-purple-50 border-purple-300"
              description="Peer validation"
              features={['Colleague endorsements', 'Social proof badges']}
              tier="Endorsed"
              tierNumber={2}
            />
            <TierCard
              color="bg-amber-50 border-amber-300"
              description="AI-proctored testing"
              features={['Timed skill assessments', 'Verified score badges']}
              tier="Assessed"
              tierNumber={3}
            />
            <TierCard
              highlight
              color="bg-green-50 border-green-300"
              description="Expert-verified"
              features={['Live proctored exams', 'Industry-recognized cert', 'Premium badge']}
              tier="Certified"
              tierNumber={4}
            />
          </div>
        </div>
      </section>

      {/* Identity Verification Tiers */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Identity Verification Tiers
            </h2>
            <p className="text-muted-foreground mt-2">
              Choose the level of identity verification that fits your needs
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <Shield className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="mb-1 text-lg font-bold">Basic</h3>
                <p className="text-muted-foreground mb-4 text-sm">Government ID check</p>
                <ul className="space-y-2 text-left text-sm">
                  <BenefitItem text="Photo ID upload" />
                  <BenefitItem text="Name & DOB match" />
                  <BenefitItem text="Basic badge" />
                </ul>
                <div className="mt-4 pt-4 text-sm font-semibold text-blue-600">Free</div>
              </CardContent>
            </Card>
            <Card className="border-primary shadow-lg">
              <CardContent className="p-6 text-center">
                <Badge className="bg-primary/10 text-primary mb-2">Most Popular</Badge>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <ShieldCheck className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="mb-1 text-lg font-bold">Enhanced</h3>
                <p className="text-muted-foreground mb-4 text-sm">Document + liveness check</p>
                <ul className="space-y-2 text-left text-sm">
                  <BenefitItem text="Everything in Basic" />
                  <BenefitItem text="Selfie liveness check" />
                  <BenefitItem text="Address verification" />
                  <BenefitItem text="Enhanced badge" />
                </ul>
                <div className="mt-4 pt-4 text-sm font-semibold text-green-600">Free</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                  <BadgeCheck className="h-7 w-7 text-purple-600" />
                </div>
                <h3 className="mb-1 text-lg font-bold">Premium</h3>
                <p className="text-muted-foreground mb-4 text-sm">Full biometric verification</p>
                <ul className="space-y-2 text-left text-sm">
                  <BenefitItem text="Everything in Enhanced" />
                  <BenefitItem text="Biometric scan" />
                  <BenefitItem text="Background check" />
                  <BenefitItem text="Premium gold badge" />
                  <BenefitItem text="Priority in search" />
                </ul>
                <div className="mt-4 pt-4 text-sm font-semibold text-purple-600">Free</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Why Get Verified?</h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Freelancers</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Earn up to 40% more than unverified peers" />
                  <BenefitItem text="3x more interview invitations from clients" />
                  <BenefitItem text="Priority placement in search results" />
                  <BenefitItem text="Unlock premium and enterprise projects" />
                  <BenefitItem text="Build lasting trust with verification badges" />
                  <BenefitItem text="Stand out in SmartMatch AI rankings" />
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Clients</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Hire verified professionals with confidence" />
                  <BenefitItem text="Reduce hiring risk with identity-checked talent" />
                  <BenefitItem text="Filter candidates by verification level" />
                  <BenefitItem text="Meet compliance requirements for sensitive work" />
                  <BenefitItem text="Access a pool of pre-vetted, skilled talent" />
                  <BenefitItem text="See verified skill scores — not just résumés" />
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <StatCard label="More earnings for verified" value="40%" />
            <StatCard label="More interview invitations" value="3x" />
            <StatCard label="Client trust increase" value="92%" />
            <StatCard label="Verified professionals" value="50K+" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Start Building Trust Today</h2>
          <p className="text-primary-foreground/80 mt-4">
            Verification is free and takes just a few minutes. Stand out, earn more, and win better
            projects.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">
                Get Verified Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              size="lg"
              variant="outline"
            >
              <Link href="/freelancers">Browse Verified Talent</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function VerificationTypeCard({
  icon: Icon,
  title,
  description,
  items,
  badge,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
  badge: string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; badgeBg: string }> = {
    green: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      badgeBg: 'bg-green-500/10 text-green-600',
    },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', badgeBg: 'bg-blue-500/10 text-blue-600' },
    purple: {
      bg: 'bg-purple-100',
      text: 'text-purple-600',
      badgeBg: 'bg-purple-500/10 text-purple-600',
    },
    amber: {
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      badgeBg: 'bg-amber-500/10 text-amber-600',
    },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', badgeBg: 'bg-cyan-500/10 text-cyan-600' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-600', badgeBg: 'bg-rose-500/10 text-rose-600' },
  };

  const c = colorMap[color] ?? colorMap.blue;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg}`}>
            <Icon className={`h-6 w-6 ${c.text}`} />
          </div>
          <Badge className={c.badgeBg}>{badge}</Badge>
        </div>
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground mb-4 text-sm">{description}</p>
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TierCard({
  tier,
  tierNumber,
  description,
  features,
  color,
  highlight,
}: {
  tier: string;
  tierNumber: number;
  description: string;
  features: string[];
  color: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`${color} ${highlight ? 'ring-primary ring-2' : ''}`}>
      <CardContent className="p-4 text-center">
        <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
          Tier {tierNumber}
        </div>
        <h3 className="mb-1 font-bold">{tier}</h3>
        <p className="text-muted-foreground mb-3 text-xs">{description}</p>
        <ul className="space-y-1 text-left">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-xs">
              <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />
              {f}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
      <span>{text}</span>
    </li>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-primary text-4xl font-bold">{value}</div>
      <div className="text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
