'use client';

import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  ClockIcon,
  GlobeAltIcon,
  ChartBarIcon,
  UserGroupIcon,
  StarIcon,
  CheckCircleIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

interface Feature {
  title: string;
  description: string;
  icon: React.ElementType;
}

interface SkillCategory {
  name: string;
  avgRate: string;
  demandLevel: 'High' | 'Very High' | 'Growing';
  jobs: number;
}

const steps: Step[] = [
  {
    id: 1,
    title: 'Create Your Profile',
    description:
      'Sign up for free and build a compelling profile that showcases your skills, experience, portfolio, and what makes you unique.',
    icon: UserGroupIcon,
  },
  {
    id: 2,
    title: 'Browse & Apply',
    description:
      'Search through thousands of projects or let clients find you. Submit tailored proposals that highlight your expertise.',
    icon: MagnifyingGlassIcon,
  },
  {
    id: 3,
    title: 'Get Hired & Work',
    description:
      'Chat with clients, agree on terms, and start working. Use our tools for communication, time tracking, and deliverables.',
    icon: BriefcaseIcon,
  },
  {
    id: 4,
    title: 'Get Paid Securely',
    description:
      'Receive payments through our secure platform. Choose from multiple withdrawal options with low fees.',
    icon: CurrencyDollarIcon,
  },
];

const features: Feature[] = [
  {
    title: 'Work From Anywhere',
    description:
      'Find remote opportunities that let you work from home, a café, or while traveling the world.',
    icon: GlobeAltIcon,
  },
  {
    title: 'Choose Your Hours',
    description:
      "Set your own schedule and work when you're most productive. Full flexibility, full control.",
    icon: ClockIcon,
  },
  {
    title: 'Set Your Rates',
    description:
      'You decide how much to charge. As your skills grow, increase your rates accordingly.',
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Build Your Brand',
    description:
      'Develop your reputation through reviews, certifications, and a professional portfolio.',
    icon: StarIcon,
  },
  {
    title: 'Secure Payments',
    description:
      'Get paid on time, every time. Our payment protection ensures you receive what you earn.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Grow Your Skills',
    description:
      'Access learning resources, earn certifications, and expand your service offerings.',
    icon: AcademicCapIcon,
  },
];

const skillCategories: SkillCategory[] = [
  { name: 'Web Development', avgRate: '$45/hr', demandLevel: 'Very High', jobs: 12500 },
  { name: 'Mobile Development', avgRate: '$55/hr', demandLevel: 'Very High', jobs: 8200 },
  { name: 'UI/UX Design', avgRate: '$50/hr', demandLevel: 'High', jobs: 6800 },
  { name: 'Data Science', avgRate: '$65/hr', demandLevel: 'Very High', jobs: 4500 },
  { name: 'AI & Machine Learning', avgRate: '$75/hr', demandLevel: 'Very High', jobs: 3800 },
  { name: 'Cloud & DevOps', avgRate: '$60/hr', demandLevel: 'High', jobs: 5200 },
  { name: 'Content Writing', avgRate: '$30/hr', demandLevel: 'High', jobs: 9500 },
  { name: 'Digital Marketing', avgRate: '$35/hr', demandLevel: 'Growing', jobs: 7200 },
];

const freelancerBenefits = [
  'Access to millions of clients worldwide',
  'Zero upfront costs to join',
  'AI-powered job matching',
  'Secure payment protection',
  'Built-in contracts and invoicing',
  'Professional development resources',
  'Community and networking events',
  'Tax and financial tools',
  'Health and retirement benefits (select regions)',
  '24/7 customer support',
];

const stats = [
  { value: '$500M+', label: 'Paid to freelancers in 2024' },
  { value: '145K+', label: 'Active clients posting jobs' },
  { value: '50K+', label: 'Jobs posted weekly' },
  { value: '180+', label: 'Countries represented' },
];

