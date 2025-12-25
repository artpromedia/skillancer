import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  Clock,
  DollarSign,
  Search,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import { Button, Badge, Card, CardContent } from '@skillancer/ui';

import { SearchBar } from '@/components/search/search-bar';
import { getFeaturedJobs, getTopCategories, type Job, type Category } from '@/lib/api/jobs';

// ============================================================================
// Data Fetching
// ============================================================================

async function getHomePageData() {
  const [featuredJobs, categories] = await Promise.all([
    getFeaturedJobs(6).catch(() => [] as Job[]),
    getTopCategories(8).catch(() => [] as Category[]),
  ]);

  return { featuredJobs, categories };
}

// ============================================================================
// Page Component
// ============================================================================

export default async function Home() {
  const { featuredJobs, categories } = await getHomePageData();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="from-primary/5 via-background to-background relative overflow-hidden bg-gradient-to-b py-20 sm:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              AI-Powered Matching
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Find the perfect match for
              <span className="text-primary"> your next project</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
              Skillancer's SmartMatch algorithm connects you with top talent or the right
              opportunities. Secure payments, verified professionals, and AI-powered matching.
            </p>

            {/* Search Bar */}
            <div className="mx-auto mt-10 max-w-2xl">
              <SearchBar
                placeholder="Search for jobs, skills, or keywords..."
                className="shadow-lg"
              />
            </div>

            {/* Quick Links */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
              <span className="text-muted-foreground">Popular:</span>
              {['React', 'Web Design', 'Mobile App', 'Data Science', 'AI/ML'].map((term) => (
                <Link
                  key={term}
                  href={`/jobs?q=${encodeURIComponent(term)}`}
                  className="text-primary hover:underline"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="bg-primary/10 absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted/30 border-y py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <StatItem icon={Users} value="500K+" label="Freelancers" />
            <StatItem icon={Briefcase} value="100K+" label="Jobs Posted" />
            <StatItem icon={DollarSign} value="$50M+" label="Paid Out" />
            <StatItem icon={Star} value="4.9" label="Average Rating" />
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      {categories.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Browse by Category
                </h2>
                <p className="text-muted-foreground mt-2">Find work in your area of expertise</p>
              </div>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/categories">
                  View all categories
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <Link key={category.id} href={`/jobs?category=${category.slug}`}>
                  <Card className="hover:border-primary/50 group h-full transition-all hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 group-hover:bg-primary/20 flex h-10 w-10 items-center justify-center rounded-lg transition-colors">
                          <CategoryIcon category={category.slug} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="group-hover:text-primary truncate font-semibold transition-colors">
                            {category.name}
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            {category.jobCount.toLocaleString()} jobs
                          </p>
                        </div>
                        <ArrowRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center sm:hidden">
              <Button variant="outline" asChild>
                <Link href="/categories">View all categories</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Featured Jobs */}
      {featuredJobs.length > 0 && (
        <section className="bg-muted/30 py-16 sm:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Latest Opportunities
                </h2>
                <p className="text-muted-foreground mt-2">Fresh jobs posted by verified clients</p>
              </div>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href="/jobs">
                  View all jobs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredJobs.slice(0, 6).map((job) => (
                <FeaturedJobCard key={job.id} job={job} />
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button size="lg" asChild>
                <Link href="/jobs">
                  Browse All Jobs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How Skillancer Works</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
              Get started in minutes. Our platform makes it easy to find work or hire talent.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              icon={Search}
              title="Find the Right Match"
              description="Search for jobs or talent. Our SmartMatch algorithm shows you the most relevant opportunities based on your skills."
            />
            <StepCard
              step={2}
              icon={Briefcase}
              title="Submit Proposals"
              description="Send personalized proposals to clients. Include your portfolio, rates, and why you're the perfect fit."
            />
            <StepCard
              step={3}
              icon={DollarSign}
              title="Get Paid Securely"
              description="Work with confidence using our escrow system. Funds are released only when both parties are satisfied."
            />
          </div>
        </div>
      </section>

      {/* Why Choose Skillancer */}
      <section className="bg-muted/30 py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Why Choose Skillancer?
              </h2>
              <p className="text-muted-foreground mt-4">
                Join thousands of professionals who trust Skillancer for their freelance careers and
                hiring needs.
              </p>

              <ul className="mt-8 space-y-4">
                <FeatureItem
                  icon={Sparkles}
                  title="SmartMatch AI"
                  description="Our proprietary algorithm matches you with opportunities that fit your skills and preferences."
                />
                <FeatureItem
                  icon={Shield}
                  title="Verified & Secure"
                  description="All payments are protected by escrow. Every freelancer is verified for quality assurance."
                />
                <FeatureItem
                  icon={Zap}
                  title="Fast & Efficient"
                  description="Average time to first proposal: 4 hours. Get started on projects quickly."
                />
                <FeatureItem
                  icon={TrendingUp}
                  title="Career Growth"
                  description="Build your reputation with ratings and reviews. Unlock higher-tier opportunities."
                />
              </ul>
            </div>

            <div className="relative">
              <div className="from-primary/20 via-primary/10 flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br to-transparent p-8">
                <div className="grid w-full max-w-sm grid-cols-2 gap-4">
                  <MiniStatCard value="95%" label="Success Rate" />
                  <MiniStatCard value="24hr" label="Avg Response" />
                  <MiniStatCard value="150+" label="Countries" />
                  <MiniStatCard value="4.9★" label="Rating" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Sections */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* For Freelancers */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
                  <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
                    For Freelancers
                  </Badge>
                  <h3 className="mb-2 text-2xl font-bold">Find Your Next Opportunity</h3>
                  <p className="mb-6 text-blue-100">
                    Access thousands of jobs from verified clients. Set your own rates and work on
                    your terms.
                  </p>
                  <Button variant="secondary" size="lg" asChild>
                    <Link href="/jobs">
                      Browse Jobs
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* For Clients */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-8 text-white">
                  <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
                    For Clients
                  </Badge>
                  <h3 className="mb-2 text-2xl font-bold">Hire Top Talent Today</h3>
                  <p className="mb-6 text-green-100">
                    Post your job and receive proposals from skilled freelancers within hours. Pay
                    only when satisfied.
                  </p>
                  <Button variant="secondary" size="lg" asChild>
                    <Link href="/jobs/post">
                      Post a Job
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/30 py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Trusted by Thousands</h2>
            <p className="text-muted-foreground mt-2">See what our community has to say</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <TestimonialCard
              quote="Skillancer's SmartMatch saved me hours of searching. I found the perfect developer for my project within a day."
              author="Sarah Chen"
              role="Startup Founder"
              rating={5}
            />
            <TestimonialCard
              quote="The quality of clients on this platform is exceptional. I've grown my freelance business by 3x since joining."
              author="Marcus Johnson"
              role="Full Stack Developer"
              rating={5}
            />
            <TestimonialCard
              quote="Secure payments and great support. I feel confident hiring through Skillancer for all my design needs."
              author="Emily Rodriguez"
              role="Marketing Director"
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground py-20 sm:py-28">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to get started?</h2>
          <p className="text-primary-foreground/80 mx-auto mt-4 max-w-xl">
            Join over 500,000 professionals finding work and hiring talent on Skillancer.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">Create Free Account</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <Link href="/how-it-works">Learn More</Link>
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

function StatItem({
  icon: Icon,
  value,
  label,
}: Readonly<{
  icon: React.ElementType;
  value: string;
  label: string;
}>) {
  return (
    <div className="text-center">
      <div className="mb-2 flex justify-center">
        <Icon className="text-primary h-6 w-6" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-muted-foreground text-sm">{label}</div>
    </div>
  );
}

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: Readonly<{
  step: number;
  icon: React.ElementType;
  title: string;
  description: string;
}>) {
  return (
    <div className="relative text-center">
      <div className="bg-primary text-primary-foreground mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold">
        {step}
      </div>
      <div className="mb-3 flex justify-center">
        <Icon className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: Readonly<{
  icon: React.ElementType;
  title: string;
  description: string;
}>) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Icon className="text-primary h-5 w-5" />
        </div>
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </li>
  );
}

function MiniStatCard({ value, label }: Readonly<{ value: string; label: string }>) {
  return (
    <div className="bg-background rounded-xl p-4 text-center shadow-sm">
      <div className="text-primary text-xl font-bold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

function FeaturedJobCard({ job }: Readonly<{ job: Job }>) {
  return (
    <Link href={`/jobs/${job.slug}`}>
      <Card className="hover:border-primary/50 group h-full transition-all hover:shadow-md">
        <CardContent className="p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <Badge variant="outline" className="text-xs">
              {job.budgetType === 'HOURLY' ? 'Hourly' : 'Fixed'}
            </Badge>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(job.createdAt)}
            </span>
          </div>

          <h3 className="group-hover:text-primary mb-2 line-clamp-2 font-semibold transition-colors">
            {job.title}
          </h3>

          <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
            {job.description.slice(0, 100)}...
          </p>

          <div className="mb-4 flex flex-wrap gap-1">
            {job.skills.slice(0, 3).map((skill) => (
              <Badge key={skill.id} variant="secondary" className="text-xs">
                {skill.name}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-green-600" />
              {formatBudgetShort(job)}
            </div>
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <Users className="h-3 w-3" />
              {job.proposalCount} proposals
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function TestimonialCard({
  quote,
  author,
  role,
  rating,
}: Readonly<{
  quote: string;
  author: string;
  role: string;
  rating: number;
}>) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex gap-0.5">
          {Array.from({ length: rating }).map((_, i) => (
            <Star key={`star-${i}`} className="h-4 w-4 fill-current text-yellow-500" />
          ))}
        </div>
        <p className="text-muted-foreground mb-4">&ldquo;{quote}&rdquo;</p>
        <div>
          <div className="font-semibold">{author}</div>
          <div className="text-muted-foreground text-sm">{role}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryIcon({ category }: Readonly<{ category: string }>) {
  // Simple icon mapping based on category slug
  const iconClass = 'h-5 w-5 text-primary';

  switch (category.toLowerCase()) {
    case 'development':
    case 'web-development':
      return <span className={iconClass}>💻</span>;
    case 'design':
    case 'graphic-design':
      return <span className={iconClass}>🎨</span>;
    case 'writing':
    case 'content-writing':
      return <span className={iconClass}>✍️</span>;
    case 'marketing':
    case 'digital-marketing':
      return <span className={iconClass}>📈</span>;
    case 'video':
    case 'video-editing':
      return <span className={iconClass}>🎬</span>;
    case 'data':
    case 'data-science':
      return <span className={iconClass}>📊</span>;
    case 'mobile':
    case 'mobile-development':
      return <span className={iconClass}>📱</span>;
    default:
      return <Briefcase className={iconClass} />;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function formatBudgetShort(job: Job): string {
  const { budgetType, budgetMin, budgetMax } = job;

  if (!budgetMin && !budgetMax) return 'TBD';

  const format = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
    return `$${n}`;
  };

  if (budgetType === 'HOURLY') {
    if (budgetMax) return `${format(budgetMax)}/hr`;
    return `${format(budgetMin!)}/hr`;
  }

  if (budgetMax) return format(budgetMax);
  return format(budgetMin!);
}
