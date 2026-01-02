'use client';

import {
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  CogIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useState } from 'react';

interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  articleCount: number;
  color: string;
}

interface PopularArticle {
  id: string;
  title: string;
  category: string;
  views: number;
}

interface FAQ {
  question: string;
  answer: string;
}

const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'New to Skillancer? Learn the basics of creating your account and profile.',
    icon: UserGroupIcon,
    articleCount: 24,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'payments',
    name: 'Payments & Billing',
    description: 'Manage payments, understand fees, and resolve billing issues.',
    icon: CreditCardIcon,
    articleCount: 32,
    color: 'bg-green-100 text-green-600',
  },
  {
    id: 'trust-safety',
    name: 'Trust & Safety',
    description: 'Stay safe on the platform and report issues or suspicious activity.',
    icon: ShieldCheckIcon,
    articleCount: 18,
    color: 'bg-purple-100 text-purple-600',
  },
  {
    id: 'account-settings',
    name: 'Account Settings',
    description: 'Update your profile, notifications, and security settings.',
    icon: CogIcon,
    articleCount: 21,
    color: 'bg-orange-100 text-orange-600',
  },
  {
    id: 'projects-contracts',
    name: 'Projects & Contracts',
    description: 'Learn about job postings, proposals, contracts, and project management.',
    icon: DocumentTextIcon,
    articleCount: 45,
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Use messaging, video calls, and collaboration tools effectively.',
    icon: ChatBubbleLeftRightIcon,
    articleCount: 15,
    color: 'bg-pink-100 text-pink-600',
  },
];

const popularArticles: PopularArticle[] = [
  {
    id: '1',
    title: 'How to create a compelling freelancer profile',
    category: 'Getting Started',
    views: 45200,
  },
  {
    id: '2',
    title: 'Understanding service fees and payment schedules',
    category: 'Payments',
    views: 38500,
  },
  { id: '3', title: 'How to submit a winning proposal', category: 'Projects', views: 32100 },
  {
    id: '4',
    title: 'Setting up secure two-factor authentication',
    category: 'Account',
    views: 28900,
  },
  { id: '5', title: 'Resolving payment disputes', category: 'Payments', views: 25600 },
  { id: '6', title: 'How to request a refund', category: 'Payments', views: 24100 },
  {
    id: '7',
    title: 'Best practices for client communication',
    category: 'Communication',
    views: 22800,
  },
  { id: '8', title: 'Reporting a user or project', category: 'Trust & Safety', views: 21500 },
];

