import Link from 'next/link';

import type { Metadata } from 'next';

import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Security - Enterprise-Grade Protection',
  description:
    "Learn about Skillancer's comprehensive security measures protecting your data and work.",
  path: '/security',
});

const certifications = [
  { name: 'SOC 2 Type II', description: 'Audited security controls' },
  { name: 'GDPR Compliant', description: 'EU data protection' },
  { name: 'ISO 27001', description: 'Information security management' },
  { name: 'HIPAA Ready', description: 'Healthcare data compliance' },
];

const measures = [
  {
    title: 'End-to-End Encryption',
    description: 'All data encrypted with AES-256 in transit and at rest',
  },
  {
    title: 'Zero-Knowledge Architecture',
    description: "We can't access your encrypted workspace data",
  },
  { title: 'Multi-Factor Authentication', description: 'Protect your account with MFA options' },
  { title: 'Regular Penetration Testing', description: 'Third-party security audits quarterly' },
  { title: 'DDoS Protection', description: 'Enterprise-grade protection against attacks' },
  { title: '24/7 Monitoring', description: 'Real-time threat detection and response' },
];

export default function SecurityPage() {
  return (
    <div className="pb-20 pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">Security First</h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-600">
            Your data security is our top priority. We implement enterprise-grade measures to
            protect every aspect of your work.
          </p>
        </div>

        {/* Certifications */}
        <div className="mb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {certifications.map((cert) => (
            <div
              key={cert.name}
              className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clipRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">{cert.name}</h3>
              <p className="text-sm text-slate-500">{cert.description}</p>
            </div>
          ))}
        </div>

        {/* Security Measures */}
        <h2 className="mb-8 text-center text-3xl font-bold text-slate-900">
          Our Security Measures
        </h2>
        <div className="mb-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {measures.map((measure) => (
            <div key={measure.title} className="rounded-xl border border-slate-200 p-6">
              <h3 className="mb-2 font-semibold text-slate-900">{measure.title}</h3>
              <p className="text-sm text-slate-600">{measure.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="mb-4 text-slate-600">
            Have security questions or want to report a vulnerability?
          </p>
          <Link
            className="font-semibold text-indigo-600 hover:text-indigo-700"
            href="mailto:security@skillancer.com"
          >
            security@skillancer.com
          </Link>
        </div>
      </div>
    </div>
  );
}
