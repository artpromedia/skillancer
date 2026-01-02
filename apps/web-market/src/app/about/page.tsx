'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  Globe,
  Heart,
  Lightbulb,
  Monitor,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="secondary">
              <Heart className="mr-1 h-3 w-3" />
              Our Story
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Reimagining the Future of <span className="text-primary">Work</span>
            </h1>
            <p className="text-muted-foreground mt-6 text-lg">
              Skillancer is building the most trusted platform for freelance work, powered by AI
              matching, skill verification, and secure collaboration tools.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-primary/20">
              <CardContent className="p-8">
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                  <Target className="text-primary h-6 w-6" />
                </div>
                <h2 className="mb-4 text-2xl font-bold">Our Mission</h2>
                <p className="text-muted-foreground">
                  To democratize opportunity by connecting talented professionals with meaningful
                  work, regardless of geography. We believe everyone deserves access to quality
                  opportunities and fair compensation.
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="p-8">
                <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                  <Lightbulb className="text-primary h-6 w-6" />
                </div>
                <h2 className="mb-4 text-2xl font-bold">Our Vision</h2>
                <p className="text-muted-foreground">
                  A world where talent is recognized and rewarded fairly, where remote work is
                  seamless and secure, and where professionals can build meaningful careers on their
                  own terms.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              What Makes Us Different
            </h2>
            <p className="text-muted-foreground mt-2">
              Industry-leading features that set Skillancer apart
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              description="Our proprietary algorithm matches skills, experience, and work style to find the perfect fit for every project."
              icon={Sparkles}
              title="SmartMatch AI"
            />
            <FeatureCard
              description="Secure virtual desktop environment with activity monitoring, screen recording, and data loss prevention."
              icon={Monitor}
              title="SkillPod VDI"
            />
            <FeatureCard
              description="Real-time project management, analytics, and team oversight for enterprise clients."
              icon={Zap}
              title="Cockpit Dashboard"
            />
            <FeatureCard
              description="AI-proctored assessments verify freelancer skills with industry-recognized certifications."
              icon={Award}
              title="Skill Verification"
            />
            <FeatureCard
              description="Escrow system ensures freelancers get paid and clients get quality work."
              icon={Shield}
              title="Payment Protection"
            />
            <FeatureCard
              description="Access to 500,000+ verified professionals from 150+ countries."
              icon={Globe}
              title="Global Talent Pool"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <StatCard icon={Users} label="Freelancers" value="500K+" />
            <StatCard icon={Briefcase} label="Jobs Posted" value="100K+" />
            <StatCard icon={Award} label="Paid to Freelancers" value="$50M+" />
            <StatCard icon={Globe} label="Countries" value="150+" />
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Our Values</h2>
            <p className="text-muted-foreground mt-2">The principles that guide everything we do</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ValueCard
              description="Building transparent relationships between clients and freelancers."
              title="Trust"
            />
            <ValueCard
              description="Maintaining high standards through verification and reviews."
              title="Quality"
            />
            <ValueCard
              description="Continuously improving with AI and cutting-edge technology."
              title="Innovation"
            />
            <ValueCard
              description="Ensuring equitable opportunities and fair compensation."
              title="Fairness"
            />
          </div>
        </div>
      </section>

      {/* Enterprise */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4" variant="secondary">
                <Building2 className="mr-1 h-3 w-3" />
                Enterprise
              </Badge>
              <h2 className="text-3xl font-bold">Built for Enterprise</h2>
              <p className="text-muted-foreground mt-4">
                Skillancer Enterprise provides large organizations with dedicated support,
                compliance features, and advanced security controls to manage distributed teams at
                scale.
              </p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-2">
                  <Shield className="text-primary h-5 w-5" />
                  <span>SOC 2 Type II Certified</span>
                </li>
                <li className="flex items-center gap-2">
                  <Rocket className="text-primary h-5 w-5" />
                  <span>Dedicated Account Management</span>
                </li>
                <li className="flex items-center gap-2">
                  <Users className="text-primary h-5 w-5" />
                  <span>Custom Team Workflows</span>
                </li>
              </ul>
              <div className="mt-8">
                <Button asChild size="lg">
                  <Link href="/enterprise">
                    Learn More
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="bg-muted/50 flex aspect-video items-center justify-center rounded-2xl">
              <Building2 className="text-muted-foreground/30 h-24 w-24" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Join the Future of Work</h2>
          <p className="text-primary-foreground/80 mt-4">
            Start your journey with Skillancer today
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button
              asChild
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              size="lg"
              variant="outline"
            >
              <Link href="/how-it-works">How It Works</Link>
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

function StatCard({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: React.ElementType;
}) {
  return (
    <div className="text-center">
      <Icon className="text-primary mx-auto mb-3 h-8 w-8" />
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function ValueCard({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}
