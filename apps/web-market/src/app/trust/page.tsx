'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  CreditCard,
  Eye,
  FileCheck,
  Fingerprint,
  Lock,
  MessageSquare,
  Shield,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function TrustPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="secondary">
              <Shield className="mr-1 h-3 w-3" />
              Trust & Safety
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Your Security is Our <span className="text-primary">Priority</span>
            </h1>
            <p className="text-muted-foreground mt-6 text-lg">
              Skillancer is built on a foundation of trust. We&apos;ve implemented industry-leading
              security measures to protect both freelancers and clients.
            </p>
          </div>
        </div>
      </section>

      {/* Protection Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <ProtectionCard
              features={[
                'Escrow holds funds securely',
                'Milestone-based releases',
                'Dispute resolution support',
                'Multiple payment methods',
              ]}
              icon={CreditCard}
              title="Payment Protection"
            />
            <ProtectionCard
              features={[
                'ID verification required',
                'Two-factor authentication',
                'Background checks available',
                'Verified payment methods',
              ]}
              icon={UserCheck}
              title="Identity Verification"
            />
            <ProtectionCard
              features={[
                'End-to-end encryption',
                'SOC 2 Type II compliant',
                'GDPR compliance',
                'Regular security audits',
              ]}
              icon={Lock}
              title="Data Security"
            />
          </div>
        </div>
      </section>

      {/* Skill Verification */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4" variant="secondary">
                <Award className="mr-1 h-3 w-3" />
                Skill Verification
              </Badge>
              <h2 className="text-3xl font-bold">Verified Skills You Can Trust</h2>
              <p className="text-muted-foreground mt-4">
                Our AI-proctored skill assessments ensure freelancers have the expertise they claim.
                Verified badges give clients confidence when making hiring decisions.
              </p>

              <div className="mt-8 space-y-4">
                <FeatureItem
                  description="Advanced monitoring prevents cheating during skill assessments"
                  icon={Eye}
                  title="AI-Proctored Testing"
                />
                <FeatureItem
                  description="Assessments designed by industry experts and updated regularly"
                  icon={FileCheck}
                  title="Industry-Recognized Tests"
                />
                <FeatureItem
                  description="Blockchain-verified certificates that can't be forged"
                  icon={Fingerprint}
                  title="Tamper-Proof Credentials"
                />
              </div>

              <div className="mt-8">
                <Button asChild size="lg">
                  <Link href="/verification">
                    Get Verified
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 flex aspect-video items-center justify-center rounded-2xl">
              <ShieldCheck className="text-primary h-24 w-24 opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* How We Protect You */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How We Protect You</h2>
            <p className="text-muted-foreground mt-2">
              Multiple layers of protection for every transaction
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="grid gap-6 md:grid-cols-2">
              <SecurityCard
                icon={Shield}
                items={[
                  'Get paid through secure escrow',
                  'Clear milestone agreements',
                  'Dispute resolution support',
                  'Work history protection',
                  'Rating system transparency',
                ]}
                title="For Freelancers"
              />
              <SecurityCard
                icon={ShieldCheck}
                items={[
                  'Verified freelancer profiles',
                  'Skill assessment verification',
                  'Milestone-based payments',
                  'Work monitoring with SkillPod',
                  'Quality guarantee program',
                ]}
                title="For Clients"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Dispute Resolution */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <MessageSquare className="text-primary mx-auto mb-4 h-12 w-12" />
            <h2 className="text-2xl font-bold">Dispute Resolution</h2>
            <p className="text-muted-foreground mt-4">
              If issues arise, our dedicated support team is here to help. We offer mediation
              services and, when necessary, binding arbitration to ensure fair outcomes for all
              parties.
            </p>
            <div className="mt-8">
              <Button asChild variant="outline">
                <Link href="/support">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Compliance & Certifications
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8">
            <ComplianceBadge label="SOC 2 Type II" />
            <ComplianceBadge label="GDPR Compliant" />
            <ComplianceBadge label="ISO 27001" />
            <ComplianceBadge label="PCI DSS" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Work with Confidence</h2>
          <p className="text-primary-foreground/80 mt-4">
            Join a platform that prioritizes your security
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProtectionCard({
  icon: Icon,
  title,
  features,
}: {
  icon: React.ElementType;
  title: string;
  features: string[];
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
          <Icon className="text-primary h-6 w-6" />
        </div>
        <h3 className="mb-4 text-xl font-semibold">{title}</h3>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="text-primary h-4 w-4" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Icon className="text-primary h-5 w-5" />
        </div>
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

function SecurityCard({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ElementType;
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <Icon className="text-primary h-6 w-6" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ComplianceBadge({ label }: { label: string }) {
  return (
    <div className="bg-muted flex items-center gap-2 rounded-lg px-6 py-3">
      <CheckCircle2 className="h-5 w-5 text-green-500" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
