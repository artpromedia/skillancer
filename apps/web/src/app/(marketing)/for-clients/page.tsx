import Link from 'next/link';

import type { Metadata } from 'next';

import { CTASection } from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'For Clients - Find Verified Talent on Skillancer',
  description:
    'Hire with confidence. Access verified freelancers, secure workspaces, and intelligent matching.',
  path: '/for-clients',
});

const benefits = [
  {
    icon: '✓',
    title: 'Verified Talent',
    description: 'Every skill claim is verified through our multi-layer system',
  },
  {
    icon: '🤖',
    title: 'AI Matching',
    description: 'Get matched with freelancers who fit your exact requirements',
  },
  {
    icon: '🔐',
    title: 'Secure Collaboration',
    description: 'Your code and data stay protected in SkillPod workspaces',
  },
  {
    icon: '📈',
    title: 'Quality Guarantee',
    description: '98% client satisfaction rate with our vetted freelancers',
  },
];

export default function ForClientsPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-slate-900 to-indigo-900 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-white">
            <h1 className="mb-6 text-4xl font-bold sm:text-5xl">Hire Talent You Can Trust</h1>
            <p className="mb-8 text-xl text-slate-300">
              Stop guessing. Start hiring verified freelancers with proven track records.
            </p>
            <Link
              className="inline-block rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              href="/signup?type=client"
            >
              Post a Project
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex gap-4 rounded-xl bg-slate-50 p-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xl font-bold text-indigo-600">
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{benefit.title}</h3>
                  <p className="text-slate-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection title="Find Your Perfect Freelancer" variant="light" />
    </>
  );
}
