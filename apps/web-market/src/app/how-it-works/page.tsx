'use client';

import { Button, Card, CardContent, Badge } from '@skillancer/ui';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Handshake,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  Star,
  User,
  UserCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background bg-gradient-to-b py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" />
              Simple & Secure
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              How <span className="text-primary">Skillancer</span> Works
            </h1>
            <p className="text-muted-foreground mt-6 text-lg">
              Whether you&apos;re a freelancer looking for work or a client seeking talent, our
              platform makes it easy to connect, collaborate, and succeed.
            </p>
          </div>
        </div>
      </section>

      {/* Tabs: Freelancer vs Client */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* For Freelancers */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                  <User className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">For Freelancers</h2>
                  <p className="text-muted-foreground">Find work that matches your skills</p>
                </div>
              </div>

              <div className="space-y-6">
                <StepCard
                  description="Showcase your skills, experience, and portfolio. Complete your profile to increase visibility and get verified."
                  icon={UserCheck}
                  step={1}
                  title="Create Your Profile"
                />
                <StepCard
                  description="Browse thousands of job listings or let SmartMatch recommend opportunities based on your skills and preferences."
                  icon={Search}
                  step={2}
                  title="Find Jobs"
                />
                <StepCard
                  description="Write compelling proposals that showcase your expertise. Set your rates and explain why you're the perfect fit."
                  icon={FileText}
                  step={3}
                  title="Submit Proposals"
                />
                <StepCard
                  description="Once accepted, work directly with clients through our platform. Use SkillPod for secure, monitored work sessions."
                  icon={Handshake}
                  step={4}
                  title="Get Hired"
                />
                <StepCard
                  description="Receive payments through our escrow system. Funds are released when milestones are approved."
                  icon={DollarSign}
                  step={5}
                  title="Get Paid Securely"
                />
              </div>

              <div className="mt-8">
                <Button asChild size="lg">
                  <Link href="/jobs">
                    Browse Jobs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* For Clients */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <Zap className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">For Clients</h2>
                  <p className="text-muted-foreground">Hire verified professionals</p>
                </div>
              </div>

              <div className="space-y-6">
                <StepCard
                  description="Describe your project, set your budget, and specify required skills. Our AI helps optimize your listing."
                  icon={FileText}
                  step={1}
                  title="Post Your Job"
                />
                <StepCard
                  description="SmartMatch analyzes proposals and ranks candidates based on skills, experience, and job success rate."
                  icon={Sparkles}
                  step={2}
                  title="Get Matched"
                />
                <StepCard
                  description="Chat with candidates, review portfolios, and conduct interviews. Hire with confidence."
                  icon={MessageSquare}
                  step={3}
                  title="Interview & Hire"
                />
                <StepCard
                  description="Monitor progress through Cockpit dashboard. Funds are held in escrow until you approve work."
                  icon={Shield}
                  step={4}
                  title="Work Securely"
                />
                <StepCard
                  description="Leave feedback to help other clients and build your reputation as a great employer."
                  icon={Star}
                  step={5}
                  title="Rate & Review"
                />
              </div>

              <div className="mt-8">
                <Button asChild size="lg" variant="outline">
                  <Link href="/jobs/post">
                    Post a Job
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Platform Features</h2>
            <p className="text-muted-foreground mt-2">
              Tools designed to make freelancing better for everyone
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              description="Our AI algorithm analyzes skills, experience, and preferences to match freelancers with the perfect opportunities."
              icon={Sparkles}
              title="SmartMatch AI"
            />
            <FeatureCard
              description="All payments are held securely in escrow. Funds are only released when both parties are satisfied."
              icon={Shield}
              title="Escrow Protection"
            />
            <FeatureCard
              description="Freelancers can verify their skills through assessments and AI-proctored tests for added credibility."
              icon={CheckCircle2}
              title="Skill Verification"
            />
            <FeatureCard
              description="Secure virtual desktop environment for working on sensitive projects with activity monitoring."
              icon={Clock}
              title="SkillPod VDI"
            />
            <FeatureCard
              description="Real-time analytics and project management for clients to track progress and manage teams."
              icon={Zap}
              title="Cockpit Dashboard"
            />
            <FeatureCard
              description="Built-in chat, video calls, and file sharing to collaborate seamlessly without leaving the platform."
              icon={MessageSquare}
              title="Integrated Messaging"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="text-muted-foreground mt-4">
            Join thousands of professionals on Skillancer
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/signup">Create Free Account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
          {step}
        </div>
      </div>
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Icon className="text-muted-foreground h-4 w-4" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
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
