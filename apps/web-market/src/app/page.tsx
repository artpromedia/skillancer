'use client';

import { Button, Badge, Card, CardContent, Input } from '@skillancer/ui';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  DollarSign,
  Globe,
  Headphones,
  LayoutDashboard,
  Monitor,
  PenTool,
  Play,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Video,
  Zap,
  Building2,
  Megaphone,
  BarChart3,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

// ============================================================================
// Animated Counter Hook
// ============================================================================

function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
    }
  }, [startOnView]);

  useEffect(() => {
    if (startOnView && ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasStarted) {
            setHasStarted(true);
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, hasStarted]);

  return { count, ref };
}

// ============================================================================
// Rotating Text Component
// ============================================================================

function getRotatingTextClass(index: number, currentIndex: number): string {
  if (index === currentIndex) return 'translate-y-0 opacity-100';
  if (index < currentIndex) return '-translate-y-8 opacity-0';
  return 'translate-y-8 opacity-0';
}

function RotatingText({ words }: Readonly<{ words: string[] }>) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [words.length]);

  return (
    <span className="relative inline-block h-[1.2em] min-w-[280px] text-left align-bottom">
      {words.map((word, index) => (
        <span
          key={word}
          className={`absolute left-0 top-0 transition-all duration-500 ${getRotatingTextClass(index, currentIndex)}`}
        >
          <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {word}
          </span>
        </span>
      ))}
      {/* Invisible spacer to maintain width */}
      <span className="invisible">{words[0]}</span>
    </span>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function Home() {
  const rotatingWords = [
    'Developers',
    'Designers',
    'Executives',
    'Writers',
    'Marketers',
    'Data Scientists',
    'AI Experts',
  ];

  return (
    <div className="flex flex-col overflow-x-hidden">
      {/* Hero Section - Premium Design */}
      <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-blue-500/20 blur-3xl" />
          <div
            className="absolute right-1/4 top-1/3 h-80 w-80 animate-pulse rounded-full bg-purple-500/20 blur-3xl"
            style={{ animationDelay: '1s' }}
          />
          <div
            className="absolute bottom-1/4 left-1/3 h-72 w-72 animate-pulse rounded-full bg-pink-500/20 blur-3xl"
            style={{ animationDelay: '2s' }}
          />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px]" />

        <div className="container relative z-10 mx-auto flex min-h-[90vh] flex-col items-center justify-center px-4 py-20 text-center">
          {/* Top Badge */}
          <div className="animate-fade-in mb-8">
            <Badge className="border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 backdrop-blur-sm">
              <Sparkles className="mr-2 h-4 w-4" />
              #1 AI-Powered Freelance Marketplace
            </Badge>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 max-w-5xl text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Hire World-Class
            <br />
            <RotatingText words={rotatingWords} />
          </h1>

          <p className="mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl">
            Access 500,000+ verified professionals. Our SmartMatch AI finds your perfect match in
            minutes, not days. Secure payments. Guaranteed satisfaction.
          </p>

          {/* Search Bar - Premium Design */}
          <div className="mb-8 w-full max-w-3xl">
            <div className="flex overflow-hidden rounded-2xl bg-white shadow-2xl shadow-blue-500/10">
              <div className="flex flex-1 items-center gap-3 px-6">
                <Search className="h-5 w-5 text-slate-400" />
                <Input
                  className="h-16 border-0 bg-transparent text-lg focus-visible:ring-0"
                  placeholder='Try "React developer" or "Logo design"...'
                  type="text"
                />
              </div>
              <Button className="m-2 h-12 rounded-xl bg-emerald-500 px-8 text-base font-semibold text-white hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
                Find Talent
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Popular Searches */}
          <div className="mb-12 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-slate-500">Popular:</span>
            {[
              'Web Development',
              'UI/UX Design',
              'Mobile Apps',
              'AI & Machine Learning',
              'Content Writing',
            ].map((term) => (
              <Link
                key={term}
                href={`/jobs?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-slate-700 bg-slate-800/50 px-4 py-1.5 text-sm text-slate-300 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                {term}
              </Link>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-blue-500" />
              <span>Verified Talent</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span>4hr Avg Response</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-orange-500" />
              <span>4.9/5 Rating</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="flex h-10 w-6 items-start justify-center rounded-full border-2 border-slate-600 p-1">
            <div className="h-2 w-1 rounded-full bg-slate-400" />
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section className="border-b border-slate-200 bg-white py-12">
        <div className="container mx-auto px-4">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-slate-500">
            Trusted by innovative companies worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale md:gap-16">
            {['Aivo AI', 'Ceerion', 'TechFlow', 'Nexus Labs', 'DataPrime', 'CloudScale'].map(
              (company) => (
                <div key={company} className="text-xl font-bold text-slate-800 md:text-2xl">
                  {company}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Stats Section - Impactful Numbers */}
      <section className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-500 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 text-center text-white md:grid-cols-4">
            <AnimatedStat value={500} suffix="K+" label="Skilled Professionals" />
            <AnimatedStat value={100} suffix="K+" label="Projects Completed" />
            <AnimatedStat value={50} suffix="M+" label="Payments Processed" prefix="$" />
            <AnimatedStat value={150} suffix="+" label="Countries Covered" />
          </div>
        </div>
      </section>

      {/* Popular Services - Visual Cards */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4" variant="secondary">
              <Zap className="mr-1 h-3 w-3" />
              Browse Services
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Popular Professional Services
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Find the perfect talent for any project. Every category. Every skill level.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <ServiceCard
              title="Web Development"
              subtitle="Full-stack, Frontend, Backend"
              icon={Code2}
              color="blue"
              jobs={15420}
            />
            <ServiceCard
              title="UI/UX Design"
              subtitle="Web, Mobile, Product Design"
              icon={PenTool}
              color="purple"
              jobs={8930}
            />
            <ServiceCard
              title="Mobile Apps"
              subtitle="iOS, Android, React Native"
              icon={Smartphone}
              color="green"
              jobs={6250}
            />
            <ServiceCard
              title="AI & Machine Learning"
              subtitle="Models, Automation, Data"
              icon={Sparkles}
              color="orange"
              jobs={4180}
            />
            <ServiceCard
              title="Digital Marketing"
              subtitle="SEO, PPC, Social Media"
              icon={Megaphone}
              color="pink"
              jobs={7650}
            />
            <ServiceCard
              title="Video Production"
              subtitle="Editing, Animation, Motion"
              icon={Video}
              color="red"
              jobs={5320}
            />
            <ServiceCard
              title="Content Writing"
              subtitle="Copywriting, Blogs, Technical"
              icon={FileText}
              color="cyan"
              jobs={9100}
            />
            <ServiceCard
              title="Data Analytics"
              subtitle="Visualization, BI, Reports"
              icon={BarChart3}
              color="indigo"
              jobs={3840}
            />
          </div>

          <div className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Link href="/categories">
                Explore All 200+ Categories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {/* How It Works - Premium Visual Flow */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-16 text-center">
            <Badge className="mb-4" variant="secondary">
              <Play className="mr-1 h-3 w-3" />
              Get Started
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Start Working in 3 Simple Steps
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Whether you&apos;re hiring or looking for work, we make it effortless
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="absolute left-1/2 top-24 hidden h-0.5 w-2/3 -translate-x-1/2 bg-gradient-to-r from-emerald-200 via-blue-200 to-emerald-200 md:block" />

            <div className="grid gap-8 md:grid-cols-3">
              <ProcessStep
                number={1}
                title="Post Your Project"
                description="Describe your project, set your budget, and get matched with top talent in minutes."
                icon={Briefcase}
                color="blue"
              />
              <ProcessStep
                number={2}
                title="Review & Hire"
                description="Compare proposals, review portfolios, and hire the best fit for your needs."
                icon={Users}
                color="purple"
              />
              <ProcessStep
                number={3}
                title="Pay Securely"
                description="Release payment only when you're 100% satisfied. Full money-back guarantee."
                icon={ShieldCheck}
                color="pink"
              />
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-emerald-500 text-white hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
            >
              <Link href="/jobs/post">
                Post a Project Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Link href="/jobs">Browse Open Projects</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Talent Showcase */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4 border-blue-500/30 bg-blue-500/10 text-blue-300">
              <Star className="mr-1 h-3 w-3" />
              Top Rated
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Meet Our Top Talent
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
              Pre-vetted professionals ready to bring your vision to life
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TalentCard
              name="Alex Rivera"
              role="Senior Full Stack Developer"
              skills={['React', 'Node.js', 'AWS']}
              rating={4.9}
              jobs={287}
              rate="$85/hr"
            />
            <TalentCard
              name="Sarah Kim"
              role="UI/UX Design Lead"
              skills={['Figma', 'Webflow', 'Branding']}
              rating={5}
              jobs={195}
              rate="$95/hr"
            />
            <TalentCard
              name="Marcus Chen"
              role="AI/ML Engineer"
              skills={['Python', 'TensorFlow', 'GPT']}
              rating={4.8}
              jobs={142}
              rate="$120/hr"
            />
            <TalentCard
              name="Emma Wilson"
              role="Marketing Strategist"
              skills={['SEO', 'Content', 'Analytics']}
              rating={4.9}
              jobs={231}
              rate="$75/hr"
            />
          </div>

          <div className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-600 bg-transparent text-white hover:bg-slate-800"
            >
              <Link href="/talent">
                Browse All Talent
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us - Trust Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4" variant="secondary">
                <Shield className="mr-1 h-3 w-3" />
                Why Skillancer
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                The Platform Built for <span className="text-emerald-500">Success</span>
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Join 500,000+ professionals who trust Skillancer for secure, efficient, and
                successful freelance work.
              </p>

              <div className="mt-10 space-y-6">
                <TrustFeature
                  icon={ShieldCheck}
                  title="Secure Payment Protection"
                  description="Funds held in escrow until you approve. Never pay before you're satisfied."
                />
                <TrustFeature
                  icon={Sparkles}
                  title="SmartMatch AI Technology"
                  description="Our AI analyzes 50+ factors to match you with the perfect talent or opportunity."
                />
                <TrustFeature
                  icon={BadgeCheck}
                  title="Verified Professionals"
                  description="Every freelancer undergoes skill testing and background verification."
                />
                <TrustFeature
                  icon={Headphones}
                  title="24/7 Expert Support"
                  description="Our dedicated team is here to help you succeed, anytime."
                />
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 p-8">
                <div className="grid grid-cols-2 gap-4">
                  <StatBox value="95%" label="Project Success Rate" />
                  <StatBox value="24hr" label="Avg Time to Hire" />
                  <StatBox value="$0" label="Platform Fees for Buyers" />
                  <StatBox value="4.9★" label="Client Satisfaction" />
                </div>
                <div className="mt-6 rounded-2xl bg-white p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Money-Back Guarantee</div>
                      <div className="text-sm text-slate-500">100% refund if not satisfied</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Premium Features - SkillPod & Cockpit */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" />
              Exclusive Features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Tools That Set Us Apart
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Industry-first innovations for secure, transparent work
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            {/* SkillPod */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 to-purple-800 p-8 text-white transition-transform hover:scale-[1.02]">
              <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/4 translate-y-[-25%] rounded-full bg-purple-500/30 blur-3xl" />
              <div className="relative">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                    <Monitor className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">SkillPod VDI</h3>
                    <p className="text-purple-200">Secure Virtual Desktop</p>
                  </div>
                </div>
                <p className="mb-6 text-lg text-purple-100">
                  Work on sensitive projects in a secure, monitored virtual environment. Built-in
                  screen recording, time tracking, and data protection.
                </p>
                <ul className="mb-8 space-y-3">
                  {[
                    'Isolated secure environment',
                    'Automatic time tracking',
                    'Screen recording & DLP',
                    'Pre-installed dev tools',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-purple-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant="secondary"
                  className="bg-white text-purple-700 hover:bg-purple-50"
                >
                  <Link href="/skillpod">
                    Explore SkillPod
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Cockpit */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white transition-transform hover:scale-[1.02]">
              <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/4 translate-y-[-25%] rounded-full bg-blue-500/30 blur-3xl" />
              <div className="relative">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                    <LayoutDashboard className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Cockpit Dashboard</h3>
                    <p className="text-blue-200">Project Command Center</p>
                  </div>
                </div>
                <p className="mb-6 text-lg text-blue-100">
                  A powerful dashboard for managing freelance teams, tracking progress, and
                  monitoring performance with real-time analytics.
                </p>
                <ul className="mb-8 space-y-3">
                  {[
                    'Real-time analytics',
                    'Team management tools',
                    'Budget & milestone tracking',
                    'Performance insights',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-blue-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant="secondary"
                  className="bg-white text-blue-700 hover:bg-blue-50"
                >
                  <Link href="/cockpit">
                    Explore Cockpit
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Executive Suite - Full Width */}
          <div className="mt-8 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 to-orange-700 p-8 text-white transition-transform hover:scale-[1.01]">
            <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/4 translate-y-[-25%] rounded-full bg-amber-500/30 blur-3xl" />
            <div className="absolute left-0 bottom-0 h-48 w-48 translate-x-[-25%] translate-y-[25%] rounded-full bg-orange-400/20 blur-3xl" />
            <div className="relative">
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div>
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                      <Briefcase className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Fractional Executive Suite</h3>
                      <p className="text-amber-200">On-Demand C-Suite Leadership</p>
                    </div>
                  </div>
                  <p className="mb-6 text-lg text-amber-100">
                    Access vetted fractional CTOs, CFOs, CMOs, and more. Get enterprise-level leadership
                    at a fraction of the cost. Perfect for startups and growing companies.
                  </p>
                  <ul className="mb-8 grid grid-cols-2 gap-3">
                    {[
                      'Pre-vetted executives',
                      'LinkedIn verified',
                      'Flexible engagements',
                      'OKR tracking',
                      'Industry expertise',
                      'Background checked',
                    ].map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-amber-300" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-4">
                    <Button
                      asChild
                      variant="secondary"
                      className="bg-white text-amber-700 hover:bg-amber-50"
                    >
                      <Link href="/executives">
                        Browse Executives
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="border-white/30 text-white hover:bg-white/10"
                    >
                      <Link href="/hire/onboarding">
                        Request a Match
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { role: 'CTO', desc: 'Tech Strategy & Architecture' },
                      { role: 'CFO', desc: 'Financial Planning & Fundraising' },
                      { role: 'CMO', desc: 'Growth & Brand Strategy' },
                      { role: 'COO', desc: 'Operations & Scaling' },
                    ].map((exec) => (
                      <div key={exec.role} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                        <div className="text-lg font-bold">Fractional {exec.role}</div>
                        <div className="text-sm text-amber-200">{exec.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories / Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <Badge className="mb-4" variant="secondary">
              <Star className="mr-1 h-3 w-3" />
              Success Stories
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Loved by Thousands
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              See how companies and freelancers achieve amazing results on Skillancer
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <TestimonialCard
              quote="Skillancer's SmartMatch saved us weeks of searching. We found 5 amazing developers and shipped our product 2 months ahead of schedule."
              author="CTO"
              company="Aivo AI Learning Technologies Inc"
              rating={5}
              metric="2x faster hiring"
            />
            <TestimonialCard
              quote="The quality of talent here is exceptional. We've scaled our engineering team from 5 to 25 using Skillancer, all remote and fully integrated."
              author="VP of Engineering"
              company="Ceerion Inc"
              rating={5}
              metric="5x team growth"
            />
            <TestimonialCard
              quote="I went from struggling to find clients to having a 6-figure freelance business. The platform's reputation system opens incredible doors."
              author="Full Stack Developer"
              company="Independent Freelancer"
              rating={5}
              metric="$150K+ earned"
            />
          </div>

          <div className="mt-10 text-center">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Link href="/success-stories">
                Read More Success Stories
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge className="mb-4 border-blue-500/30 bg-blue-500/10 text-blue-300">
                <Building2 className="mr-1 h-3 w-3" />
                Enterprise Solutions
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Scale Your Team with Confidence
              </h2>
              <p className="mt-4 text-lg text-slate-400">
                Enterprise-grade tools for companies that need to scale fast, stay compliant, and
                maintain full control.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-6">
                <EnterpriseFeature icon={Shield} title="SOC 2 Compliant" />
                <EnterpriseFeature icon={Users} title="Dedicated Account Team" />
                <EnterpriseFeature icon={BarChart3} title="Advanced Analytics" />
                <EnterpriseFeature icon={DollarSign} title="Custom Billing" />
                <EnterpriseFeature icon={Globe} title="Global Payroll" />
                <EnterpriseFeature icon={Clock} title="SLA Guarantees" />
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  <Link href="/enterprise">
                    Learn About Enterprise
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-slate-600 bg-transparent text-white hover:bg-slate-800"
                >
                  <Link href="/contact">Contact Sales</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-800 p-8">
              <h3 className="mb-6 text-xl font-semibold">Trusted by leading companies</h3>
              <div className="grid grid-cols-2 gap-4">
                {['Aivo AI', 'Ceerion', 'TechFlow', 'Nexus Labs'].map((company) => (
                  <div
                    key={company}
                    className="rounded-xl bg-slate-700/50 p-4 text-center text-lg font-semibold text-slate-300"
                  >
                    {company}
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-slate-700 pt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Average enterprise savings</span>
                  <span className="text-2xl font-bold text-green-400">47%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* For Freelancers */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-emerald-700 p-10 text-white transition-transform hover:scale-[1.02]">
              <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/4 translate-y-[-25%] rounded-full bg-green-400/30 blur-3xl" />
              <div className="relative">
                <Badge className="mb-4 bg-white/20 text-white">
                  <Briefcase className="mr-1 h-3 w-3" />
                  For Freelancers
                </Badge>
                <h3 className="mb-4 text-3xl font-bold">Find Your Next Opportunity</h3>
                <p className="mb-6 text-lg text-green-100">
                  Access thousands of projects from verified clients worldwide. Set your rates, work
                  on your terms, get paid securely.
                </p>
                <ul className="mb-8 space-y-2">
                  {[
                    'No fees until you get paid',
                    'Build your reputation',
                    'Access premium clients',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" className="bg-white text-green-700 hover:bg-green-50">
                  <Link href="/jobs">
                    Browse Projects
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* For Clients */}
            <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-10 text-white transition-transform hover:scale-[1.02]">
              <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/4 translate-y-[-25%] rounded-full bg-emerald-400/30 blur-3xl" />
              <div className="relative">
                <Badge className="mb-4 bg-white/20 text-white">
                  <Users className="mr-1 h-3 w-3" />
                  For Clients
                </Badge>
                <h3 className="mb-4 text-3xl font-bold">Hire Top Talent Today</h3>
                <p className="mb-6 text-lg text-emerald-100">
                  Post your project free and receive proposals from skilled professionals within
                  hours. Pay only when satisfied.
                </p>
                <ul className="mb-8 space-y-2">
                  {['Free to post projects', 'Pay only when satisfied', 'Money-back guarantee'].map(
                    (item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
                <Button asChild size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
                  <Link href="/jobs/post">
                    Post a Project Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Bold Full-Width */}
      <section className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-emerald-900 to-slate-900 py-24">
        <div className="absolute inset-0">
          <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center text-white">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Ready to Get Started?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-300">
            Join over 500,000 professionals finding work and hiring talent on Skillancer. Start for
            free today.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-14 bg-emerald-500 px-8 text-lg text-white hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
            >
              <Link href="/signup">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 border-white/30 bg-transparent px-8 text-lg text-white hover:bg-white/10"
            >
              <Link href="/how-it-works">
                See How It Works
                <Play className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-slate-400">
            No credit card required • Free forever plan available • Cancel anytime
          </p>
        </div>
      </section>
    </div>
  );
}
// ============================================================================
// Sub-components
// ============================================================================

function AnimatedStat({
  value,
  suffix = '',
  prefix = '',
  label,
}: Readonly<{ value: number; suffix?: string; prefix?: string; label: string }>) {
  const { count, ref } = useCountUp(value);
  return (
    <div ref={ref} className="relative">
      <div className="text-4xl font-bold md:text-5xl">
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </div>
      <div className="mt-2 text-sm text-white/80 md:text-base">{label}</div>
    </div>
  );
}

function ServiceCard({
  title,
  subtitle,
  icon: Icon,
  color,
  jobs,
}: Readonly<{
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  jobs: number;
}>) {
  const colorClasses: Record<string, { bg: string; text: string; hover: string }> = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      hover: 'hover:border-blue-300 hover:shadow-blue-100',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      hover: 'hover:border-purple-300 hover:shadow-purple-100',
    },
    green: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      hover: 'hover:border-emerald-300 hover:shadow-emerald-100',
    },
    orange: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      hover: 'hover:border-amber-300 hover:shadow-amber-100',
    },
    pink: {
      bg: 'bg-pink-50',
      text: 'text-pink-600',
      hover: 'hover:border-pink-300 hover:shadow-pink-100',
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      hover: 'hover:border-red-300 hover:shadow-red-100',
    },
    cyan: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-600',
      hover: 'hover:border-cyan-300 hover:shadow-cyan-100',
    },
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      hover: 'hover:border-indigo-300 hover:shadow-indigo-100',
    },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <Link href={`/jobs?category=${title.toLowerCase().replaceAll(/\s+/g, '-')}`}>
      <Card
        className={`group h-full cursor-pointer border-2 transition-all duration-300 ${colors.hover} hover:shadow-lg`}
      >
        <CardContent className="p-6">
          <div
            className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${colors.bg} transition-transform group-hover:scale-110`}
          >
            <Icon className={`h-7 w-7 ${colors.text}`} />
          </div>
          <h3 className="mb-1 text-lg font-semibold group-hover:text-slate-900">{title}</h3>
          <p className="mb-3 text-sm text-slate-500">{subtitle}</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">{jobs.toLocaleString()} jobs</span>
            <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ProcessStep({
  number,
  title,
  description,
  icon: Icon,
  color,
}: Readonly<{
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}>) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-emerald-500 to-emerald-600',
    pink: 'from-slate-600 to-slate-700',
  };

  return (
    <div className="relative text-center">
      <div
        className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${colorClasses[color]} text-white shadow-lg`}
      >
        <Icon className="h-10 w-10" />
      </div>
      <div className="absolute -right-4 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
        {number}
      </div>
      <h3 className="mb-3 text-xl font-semibold">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function TalentCard({
  name,
  role,
  skills,
  rating,
  jobs,
  rate,
}: Readonly<{
  name: string;
  role: string;
  skills: string[];
  rating: number;
  jobs: number;
  rate: string;
}>) {
  return (
    <Card className="border-slate-700 bg-slate-800 transition-transform hover:scale-105">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-xl font-bold text-white">
            {name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <h4 className="font-semibold text-white">{name}</h4>
            <p className="text-sm text-slate-400">{role}</p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300"
            >
              {skill}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-700 pt-4">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
            <span className="text-sm font-medium text-white">{rating}</span>
            <span className="text-sm text-slate-400">({jobs})</span>
          </div>
          <span className="font-semibold text-green-400">{rate}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TrustFeature({
  icon: Icon,
  title,
  description,
}: Readonly<{ icon: React.ElementType; title: string; description: string }>) {
  return (
    <div className="flex gap-4">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
        <Icon className="h-6 w-6 text-blue-600" />
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function StatBox({ value, label }: Readonly<{ value: string; label: string }>) {
  return (
    <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

function TestimonialCard({
  quote,
  author,
  company,
  rating,
  metric,
}: Readonly<{ quote: string; author: string; company: string; rating: number; metric: string }>) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-0.5">
            {Array.from({ length: rating }, (_, i) => i + 1).map((starNum) => (
              <Star key={`star-${starNum}`} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            {metric}
          </Badge>
        </div>
        <p className="mb-6 text-slate-600">&ldquo;{quote}&rdquo;</p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
            {author.split(' ').at(-1)?.[0] ?? 'U'}
          </div>
          <div>
            <div className="font-semibold">{author}</div>
            <div className="text-sm text-slate-500">{company}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnterpriseFeature({
  icon: Icon,
  title,
}: Readonly<{ icon: React.ElementType; title: string }>) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-700">
        <Icon className="h-5 w-5 text-blue-400" />
      </div>
      <span className="text-slate-300">{title}</span>
    </div>
  );
}
