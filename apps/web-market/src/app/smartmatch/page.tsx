'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Briefcase,
  CheckCircle2,
  Clock,
  Play,
  Search,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function SmartMatchPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 bg-emerald-500/10 text-emerald-500">
                <Sparkles className="mr-1 h-3 w-3" />
                AI-Powered Matching
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                SmartMatch <span className="text-primary">AI</span>
              </h1>
              <p className="text-muted-foreground mt-6 text-lg">
                Find your perfect match in minutes, not days. Our AI analyzes 50+ factors to connect
                the right talent with the right opportunities — so you spend less time searching and
                more time building.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Get Matched Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/how-it-works">
                    <Play className="mr-2 h-4 w-4" />
                    See How It Works
                  </Link>
                </Button>
              </div>
              <div className="text-muted-foreground mt-6 flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  50+ matching factors
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  95% satisfaction rate
                </span>
              </div>
            </div>

            <div className="from-primary/20 via-primary/10 flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br to-transparent">
              <Brain className="text-primary h-32 w-32 opacity-30" />
            </div>
          </div>
        </div>
      </section>

      {/* Match Score Breakdown */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              7 Dimensions of Matching
            </h2>
            <p className="text-muted-foreground mt-2">
              Our AI evaluates every candidate across seven key dimensions to find the best fit
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ScoreDimensionCard
              color="bg-blue-500"
              description="Technical skills alignment with project requirements"
              icon={Target}
              score={95}
              title="Skills Match"
            />
            <ScoreDimensionCard
              color="bg-purple-500"
              description="Years of relevant industry and domain experience"
              icon={Briefcase}
              score={88}
              title="Experience"
            />
            <ScoreDimensionCard
              color="bg-green-500"
              description="Verification level, reviews, and platform reputation"
              icon={Shield}
              score={92}
              title="Trust Score"
            />
            <ScoreDimensionCard
              color="bg-amber-500"
              description="Budget alignment and value for investment"
              icon={BarChart3}
              score={85}
              title="Rate Fit"
            />
            <ScoreDimensionCard
              color="bg-cyan-500"
              description="Current workload and schedule compatibility"
              icon={Clock}
              score={90}
              title="Availability"
            />
            <ScoreDimensionCard
              color="bg-rose-500"
              description="Track record of completed projects and milestones"
              icon={TrendingUp}
              score={91}
              title="Success History"
            />
            <ScoreDimensionCard
              color="bg-indigo-500"
              description="Communication speed and engagement quality"
              icon={Zap}
              score={87}
              title="Responsiveness"
            />
            <Card className="border-primary border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-primary/10 mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                  <Sparkles className="text-primary h-6 w-6" />
                </div>
                <h3 className="mb-1 font-semibold">Overall Score</h3>
                <div className="text-primary text-3xl font-bold">90%</div>
                <p className="text-muted-foreground mt-1 text-xs">Weighted composite</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Intelligent Features</h2>
            <p className="text-muted-foreground mt-2">More than simple keyword matching</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              description="Our model learns from successful hires, project outcomes, and feedback to continuously improve match quality."
              icon={Brain}
              title="Machine Learning"
            />
            <FeatureCard
              description="Instantly surface the top candidates when you post a job. No more scrolling through hundreds of profiles."
              icon={Search}
              title="Instant Matching"
            />
            <FeatureCard
              description="See exactly why each candidate was recommended with transparent, explainable scoring breakdowns."
              icon={BarChart3}
              title="Explainable Scores"
            />
            <FeatureCard
              description="SmartMatch learns your hiring preferences over time and adapts recommendations to your team's needs."
              icon={Sparkles}
              title="Personalized Results"
            />
            <FeatureCard
              description="Get notified when a high-match candidate becomes available or when a perfect job is posted."
              icon={Zap}
              title="Proactive Alerts"
            />
            <FeatureCard
              description="Find freelancers similar to your top performers. Clone the qualities that drive project success."
              icon={Users}
              title="Similar Talent Discovery"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How SmartMatch Works</h2>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="space-y-8">
              <StepItem
                description="Post a job with your requirements, or create your freelancer profile with your skills and experience."
                step={1}
                title="Describe What You Need"
              />
              <StepItem
                description="Our AI analyzes 50+ factors including skills, experience, trust scores, rate alignment, and work history."
                step={2}
                title="AI Analyzes & Scores"
              />
              <StepItem
                description="Review ranked candidates with clear match scores and dimension breakdowns. Understand exactly why each was recommended."
                step={3}
                title="Review Ranked Matches"
              />
              <StepItem
                description="Connect with your top matches directly. SmartMatch continues learning from your hiring decisions."
                step={4}
                title="Hire with Confidence"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Why Teams Love SmartMatch
            </h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Clients</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Find the right freelancer 5x faster" />
                  <BenefitItem text="Reduce hiring mistakes with data-driven matching" />
                  <BenefitItem text="See transparent scoring — no black box" />
                  <BenefitItem text="Get proactive alerts for high-match talent" />
                  <BenefitItem text="Discover similar freelancers to your best hires" />
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8">
                <h3 className="mb-6 text-xl font-bold">For Freelancers</h3>
                <ul className="space-y-3">
                  <BenefitItem text="Get matched with jobs that fit your skills" />
                  <BenefitItem text="Higher win rate on matched proposals" />
                  <BenefitItem text="Stand out with verified skill scores" />
                  <BenefitItem text="No more wasting time on bad-fit projects" />
                  <BenefitItem text="Build a reputation that the AI recognizes" />
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
            <StatCard label="Faster hiring" value="5x" />
            <StatCard label="Match accuracy" value="95%" />
            <StatCard label="Matching factors" value="50+" />
            <StatCard label="Client satisfaction" value="4.9/5" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to Find Your Perfect Match?</h2>
          <p className="text-primary-foreground/80 mt-4">
            Join thousands of businesses using SmartMatch AI to build world-class teams
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              size="lg"
              variant="outline"
            >
              <Link href="/jobs">Browse Jobs</Link>
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

function ScoreDimensionCard({
  icon: Icon,
  title,
  description,
  score,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  score: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}/10`}>
            <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
          </div>
          <span className="text-2xl font-bold">{score}%</span>
        </div>
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
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
