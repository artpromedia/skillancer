import Link from 'next/link';

import type { Metadata } from 'next';

import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Help Center',
  description: 'Get help with Skillancer. Browse FAQs, guides, and contact our support team.',
  path: '/help',
});

const categories = [
  {
    title: 'Getting Started',
    icon: '🚀',
    articles: ['Creating your account', 'Setting up your profile', 'Finding your first project'],
  },
  {
    title: 'Payments & Billing',
    icon: '💳',
    articles: ['Payment methods', 'Withdrawal options', 'Understanding fees'],
  },
  {
    title: 'SkillPod Workspaces',
    icon: '🔒',
    articles: ['Creating a workspace', 'Security features', 'Sharing with clients'],
  },
  {
    title: 'Verification',
    icon: '✓',
    articles: ['Verification levels', 'Taking assessments', 'Getting endorsements'],
  },
];

export default function HelpPage() {
  return (
    <div className="pb-20 pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">Help Center</h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-slate-600">
            Find answers, guides, and support resources.
          </p>
          <div className="mx-auto max-w-xl">
            <input
              className="w-full rounded-xl border border-slate-300 px-6 py-4 text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              placeholder="Search for help..."
              type="search"
            />
          </div>
        </div>

        <div className="mb-16 grid gap-8 md:grid-cols-2">
          {categories.map((category) => (
            <div key={category.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">{category.icon}</span>
                <h2 className="text-xl font-semibold text-slate-900">{category.title}</h2>
              </div>
              <ul className="space-y-2">
                {category.articles.map((article) => (
                  <li key={article}>
                    <Link
                      className="text-slate-600 transition-colors hover:text-indigo-600"
                      href={`/help/${article.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {article}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-slate-50 p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-900">Still need help?</h2>
          <p className="mb-6 text-slate-600">Our support team is here to assist you.</p>
          <Link
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
            href="mailto:support@skillancer.com"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
