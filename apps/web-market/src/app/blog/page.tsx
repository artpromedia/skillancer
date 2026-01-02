'use client';

import {
  MagnifyingGlassIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  ArrowRightIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: { name: string; avatar: string; role: string };
  date: string;
  readTime: string;
  category: string;
  tags: string[];
  image: string;
  featured: boolean;
}

interface Category {
  name: string;
  count: number;
  slug: string;
}

const blogPosts: BlogPost[] = [
  {
    id: 'future-of-remote-work-2025',
    title: 'The Future of Remote Work: Trends to Watch in 2025',
    excerpt:
      'As we enter 2025, remote work continues to evolve. Discover the key trends shaping how companies hire and how freelancers work in the new economy.',
    author: { name: 'Sarah Chen', avatar: 'SC', role: 'Head of Content' },
    date: 'December 28, 2024',
    readTime: '8 min read',
    category: 'Industry Trends',
    tags: ['Remote Work', 'Future of Work', 'Hiring Trends'],
    image: '/blog/remote-work.jpg',
    featured: true,
  },
  {
    id: 'ai-freelancing-guide',
    title: 'How AI is Transforming Freelancing: A Complete Guide',
    excerpt:
      'From AI-powered proposal writing to automated invoicing, learn how artificial intelligence tools can supercharge your freelance career.',
    author: { name: 'Michael Torres', avatar: 'MT', role: 'Technology Editor' },
    date: 'December 22, 2024',
    readTime: '12 min read',
    category: 'Technology',
    tags: ['AI', 'Productivity', 'Tools'],
    image: '/blog/ai-freelancing.jpg',
    featured: true,
  },
  {
    id: 'freelancer-pricing-strategies',
    title: 'Pricing Strategies That Actually Work for Freelancers',
    excerpt:
      'Stop undercharging for your work. Learn proven pricing strategies that help you earn what you deserve while keeping clients happy.',
    author: { name: 'Emily Rodriguez', avatar: 'ER', role: 'Career Coach' },
    date: 'December 18, 2024',
    readTime: '10 min read',
    category: 'Career Growth',
    tags: ['Pricing', 'Business', 'Strategy'],
    image: '/blog/pricing.jpg',
    featured: false,
  },
  {
    id: 'building-client-relationships',
    title: '10 Ways to Build Long-Term Client Relationships',
    excerpt:
      "Repeat clients are the foundation of a successful freelance business. Here's how to turn one-time projects into ongoing partnerships.",
    author: { name: 'David Kim', avatar: 'DK', role: 'Success Manager' },
    date: 'December 15, 2024',
    readTime: '7 min read',
    category: 'Client Success',
    tags: ['Clients', 'Relationships', 'Retention'],
    image: '/blog/client-relationships.jpg',
    featured: false,
  },
  {
    id: 'portfolio-mistakes-to-avoid',
    title: '7 Portfolio Mistakes That Are Costing You Clients',
    excerpt:
      "Your portfolio is your most powerful marketing tool. Make sure you're not making these common mistakes that drive potential clients away.",
    author: { name: 'Anna Kowalski', avatar: 'AK', role: 'Design Lead' },
    date: 'December 10, 2024',
    readTime: '6 min read',
    category: 'Career Growth',
    tags: ['Portfolio', 'Design', 'Marketing'],
    image: '/blog/portfolio.jpg',
    featured: false,
  },
  {
    id: 'hiring-first-freelancer',
    title: "A Client's Guide to Hiring Their First Freelancer",
    excerpt:
      'New to hiring freelancers? This comprehensive guide walks you through the entire process, from writing job posts to managing projects.',
    author: { name: 'James Wilson', avatar: 'JW', role: 'Client Success' },
    date: 'December 5, 2024',
    readTime: '11 min read',
    category: 'For Clients',
    tags: ['Hiring', 'Clients', 'Guide'],
    image: '/blog/hiring-guide.jpg',
    featured: false,
  },
  {
    id: 'work-life-balance-freelancing',
    title: 'Maintaining Work-Life Balance as a Freelancer',
    excerpt:
      'The freedom of freelancing can become a trap. Learn how successful freelancers set boundaries and avoid burnout.',
    author: { name: 'Lisa Park', avatar: 'LP', role: 'Wellness Writer' },
    date: 'December 1, 2024',
    readTime: '9 min read',
    category: 'Lifestyle',
    tags: ['Work-Life Balance', 'Mental Health', 'Productivity'],
    image: '/blog/work-life-balance.jpg',
    featured: false,
  },
  {
    id: 'enterprise-workforce-strategy',
    title: 'How Enterprise Companies Are Rethinking Workforce Strategy',
    excerpt:
      "Fortune 500 companies are increasingly embracing flexible talent. Here's what that means for the future of work.",
    author: { name: 'Robert Chang', avatar: 'RC', role: 'Enterprise Writer' },
    date: 'November 28, 2024',
    readTime: '10 min read',
    category: 'Enterprise',
    tags: ['Enterprise', 'Strategy', 'Hiring'],
    image: '/blog/enterprise.jpg',
    featured: false,
  },
];