const faqs: FAQ[] = [
  {
    question: 'How do I get started as a freelancer on Skillancer?',
    answer:
      'Getting started is easy! Create a free account, complete your profile with your skills and experience, add portfolio samples, and start browsing and applying to jobs. You can also take skill tests to verify your expertise and boost your visibility to clients.',
  },
  {
    question: 'What fees does Skillancer charge?',
    answer:
      'Skillancer uses a sliding fee structure. We charge 20% for the first $500 with a client, 10% for billings between $500-$10,000, and 5% for billings over $10,000. This encourages long-term client relationships and rewards successful freelancers.',
  },
  {
    question: 'How does payment protection work?',
    answer:
      'For fixed-price projects, client funds are held in escrow until milestones are approved. For hourly contracts, our Work Diary tracks time and provides proof of work, guaranteeing payment for logged hours. This protects both freelancers and clients.',
  },
  {
    question: 'How do I withdraw my earnings?',
    answer:
      'You can withdraw earnings through several methods: direct bank transfer, PayPal, Payoneer, or wire transfer. Processing times vary by method (1-5 business days). Minimum withdrawal amounts may apply depending on your chosen method.',
  },
  {
    question: 'What should I do if I have a dispute with a client?',
    answer:
      "First, try to resolve issues directly with your client through our messaging system. If that doesn't work, you can open a dispute through our Resolution Center. Our team will review the case and help mediate a fair outcome.",
  },
  {
    question: 'Can I work with clients outside of Skillancer?',
    answer:
      'While you can work with clients you meet on Skillancer outside the platform after your contract ends, we encourage using Skillancer for payment protection and dispute resolution. Taking active clients off-platform violates our Terms of Service.',
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

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

      {/* Hero Section with Search */}
      <section className="bg-gradient-to-b from-green-600 to-green-700 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-6 text-lg text-green-100">
            Search our knowledge base or browse topics below
          </p>

          {/* Search Bar */}
          <div className="relative mt-8">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
            <input
              className="w-full rounded-xl border-0 py-4 pl-12 pr-4 text-gray-900 placeholder-gray-500 shadow-lg focus:ring-2 focus:ring-green-500"
              placeholder="Search for help articles..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Links */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Payment issues', 'Account access', 'Refund request', 'Report user'].map((link) => (
              <button
                key={link}
                className="rounded-full bg-white/10 px-3 py-1 text-sm text-white transition-colors hover:bg-white/20"
              >
                {link}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Browse by Topic</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {helpCategories.map((category) => (
              <Link
                key={category.id}
                className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
                href={`/help/${category.id}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${category.color}`}
                  >
                    <category.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-green-600">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">{category.description}</p>
                    <p className="mt-3 text-xs text-gray-500">{category.articleCount} articles</p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-green-600" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">Popular Articles</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {popularArticles.map((article, index) => (
              <Link
                key={article.id}
                className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow"
                href={`/help/article/${article.id}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 hover:text-green-600">{article.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{article.category}</p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <button
                  className="flex w-full items-center justify-between p-6 text-left"
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <ChevronDownIcon
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      expandedFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedFAQ === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link className="font-medium text-green-600 hover:text-green-500" href="/faq">
              View all FAQs →
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Still Need Help?</h2>
            <p className="mt-2 text-gray-600">Our support team is here to assist you</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Live Chat */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <ChatBubbleLeftRightIcon className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Live Chat</h3>
              <p className="mb-4 text-sm text-gray-600">
                Chat with a support agent for immediate assistance.
              </p>
              <p className="mb-4 text-xs text-gray-500">Available 24/7</p>
              <button className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-500">
                Start Chat
              </button>
            </div>

            {/* Email Support */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <EnvelopeIcon className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Email Support</h3>
              <p className="mb-4 text-sm text-gray-600">
                Send us an email and we'll respond within 24 hours.
              </p>
              <p className="mb-4 text-xs text-gray-500">Response time: 24 hours</p>
              <Link
                className="block w-full rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                href="mailto:support@skillancer.com"
              >
                Send Email
              </Link>
            </div>

            {/* Phone Support */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                <PhoneIcon className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Phone Support</h3>
              <p className="mb-4 text-sm text-gray-600">Call our support team for urgent issues.</p>
              <p className="mb-4 text-xs text-gray-500">Enterprise customers only</p>
              <Link
                className="block w-full rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                href="/enterprise"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Community & Resources */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">More Resources</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 text-center transition-all hover:border-green-300 hover:shadow-lg"
              href="/community"
            >
              <UserGroupIcon className="mx-auto mb-3 h-8 w-8 text-green-600" />
              <h3 className="font-semibold text-gray-900 group-hover:text-green-600">
                Community Forum
              </h3>
              <p className="mt-1 text-sm text-gray-500">Get help from other users</p>
            </Link>

            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 text-center transition-all hover:border-green-300 hover:shadow-lg"
              href="/blog"
            >
              <DocumentTextIcon className="mx-auto mb-3 h-8 w-8 text-green-600" />
              <h3 className="font-semibold text-gray-900 group-hover:text-green-600">
                Blog & Guides
              </h3>
              <p className="mt-1 text-sm text-gray-500">Tips and best practices</p>
            </Link>

            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 text-center transition-all hover:border-green-300 hover:shadow-lg"
              href="/api-docs"
            >
              <CogIcon className="mx-auto mb-3 h-8 w-8 text-green-600" />
              <h3 className="font-semibold text-gray-900 group-hover:text-green-600">
                API Documentation
              </h3>
              <p className="mt-1 text-sm text-gray-500">For developers</p>
            </Link>

            <Link
              className="group rounded-xl border border-gray-200 bg-white p-6 text-center transition-all hover:border-green-300 hover:shadow-lg"
              href="/status"
            >
              <QuestionMarkCircleIcon className="mx-auto mb-3 h-8 w-8 text-green-600" />
              <h3 className="font-semibold text-gray-900 group-hover:text-green-600">
                System Status
              </h3>
              <p className="mt-1 text-sm text-gray-500">Check platform status</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact Us
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/trust">
              Trust & Safety
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/terms">
              Terms of Service
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/privacy">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
