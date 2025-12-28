import Link from 'next/link';

import type { Metadata } from 'next';

import { CTASection } from '@/components/marketing';
import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'SkillPod - Secure Workspaces for Freelancers',
  description:
    "Isolated, encrypted development environments. Protect your code and your client's data with SkillPod.",
  path: '/skillpod',
});

const features = [
  { title: 'End-to-End Encryption', description: 'All data encrypted in transit and at rest' },
  { title: 'Isolated Environments', description: 'Each project runs in its own secure container' },
  { title: 'Access Controls', description: 'Granular permissions for team members' },
  { title: 'Audit Logging', description: 'Complete visibility into all workspace activity' },
  { title: 'One-Click Setup', description: 'Pre-configured environments for any tech stack' },
  { title: 'Cloud Backup', description: 'Automatic backups with instant restore' },
];

export default function SkillPodPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-50 to-purple-50 pb-20 pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
              Product
            </div>
            <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">SkillPod</h1>
            <p className="mb-8 text-xl text-slate-600">
              Secure, isolated workspaces for every project. Protect your work and your
              client&apos;s sensitive data with enterprise-grade security.
            </p>
            <div className="flex gap-4">
              <Link
                className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
                href="/signup"
              >
                Try SkillPod Free
              </Link>
              <Link
                className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition-colors hover:border-indigo-300"
                href="/demo"
              >
                See Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-slate-900">
            Enterprise Security for Freelancers
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200 p-6 transition-shadow hover:shadow-lg"
              >
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        description="Start with 3 free SkillPod workspaces on our Pro plan."
        title="Ready to Secure Your Work?"
      />
    </>
  );
}