const categories: Category[] = [
  { name: 'All Posts', count: 48, slug: 'all' },
  { name: 'Industry Trends', count: 12, slug: 'industry-trends' },
  { name: 'Career Growth', count: 15, slug: 'career-growth' },
  { name: 'Technology', count: 8, slug: 'technology' },
  { name: 'For Clients', count: 6, slug: 'for-clients' },
  { name: 'Enterprise', count: 4, slug: 'enterprise' },
  { name: 'Lifestyle', count: 3, slug: 'lifestyle' },
];

const popularTags = [
  'Remote Work',
  'Freelancing Tips',
  'Pricing',
  'Productivity',
  'AI',
  'Hiring',
  'Career Advice',
  'Client Management',
];

export default function BlogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const featuredPosts = blogPosts.filter((post) => post.featured);
  const regularPosts = blogPosts.filter((post) => !post.featured);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link className="text-sm font-medium text-green-600 hover:text-green-700" href="/">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              The Skillancer Blog
            </h1>
            <p className="mt-6 text-lg text-gray-600">
              Insights, tips, and stories to help you succeed in the freelance economy. Whether
              you're a freelancer or a client, we've got you covered.
            </p>

            {/* Search Bar */}
            <div className="relative mx-auto mt-8 max-w-xl">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-300 py-3 pl-12 pr-4 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
                placeholder="Search articles..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Posts */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Featured Articles</h2>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {featuredPosts.map((post) => (
              <Link
                key={post.id}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-xl"
                href={`/blog/${post.id}`}
              >
                {/* Image Placeholder */}
                <div className="flex h-48 items-center justify-center bg-gradient-to-br from-green-400 to-green-600">
                  <span className="text-lg font-medium text-white/50">Featured Image</span>
                </div>

                <div className="p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-600">
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-500">{post.readTime}</span>
                  </div>

                  <h3 className="mb-3 text-xl font-bold text-gray-900 group-hover:text-green-600">
                    {post.title}
                  </h3>

                  <p className="mb-4 line-clamp-2 text-gray-600">{post.excerpt}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                        {post.author.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{post.author.name}</p>
                        <p className="text-xs text-gray-500">{post.date}</p>
                      </div>
                    </div>
                    <BookmarkIcon className="h-5 w-5 text-gray-400 hover:text-green-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-12">
            {/* Sidebar */}
            <aside className="mb-8 lg:col-span-1 lg:mb-0">
              {/* Categories */}
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Categories</h3>
                <ul className="space-y-2">
                  {categories.map((category) => (
                    <li key={category.slug}>
                      <button
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                          selectedCategory === category.slug
                            ? 'bg-green-100 text-green-600'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        onClick={() => setSelectedCategory(category.slug)}
                      >
                        <span>{category.name}</span>
                        <span className="text-xs">{category.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Popular Tags */}
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Popular Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => (
                    <button
                      key={tag}
                      className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 transition-colors hover:bg-green-100 hover:text-green-600"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Newsletter */}
              <div className="rounded-xl bg-green-600 p-6 text-white">
                <h3 className="mb-2 font-semibold">Subscribe to Our Newsletter</h3>
                <p className="mb-4 text-sm text-green-100">
                  Get the latest articles delivered to your inbox weekly.
                </p>
                <input
                  className="mb-3 w-full rounded-lg px-4 py-2 text-gray-900 placeholder-gray-500"
                  placeholder="Enter your email"
                  type="email"
                />
                <button className="w-full rounded-lg bg-white py-2 font-medium text-green-600 transition-colors hover:bg-gray-100">
                  Subscribe
                </button>
              </div>
            </aside>

            {/* Posts Grid */}
            <div className="lg:col-span-3">
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Latest Articles</h2>
                <select className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 focus:border-green-500 focus:ring-green-500">
                  <option>Most Recent</option>
                  <option>Most Popular</option>
                  <option>Oldest First</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {regularPosts.map((post) => (
                  <article
                    key={post.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-lg"
                  >
                    {/* Image Placeholder */}
                    <div className="flex h-40 items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                      <span className="text-sm text-gray-400">Article Image</span>
                    </div>

                    <div className="p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          {post.category}
                        </span>
                      </div>

                      <Link href={`/blog/${post.id}`}>
                        <h3 className="mb-2 line-clamp-2 font-semibold text-gray-900 hover:text-green-600">
                          {post.title}
                        </h3>
                      </Link>

                      <p className="mb-4 line-clamp-2 text-sm text-gray-600">{post.excerpt}</p>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {post.date}
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {post.readTime}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-12 flex items-center justify-center gap-2">
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
                  Previous
                </button>
                <button className="rounded-lg bg-green-600 px-4 py-2 text-white">1</button>
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
                  2
                </button>
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
                  3
                </button>
                <span className="px-2 text-gray-400">...</span>
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
                  12
                </button>
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">Want to Write for Skillancer?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
            We're always looking for talented writers to share their expertise with our community.
          </p>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
            href="/contact?subject=guest-post"
          >
            Become a Contributor
            <ArrowRightIcon className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-find-work">
              For Freelancers
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/how-to-hire">
              For Clients
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/success-stories">
              Success Stories
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/help">
              Help Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
