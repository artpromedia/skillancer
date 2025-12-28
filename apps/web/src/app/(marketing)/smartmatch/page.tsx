import Link from 'next/link';

import type { Metadata } from 'next';

import { CTASection } from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'SmartMatch - AI-Powered Talent Matching',
  description:
    'Find the perfect projects or talent with our intelligent matching algorithm. Better matches, better outcomes.',
  path: '/smartmatch',
});

const benefits = [
  {
    title: 'AI-Powered Matching',
    description: 'Our algorithm learns your preferences and improves over time',
  },
  {
    title: 'Skill Analysis',
    description: 'Deep analysis of skills, experience, and project requirements',
  },
  { title: 'Culture Fit', description: 'Match based on work style and communication preferences' },
  {
    title: 'Success Prediction',
    description: 'Predict project success rates based on historical data',
  },
];

export default function SmartMatchPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-purple-50 to-pink-50 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
              Product
            </div>
            <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">SmartMatch</h1>
            <p className="mb-8 text-xl text-slate-600">
              Stop searching. Start matching. Our AI connects the right talent with the right
              projects.
            </p>
            <Link
              className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700"
              href="/signup"
            >
              Get Matched Now
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl bg-slate-50 p-6">
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{benefit.title}</h3>
                <p className="text-slate-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection variant="light" />
    </>
  );
}