export default function HowToFindWorkPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link className="text-sm font-medium text-green-600 hover:text-green-700" href="/">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-green-600 to-green-700 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Find Work You Love, On Your Terms
              </h1>
              <p className="mt-6 text-lg leading-8 text-green-100">
                Join millions of freelancers building their careers on Skillancer. Work with clients
                from around the world, set your own rates, and take control of your future.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-green-600 transition-colors hover:bg-gray-100"
                  href="/signup?type=freelancer"
                >
                  Join as a Freelancer
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-lg border-2 border-white px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-600"
                  href="/jobs"
                >
                  Browse Jobs
                </Link>
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur"
                  >
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                    <p className="mt-1 text-sm text-green-100">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-lg text-gray-600">Start earning in four simple steps</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.id} className="relative">
                {index < steps.length - 1 && (
                  <div className="absolute left-full top-12 -ml-4 hidden h-0.5 w-full bg-gray-200 lg:block" />
                )}
                <div className="relative z-10 rounded-xl border border-gray-200 bg-white p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <step.icon className="h-6 w-6 text-green-600" />
                    </div>
                    <span className="text-2xl font-bold text-gray-200">{step.id}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* In-Demand Skills */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">In-Demand Skills</h2>
            <p className="mt-4 text-lg text-gray-600">
              See what skills are most sought after by clients
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {skillCategories.map((skill) => (
              <Link
                key={skill.name}
                className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
                href={`/jobs?category=${encodeURIComponent(skill.name)}`}
              >
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
                  {skill.name}
                </h3>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Avg. Rate</span>
                    <span className="font-medium text-gray-900">{skill.avgRate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Demand</span>
                    <span
                      className={`font-medium ${
                        skill.demandLevel === 'Very High'
                          ? 'text-green-600'
                          : skill.demandLevel === 'High'
                            ? 'text-blue-600'
                            : 'text-orange-600'
                      }`}
                    >
                      {skill.demandLevel}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Open Jobs</span>
                    <span className="font-medium text-gray-900">{skill.jobs.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              className="inline-flex items-center font-medium text-green-600 hover:text-green-500"
              href="/categories"
            >
              View all skill categories
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Skillancer */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Why Freelance on Skillancer?</h2>
            <p className="mt-4 text-lg text-gray-600">
              The tools and support you need to build a thriving freelance career
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <feature.icon className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-green-600 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-white">Everything You Need to Succeed</h2>
              <p className="mb-8 text-lg text-green-100">
                Skillancer provides the platform, tools, and support to help you build a successful
                freelance business from anywhere in the world.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {freelancerBenefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-300" />
                    <span className="text-sm text-white">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="rounded-2xl bg-white p-8 shadow-xl">
                <h3 className="mb-6 text-xl font-bold text-gray-900">Create Your Profile</h3>
                <form className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="name">
                      Full Name
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                      id="name"
                      placeholder="John Doe"
                      type="text"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
                      Email Address
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                      id="email"
                      placeholder="john@example.com"
                      type="email"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="skill">
                      Primary Skill
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-green-500 focus:ring-green-500"
                      id="skill"
                    >
                      <option>Web Development</option>
                      <option>Mobile Development</option>
                      <option>UI/UX Design</option>
                      <option>Data Science</option>
                      <option>Content Writing</option>
                      <option>Digital Marketing</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <button
                    className="w-full rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-500"
                    type="submit"
                  >
                    Get Started Free
                  </button>
                </form>
                <p className="mt-4 text-center text-xs text-gray-500">
                  Free to join. No membership fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories Preview */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Freelancer Success Stories</h2>
            <p className="mt-4 text-lg text-gray-600">
              Hear from freelancers who've built thriving careers on Skillancer
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                name: 'Sarah M.',
                role: 'Full-Stack Developer',
                quote:
                  'I went from a side gig to earning six figures in 18 months. Skillancer gave me access to clients I never could have reached on my own.',
                earnings: '$180K+ annually',
              },
              {
                name: 'David L.',
                role: 'UX Designer',
                quote:
                  "The flexibility to work with multiple clients while traveling has been life-changing. I've worked from 12 countries this year alone.",
                earnings: '$95K+ annually',
              },
              {
                name: 'Priya K.',
                role: 'Data Scientist',
                quote:
                  'The platform connected me with enterprise clients looking for specialized ML expertise. The secure payments give me peace of mind.',
                earnings: '$150K+ annually',
              },
            ].map((story) => (
              <div key={story.name} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 font-bold text-green-600">
                    {story.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{story.name}</p>
                    <p className="text-sm text-gray-500">{story.role}</p>
                  </div>
                </div>
                <p className="mb-4 italic text-gray-600">"{story.quote}"</p>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">Earning</p>
                  <p className="font-semibold text-green-600">{story.earnings}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              className="inline-flex items-center font-medium text-green-600 hover:text-green-500"
              href="/success-stories"
            >
              Read more success stories
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Resources to Help You Succeed</h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
              href="/help"
            >
              <ChartBarIcon className="mb-4 h-8 w-8 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
                Getting Started Guide
              </h3>
              <p className="mt-2 text-gray-600">
                Step-by-step tutorials to help you create a winning profile and land your first
                client.
              </p>
            </Link>

            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
              href="/community"
            >
              <UserGroupIcon className="mb-4 h-8 w-8 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
                Freelancer Community
              </h3>
              <p className="mt-2 text-gray-600">
                Connect with other freelancers, share tips, and grow your network.
              </p>
            </Link>

            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
              href="/blog"
            >
              <AcademicCapIcon className="mb-4 h-8 w-8 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
                Learning Center
              </h3>
              <p className="mt-2 text-gray-600">
                Free courses and resources to help you develop new skills and grow your business.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">Start Your Freelance Journey Today</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
            Join 1.2M+ freelancers who are building their careers on their own terms.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-500"
            href="/signup?type=freelancer"
          >
            Create Your Free Profile
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-hire">
              For Clients
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/jobs">
              Browse Jobs
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/community">
              Community
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/help">
              Help Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
