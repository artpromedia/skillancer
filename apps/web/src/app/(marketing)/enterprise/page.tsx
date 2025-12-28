import Link from 'next/link';

import type { Metadata } from 'next';

import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Enterprise - Skillancer for Teams',
  description:
    'Scale your freelance workforce with enterprise-grade security, compliance, and dedicated support.',
  path: '/enterprise',
});

const features = [
  {
    title: 'SSO Integration',
    description: 'SAML 2.0 and OAuth support for seamless authentication',
  },
  { title: 'Compliance', description: 'SOC 2 Type II, GDPR, and HIPAA compliant' },
  {
    title: 'Dedicated Support',
    description: '24/7 priority support with dedicated account manager',
  },
  { title: 'Custom SLAs', description: 'Guaranteed uptime and response times' },
  { title: 'Audit Logs', description: 'Complete visibility into all platform activity' },
  { title: 'API Access', description: 'Full API access for custom integrations' },
];

export default function EnterprisePage() {
  return (
    <>
      <section className="bg-slate-900 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl text-white">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-700 px-3 py-1 text-sm font-medium text-slate-300">
              Enterprise
            </div>
            <h1 className="mb-6 text-4xl font-bold sm:text-5xl">Skillancer for Enterprise</h1>
            <p className="mb-8 text-xl text-slate-300">
              Enterprise-grade security, compliance, and scale for organizations that rely on
              freelance talent.
            </p>
            <div className="flex gap-4">
              <Link
                className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                href="/contact?plan=enterprise"
              >
                Contact Sales
              </Link>
              <Link
                className="rounded-lg border border-slate-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
                href="/demo"
              >
                Request Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Enterprise Features
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold text-slate-900">Ready to Scale Your Team?</h2>
          <p className="mb-8 text-lg text-slate-600">
            Let&apos;s discuss how Skillancer can support your enterprise needs.
          </p>
          <Link
            className="rounded-lg bg-slate-900 px-8 py-4 font-semibold text-white transition-colors hover:bg-slate-800"
            href="/contact?plan=enterprise"
          >
            Talk to Sales
          </Link>
        </div>
      </section>
    </>
  );
}
