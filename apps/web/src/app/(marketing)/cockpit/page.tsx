import Link from 'next/link';

import type { Metadata } from 'next';

import { CTASection } from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Cockpit - Freelance Business Dashboard',
  description:
    'Track earnings, manage clients, and optimize your freelance business with real-time analytics.',
  path: '/cockpit',
});

const metrics = [
  { label: 'Total Earnings', value: '$47,250', change: '+12%' },
  { label: 'Active Projects', value: '8', change: '+2' },
  { label: 'Client Satisfaction', value: '98%', change: '+3%' },
  { label: 'Hours This Month', value: '142', change: '-8' },
];

export default function CockpitPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-700 px-3 py-1 text-sm font-medium text-slate-300">
              Product
            </div>
            <h1 className="mb-6 text-4xl font-bold text-white sm:text-5xl">Cockpit</h1>
            <p className="mb-8 text-xl text-slate-300">
              Your command center for freelance success. Track, analyze, and optimize every aspect
              of your business.
            </p>
            <Link
              className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              href="/signup"
            >
              Launch Your Cockpit
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-slate-900">Sample Dashboard</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="mb-1 text-sm text-slate-500">{metric.label}</p>
                <p className="text-3xl font-bold text-slate-900">{metric.value}</p>
                <p className="mt-1 text-sm text-green-600">{metric.change} this month</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
