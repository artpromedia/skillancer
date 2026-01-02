'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  PieChart,
  Play,
  Settings,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function CockpitPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 bg-blue-500/10 text-blue-500">
                <LayoutDashboard className="mr-1 h-3 w-3" />
                Project Management
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Cockpit <span className="text-primary">Dashboard</span>
              </h1>
              <p className="text-muted-foreground mt-6 text-lg">
                A powerful command center for managing freelance teams, tracking project progress,
                and monitoring performance. Get real-time insights and analytics to make informed
                decisions.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Try Cockpit Free
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
              <LayoutDashboard className="text-primary h-32 w-32 opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Powerful Features</h2>
            <p className="text-muted-foreground mt-2">
              Everything you need to manage distributed teams
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              description="Track project progress, budget utilization, and team performance with live dashboards."
              icon={BarChart3}
              title="Real-Time Analytics"
            />
            <FeatureCard
              description="Manage multiple freelancers across projects. Assign tasks, set permissions, and track availability."
              icon={Users}
              title="Team Management"
            />
            <FeatureCard
              description="Automatic time tracking with SkillPod integration. Detailed breakdowns by task and project."
              icon={Clock}
              title="Time Tracking"
            />
            <FeatureCard
              description="Create, manage, and track contracts and milestones. Automated payment scheduling."
              icon={FileText}
              title="Contract Management"
            />
            <FeatureCard
              description="Centralized messaging with file sharing, video calls, and threaded discussions."
              icon={MessageSquare}
              title="Communication Hub"
            />
            <FeatureCard
              description="AI-powered insights on team productivity, project health, and risk indicators."
              icon={TrendingUp}
              title="Performance Insights"
            />
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your Command Center</h2>
            <p className="text-muted-foreground mt-2">See everything at a glance</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Users} label="Active Freelancers" trend="+2 this month" value="12" />
            <MetricCard icon={Zap} label="Active Projects" trend="3 due this week" value="8" />
            <MetricCard icon={Clock} label="Hours This Week" trend="92% billable" value="324" />
            <MetricCard icon={PieChart} label="Budget Used" trend="$12.4k remaining" value="68%" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Project Managers</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Unified view of all projects and teams" />
                  <BenefitItem text="Real-time progress tracking" />
                  <BenefitItem text="Automated status reports" />
                  <BenefitItem text="Risk and deadline alerts" />
                  <BenefitItem text="Resource allocation optimization" />
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Executives</h3>
                <ul className="space-y-3">
                  <BenefitItem text="High-level portfolio dashboards" />
                  <BenefitItem text="Budget and ROI tracking" />
                  <BenefitItem text="Team performance benchmarks" />
                  <BenefitItem text="Compliance and audit trails" />
                  <BenefitItem text="Custom reporting and exports" />
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integration */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4" variant="secondary">
                <Settings className="mr-1 h-3 w-3" />
                Integrations
              </Badge>
              <h2 className="text-3xl font-bold">Works With Your Tools</h2>
              <p className="text-muted-foreground mt-4">
                Cockpit integrates with popular project management, communication, and accounting
                tools. Sync data automatically and maintain your existing workflows.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <IntegrationBadge label="Slack" />
                <IntegrationBadge label="GitHub" />
                <IntegrationBadge label="Jira" />
                <IntegrationBadge label="QuickBooks" />
                <IntegrationBadge label="Notion" />
                <IntegrationBadge label="Zapier" />
              </div>
            </div>

            <div className="bg-muted/50 flex aspect-video items-center justify-center rounded-2xl">
              <Monitor className="text-muted-foreground/30 h-24 w-24" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Simple Pricing</h2>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            <PricingCard
              description="For individuals"
              features={[
                'Up to 3 freelancers',
                'Basic analytics',
                'Time tracking',
                'Email support',
              ]}
              name="Starter"
              price="Free"
            />
            <PricingCard
              highlighted
              description="For growing teams"
              features={[
                'Up to 25 freelancers',
                'Advanced analytics',
                'SkillPod integration',
                'Priority support',
              ]}
              name="Professional"
              period="/mo"
              price="$49"
            />
            <PricingCard
              description="For large organizations"
              features={[
                'Unlimited freelancers',
                'Custom integrations',
                'Dedicated success manager',
                'SLA guarantee',
              ]}
              name="Enterprise"
              price="Custom"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Take Control of Your Projects</h2>
          <p className="text-primary-foreground/80 mt-4">
            Start managing your freelance teams more effectively
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Get Started Free</Link>
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

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-2 flex items-center justify-between">
          <Icon className="text-muted-foreground h-5 w-5" />
        </div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-2 text-xs text-green-500">{trend}</div>
      </CardContent>
    </Card>
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

function IntegrationBadge({ label }: { label: string }) {
  return (
    <Badge className="px-4 py-2 text-sm" variant="secondary">
      {label}
    </Badge>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <Card className={highlighted ? 'border-primary shadow-lg' : ''}>
      <CardContent className="p-6">
        {highlighted && <Badge className="mb-4">Most Popular</Badge>}
        <h3 className="text-lg font-semibold">{name}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold">{price}</span>
          {period && <span className="text-muted-foreground">{period}</span>}
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        <ul className="mt-6 space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-6 w-full" variant={highlighted ? 'default' : 'outline'}>
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
