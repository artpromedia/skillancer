'use client';

import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  UserGroupIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  StarIcon,
  ChevronRightIcon,
  CheckCircleIcon,
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

interface TalentCategory {
  name: string;
  skills: string[];
  startingRate: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: 'Post Your Job',
    description:
      'Create a detailed job posting describing your project, required skills, and budget. Our AI will help match you with the best candidates.',
    icon: BriefcaseIcon,
  },
  {
    id: 2,
    title: 'Review Proposals',
    description:
      'Receive proposals from qualified freelancers. Review their profiles, portfolios, and ratings to find the perfect match.',
    icon: MagnifyingGlassIcon,
  },
  {
    id: 3,
    title: 'Interview & Select',
    description:
      'Chat with candidates, conduct interviews, and select the freelancer who best fits your project needs.',
    icon: UserGroupIcon,
  },
  {
    id: 4,
    title: 'Collaborate Securely',
    description:
      'Work together using our built-in tools for communication, file sharing, and time tracking. Pay securely through our platform.',
    icon: ShieldCheckIcon,
  },
];

const features: Feature[] = [
  {
    title: 'Verified Professionals',
    description:
      'Every freelancer is verified for identity and skills. Access talent with proven track records and client reviews.',
    icon: ShieldCheckIcon,
  },
  {
    title: 'Secure Payments',
    description:
      "Pay only when you're satisfied. Our escrow system protects your funds until milestones are approved.",
    icon: CurrencyDollarIcon,
  },
  {
    title: 'Quality Matches',
    description:
      'Our AI-powered matching system connects you with freelancers whose skills align perfectly with your needs.',
    icon: StarIcon,
  },
  {
    title: '24/7 Support',
    description:
      'Get help whenever you need it. Our support team is available around the clock to assist with any issues.',
    icon: ClockIcon,
  },
];

const talentCategories: TalentCategory[] = [
  {
    name: 'Web Development',
    skills: ['React', 'Node.js', 'Python', 'WordPress'],
    startingRate: '$25/hr',
  },
  {
    name: 'Mobile Development',
    skills: ['iOS', 'Android', 'React Native', 'Flutter'],
    startingRate: '$30/hr',
  },
  {
    name: 'UI/UX Design',
    skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping'],
    startingRate: '$35/hr',
  },
  {
    name: 'Data Science',
    skills: ['Machine Learning', 'Python', 'SQL', 'Visualization'],
    startingRate: '$45/hr',
  },
  {
    name: 'Digital Marketing',
    skills: ['SEO', 'PPC', 'Social Media', 'Content'],
    startingRate: '$20/hr',
  },
  {
    name: 'Writing & Translation',
    skills: ['Copywriting', 'Technical Writing', 'Translation', 'Editing'],
    startingRate: '$15/hr',
  },
];

const clientBenefits = [
  'Access to 1.2M+ verified freelancers worldwide',
  'AI-powered talent matching and recommendations',
  'Secure escrow payment protection',
  'Built-in communication and project management tools',
  'Dedicated account manager for large projects',
  '24/7 customer support',
  'No upfront fees - pay only for approved work',
  'Money-back guarantee on all projects',
];

export default function HowToHirePage() {
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
      <section className="bg-gradient-to-b from-green-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Hire Top Talent for Any Project
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Connect with skilled freelancers from around the world. Whether you need a
                developer, designer, writer, or any other professional, we make it easy to find,
                hire, and collaborate with the best talent.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
                  href="/post-job"
                >
                  Post a Job Free
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  href="/talent"
                >
                  Browse Talent
                </Link>
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
                <h3 className="mb-6 text-lg font-semibold text-gray-900">Quick Stats</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-bold text-green-600">1.2M+</p>
                    <p className="text-sm text-gray-600">Verified Freelancers</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">180+</p>
                    <p className="text-sm text-gray-600">Countries</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">4.9/5</p>
                    <p className="text-sm text-gray-600">Avg. Rating</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">95%</p>
                    <p className="text-sm text-gray-600">Project Success</p>
                  </div>
                </div>
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
            <p className="mt-4 text-lg text-gray-600">
              Hire the perfect freelancer in four simple steps
            </p>
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

      {/* Talent Categories */}
      <section className="bg-gray-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Browse by Category</h2>
            <p className="mt-4 text-lg text-gray-600">Explore our most popular talent categories</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {talentCategories.map((category) => (
              <Link
                key={category.name}
                className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
                href={`/talent?category=${encodeURIComponent(category.name)}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
                    {category.name}
                  </h3>
                  <ChevronRightIcon className="h-5 w-5 text-gray-400 transition-colors group-hover:text-green-600" />
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {category.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-block rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  Starting at{' '}
                  <span className="font-semibold text-gray-900">{category.startingRate}</span>
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
              href="/categories"
            >
              View All Categories
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Why Hire on Skillancer</h2>
            <p className="mt-4 text-lg text-gray-600">
              The tools and protections you need for successful projects
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 rounded-xl border border-gray-200 bg-white p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100">
                  <feature.icon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Checklist */}
      <section className="bg-green-600 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-white">
                Everything You Need to Hire Successfully
              </h2>
              <p className="mb-8 text-lg text-green-100">
                Skillancer provides all the tools, protections, and support you need to find and
                work with the best freelance talent.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {clientBenefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-300" />
                    <span className="text-sm text-white">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-12 lg:mt-0">
              <div className="rounded-2xl bg-white p-8 shadow-xl">
                <h3 className="mb-6 text-xl font-bold text-gray-900">Ready to Get Started?</h3>
                <form className="space-y-4">
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="project-type"
                    >
                      What type of project?
                    </label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-green-500 focus:ring-green-500"
                      id="project-type"
                    >
                      <option>Web Development</option>
                      <option>Mobile Development</option>
                      <option>UI/UX Design</option>
                      <option>Data Science</option>
                      <option>Marketing</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium text-gray-700"
                      htmlFor="project-desc"
                    >
                      Briefly describe your project
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                      id="project-desc"
                      placeholder="I need help with..."
                      rows={3}
                    />
                  </div>
                  <button
                    className="w-full rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-500"
                    type="submit"
                  >
                    Get Started Free
                  </button>
                </form>
                <p className="mt-4 text-center text-xs text-gray-500">
                  No credit card required. Pay only for approved work.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">Common Questions</h2>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">
                How much does it cost to hire on Skillancer?
              </h3>
              <p className="mt-2 text-gray-600">
                Posting jobs is free. You only pay a small service fee when you approve and pay for
                completed work. Freelancer rates vary by skill and experience level.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">
                How do I know freelancers are qualified?
              </h3>
              <p className="mt-2 text-gray-600">
                All freelancers on Skillancer are verified for identity. Many complete skill tests
                and have portfolios, work history, and client reviews you can review.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="font-semibold text-gray-900">
                What if I'm not satisfied with the work?
              </h3>
              <p className="mt-2 text-gray-600">
                We offer payment protection through our escrow system. If you're not satisfied, our
                dispute resolution team will help mediate. We also offer a money-back guarantee.
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link className="font-medium text-green-600 hover:text-green-500" href="/faq">
              View All FAQs →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">
            Find Your Perfect Freelancer Today
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
            Join thousands of businesses who trust Skillancer to connect them with top talent.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-green-500"
              href="/post-job"
            >
              Post a Job Free
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              href="/enterprise"
            >
              Enterprise Solutions
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-find-work">
              For Freelancers
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/enterprise">
              Enterprise
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/help">
              Help Center
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
