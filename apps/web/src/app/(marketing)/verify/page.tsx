import Link from 'next/link';

import type { Metadata } from 'next';

import { CTASection } from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Verify - Skill Verification System',
  description:
    'Build trust with verified skills. Multi-layer verification including assessments, endorsements, and work history.',
  path: '/verify',
});

const levels = [
  {
    level: 1,
    name: 'Self-Declared',
    description: 'Skills you claim on your profile',
    color: 'slate',
  },
  { level: 2, name: 'Assessed', description: 'Passed our skill assessments', color: 'blue' },
  { level: 3, name: 'Endorsed', description: 'Verified by peers and clients', color: 'purple' },
  {
    level: 4,
    name: 'Certified',
    description: 'Third-party certifications verified',
    color: 'indigo',
  },
  { level: 5, name: 'Expert', description: 'Proven track record of excellence', color: 'emerald' },
];

export default function VerifyPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-emerald-50 to-teal-50 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              Product
            </div>
            <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">Verify</h1>
            <p className="mb-8 text-xl text-slate-600">
              Trust isn&apos;t claimed, it&apos;s earned. Our multi-layer verification system proves
              your expertise.
            </p>
            <Link
              className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-700"
              href="/signup"
            >
              Get Verified
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Verification Levels
          </h2>
          <div className="mx-auto max-w-2xl space-y-4">
            {levels.map((level) => (
              <div key={level.level} className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 font-bold text-white">
                  {level.level}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{level.name}</h3>
                  <p className="text-sm text-slate-600">{level.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection title="Ready to Build Your Trust Score?" variant="light" />
    </>
  );
}
