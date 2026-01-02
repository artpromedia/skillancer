'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  Lock,
  Monitor,
  Play,
  Shield,
  Video,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function SkillPodPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 bg-purple-500/10 text-purple-500">
                <Monitor className="mr-1 h-3 w-3" />
                Virtual Desktop
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                SkillPod <span className="text-primary">VDI</span>
              </h1>
              <p className="text-muted-foreground mt-6 text-lg">
                A secure virtual desktop environment for freelancers to work on sensitive projects.
                Built-in monitoring, screen recording, and data protection give clients confidence
                while maintaining freelancer privacy.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Try SkillPod Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/demo">
                    <Play className="mr-2 h-4 w-4" />
                    Watch Demo
                  </Link>
                </Button>
              </div>
            </div>

            <div className="from-primary/20 via-primary/10 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br to-transparent">
              <Monitor className="text-primary h-32 w-32 opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Key Features</h2>
            <p className="text-muted-foreground mt-2">Everything you need for secure remote work</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              description="Full-featured cloud desktop accessible from any browser. Pre-configured with development tools and software."
              icon={Monitor}
              title="Virtual Desktop"
            />
            <FeatureCard
              description="Optional screen recording and activity logs for client transparency. Fully configurable privacy settings."
              icon={Video}
              title="Activity Recording"
            />
            <FeatureCard
              description="Prevent unauthorized file downloads and screen captures. Keep sensitive client data secure."
              icon={Lock}
              title="Data Loss Prevention"
            />
            <FeatureCard
              description="Automatic time tracking with detailed activity breakdowns. Verify hours worked with confidence."
              icon={Eye}
              title="Time Tracking"
            />
            <FeatureCard
              description="Isolated environment with no access to personal files. End-to-end encryption for all data."
              icon={Shield}
              title="Secure Environment"
            />
            <FeatureCard
              description="Powered by cloud infrastructure for fast, reliable performance. Works anywhere with internet."
              icon={Zap}
              title="High Performance"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How SkillPod Works</h2>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="space-y-8">
              <StepItem
                description="Clients can require SkillPod for sensitive projects. They configure monitoring preferences and access levels."
                step={1}
                title="Client Enables SkillPod"
              />
              <StepItem
                description="Freelancers review the SkillPod requirements and accept the contract terms. Setup is automatic."
                step={2}
                title="Freelancer Accepts Contract"
              />
              <StepItem
                description="Freelancers access their SkillPod desktop through any browser. All tools and files are pre-configured."
                step={3}
                title="Work in Secure Environment"
              />
              <StepItem
                description="Completed work is automatically logged and verified. Clients can review activity and approve milestones."
                step={4}
                title="Submit Verified Work"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Freelancers</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Access premium software without subscriptions" />
                  <BenefitItem text="Work from any device with a browser" />
                  <BenefitItem text="Prove hours worked with verifiable logs" />
                  <BenefitItem text="Build trust with transparency" />
                  <BenefitItem text="Qualify for premium, high-paying projects" />
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Clients</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Protect sensitive data and IP" />
                  <BenefitItem text="Verify actual hours worked" />
                  <BenefitItem text="Monitor progress in real-time" />
                  <BenefitItem text="Meet compliance requirements" />
                  <BenefitItem text="Reduce risk on remote projects" />
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Simple Pricing</h2>
            <p className="text-muted-foreground mt-2">
              Included free on all SkillPod-required contracts
            </p>
          </div>

          <div className="mx-auto max-w-md">
            <Card className="border-primary">
              <CardContent className="p-8 text-center">
                <div className="mb-4 text-4xl font-bold">Free</div>
                <p className="text-muted-foreground mb-6">
                  For freelancers on SkillPod-enabled contracts
                </p>
                <ul className="mb-8 space-y-2 text-left">
                  <BenefitItem text="8 hours/day VDI access" />
                  <BenefitItem text="Pre-installed dev tools" />
                  <BenefitItem text="Automatic time tracking" />
                  <BenefitItem text="Activity logs included" />
                </ul>
                <Button asChild className="w-full" size="lg">
                  <Link href="/signup">Get Started</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to Work Securely?</h2>
          <p className="text-primary-foreground/80 mt-4">
            Join thousands of freelancers using SkillPod for secure, verified work
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Create Free Account</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
          <Icon className="text-primary h-6 w-6" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

function StepItem({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full font-bold">
          {step}
        </div>
      </div>
      <div>
        <h3 className="mb-1 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="h-5 w-5 text-green-500" />
      <span>{text}</span>
    </li>
  );
}
