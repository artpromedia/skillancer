import Link from 'next/link';

import type { Metadata } from 'next';

import { generateMetadata as genMeta } from '@/lib/seo/metadata';

export const metadata: Metadata = genMeta({
  title: 'Blog - Tips, Insights & Updates',
  description:
    'Stay updated with the latest freelancing tips, platform updates, and industry insights.',
  path: '/blog',
});

const posts = [
  {
    slug: 'building-trust-in-freelancing',
    title: 'Building Trust in the Freelance Economy',
    excerpt:
      'Learn how verified skills and secure workspaces are transforming client-freelancer relationships.',
    date: '2025-12-20',
    author: 'Sarah Chen',
    category: 'Industry',
    readTime: '5 min read',
  },
  {
    slug: 'skillpod-security-deep-dive',
    title: 'SkillPod Security: A Deep Dive',
    excerpt: 'Understanding the enterprise-grade security measures protecting your work.',
    date: '2025-12-15',
    author: 'Marcus Johnson',
    category: 'Product',
    readTime: '8 min read',
  },
  {
    slug: 'freelancer-success-tips',
    title: '10 Tips for Freelance Success in 2026',
    excerpt: 'Expert advice on building a thriving freelance career in the modern economy.',
    date: '2025-12-10',
    author: 'Elena Rodriguez',
    category: 'Tips',
    readTime: '6 min read',
  },
];

export default function BlogPage() {
  return (
    <div className="pb-20 pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="mb-6 text-4xl font-bold text-slate-900 sm:text-5xl">Blog</h1>
          <p className="mx-auto max-w-2xl text-xl text-slate-600">
            Tips, insights, and updates from the Skillancer team.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
            >
              <div className="aspect-video bg-gradient-to-br from-indigo-100 to-purple-100" />
              <div className="p-6">
                <div className="mb-3 flex items-center gap-4 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{post.category}</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="mb-3 text-xl font-semibold text-slate-900">
                  <Link
                    className="transition-colors hover:text-indigo-600"
                    href={`/blog/${post.slug}`}
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mb-4 text-slate-600">{post.excerpt}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{post.author}</span>
                  <span className="text-slate-400">{new Date(post.date).toLocaleDateString()}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
