import Link from 'next/link';

import type { Metadata } from 'next';

import { CTASection } from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'For Freelancers - Grow Your Career with Skillancer',
  description:
    'Build your reputation, land better clients, and earn more with verified skills and secure workspaces.',
  path: '/for-freelancers',
});

const benefits = [
  {
    icon: '🛡️',
    title: 'Verified Trust Score',
    description: 'Stand out with a verified profile that proves your expertise',
  },
  {
    icon: '🎯',
    title: 'Smart Matching',
    description: 'Get matched with projects that fit your skills and preferences',
  },
  {
    icon: '🔒',
    title: 'Secure Workspaces',
    description: 'Work confidently in isolated, encrypted environments',
  },
  {
    icon: '📊',
    title: 'Business Analytics',
    description: 'Track your performance and optimize your freelance business',
  },
  {
    icon: '💰',
    title: 'Fair Pricing',
    description: 'Set your rates and keep more of what you earn',
  },
  {
    icon: '🌍',
    title: 'Global Opportunities',
    description: 'Access clients from 150+ countries worldwide',
  },
];

export default function ForFreelancersPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-indigo-600 to-purple-600 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-white">
            <h1 className="mb-6 text-4xl font-bold sm:text-5xl">
              Freelancers, This Is Your Platform
            </h1>
            <p className="mb-8 text-xl text-indigo-100">
              Build your reputation, prove your skills, and work with clients who value trust.
            </p>
            <Link
              className="inline-block rounded-lg bg-white px-6 py-3 font-semibold text-indigo-600 transition-colors hover:bg-slate-100"
              href="/signup"
            >
              Join as a Freelancer
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Why Freelancers Choose Skillancer
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 text-3xl">{benefit.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{benefit.title}</h3>
                <p className="text-slate-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        primaryCTA={{ label: 'Create Free Account', href: '/signup' }}
        title="Start Your Freelance Journey"
      />
    </>
  );
}
