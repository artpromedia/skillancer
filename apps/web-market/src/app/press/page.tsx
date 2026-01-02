'use client';

import {
  NewspaperIcon,
  DocumentTextIcon,
  PhotoIcon,
  EnvelopeIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface PressRelease {
  id: string;
  title: string;
  date: string;
  excerpt: string;
  category: 'Company News' | 'Product' | 'Partnership' | 'Funding' | 'Research';
}

interface MediaMention {
  id: string;
  publication: string;
  title: string;
  date: string;
  url: string;
  logo?: string;
}

const pressReleases: PressRelease[] = [
  {
    id: 'series-b-funding',
    title: 'Skillancer Raises $50M Series B to Accelerate Global Expansion',
    date: 'December 15, 2024',
    excerpt:
      'Funding round led by top-tier investors will fuel product innovation and international growth.',
    category: 'Funding',
  },
  {
    id: 'ai-matching-launch',
    title: 'Skillancer Launches AI-Powered SmartMatch Technology',
    date: 'November 28, 2024',
    excerpt:
      'Revolutionary matching algorithm helps clients find the perfect freelancer 3x faster.',
    category: 'Product',
  },
  {
    id: 'enterprise-program',
    title: 'Skillancer Introduces Enterprise Program for Fortune 500 Companies',
    date: 'November 10, 2024',
    excerpt: 'New program offers dedicated support, custom integrations, and volume pricing.',
    category: 'Company News',
  },
  {
    id: 'skillpod-security',
    title: 'SkillPod Achieves SOC 2 Type II Certification',
    date: 'October 25, 2024',
    excerpt: 'Secure workspace solution meets highest industry standards for data protection.',
    category: 'Product',
  },
  {
    id: 'freelancer-milestone',
    title: 'Skillancer Community Reaches 1 Million Verified Freelancers',
    date: 'October 5, 2024',
    excerpt: 'Platform milestone reflects growing trust in verified skills marketplace.',
    category: 'Company News',
  },
  {
    id: 'future-of-work-report',
    title: 'Skillancer Releases 2024 Future of Work Report',
    date: 'September 18, 2024',
    excerpt: 'Annual report reveals trends in remote work, AI adoption, and skills demand.',
    category: 'Research',
  },
];

const mediaMentions: MediaMention[] = [
  {
    id: '1',
    publication: 'TechCrunch',
    title: 'How Skillancer is Reinventing the Freelance Marketplace',
    date: 'December 20, 2024',
    url: '#',
  },
  {
    id: '2',
    publication: 'Forbes',
    title: 'The Rise of Verified Skills Platforms',
    date: 'December 10, 2024',
    url: '#',
  },
  {
    id: '3',
    publication: 'The Wall Street Journal',
    title: 'Freelance Platforms Bet Big on AI Matching',
    date: 'November 30, 2024',
    url: '#',
  },
  {
    id: '4',
    publication: 'Wired',
    title: "Inside Skillancer's Secure Workspace Technology",
    date: 'November 15, 2024',
    url: '#',
  },
  {
    id: '5',
    publication: 'Bloomberg',
    title: 'The $50M Bet on Trust in Freelancing',
    date: 'November 1, 2024',
    url: '#',
  },
];

const brandAssets = [
  {
    name: 'Logo Package',
    description: 'Primary and secondary logos in various formats',
    formats: ['SVG', 'PNG', 'PDF'],
    size: '2.5 MB',
  },
  {
    name: 'Brand Guidelines',
    description: 'Complete brand style guide and usage rules',
    formats: ['PDF'],
    size: '8.2 MB',
  },
  {
    name: 'Executive Photos',
    description: 'High-resolution headshots of leadership team',
    formats: ['JPG'],
    size: '15.4 MB',
  },
  {
    name: 'Product Screenshots',
    description: 'Platform screenshots for editorial use',
    formats: ['PNG'],
    size: '12.8 MB',
  },
];

function getCategoryColor(category: PressRelease['category']) {
  switch (category) {
    case 'Funding':
      return 'bg-green-100 text-green-800';
    case 'Product':
      return 'bg-blue-100 text-blue-800';
    case 'Partnership':
      return 'bg-purple-100 text-purple-800';
    case 'Company News':
      return 'bg-gray-100 text-gray-800';
    case 'Research':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default function PressPage() {
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
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Press & Media
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-600">
            Get the latest news about Skillancer, download brand assets, and connect with our
            communications team.
          </p>
        </div>
      </section>

      {/* Quick Links */}
      <section className="border-b border-gray-200 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <a
              className="flex items-center gap-4 rounded-xl bg-gray-50 p-6 transition-colors hover:bg-gray-100"
              href="#press-releases"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <NewspaperIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Press Releases</h3>
                <p className="text-sm text-gray-600">Latest company announcements</p>
              </div>
            </a>

            <a
              className="flex items-center gap-4 rounded-xl bg-gray-50 p-6 transition-colors hover:bg-gray-100"
              href="#brand-assets"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <PhotoIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Brand Assets</h3>
                <p className="text-sm text-gray-600">Logos, photos, and guidelines</p>
              </div>
            </a>

            <a
              className="flex items-center gap-4 rounded-xl bg-gray-50 p-6 transition-colors hover:bg-gray-100"
              href="#contact"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <EnvelopeIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Media Contact</h3>
                <p className="text-sm text-gray-600">Get in touch with our team</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Press Releases */}
      <section className="py-16" id="press-releases">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Press Releases</h2>

          <div className="space-y-6">
            {pressReleases.map((release) => (
              <Link
                key={release.id}
                className="block rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
                href={`/press/${release.id}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCategoryColor(release.category)}`}
                      >
                        {release.category}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <CalendarIcon className="h-4 w-4" />
                        {release.date}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 hover:text-green-600">
                      {release.title}
                    </h3>
                    <p className="mt-2 text-gray-600">{release.excerpt}</p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-green-600">
                    Read More →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50">
              Load More
            </button>
          </div>
        </div>
      </section>

      {/* Media Coverage */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Media Coverage</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mediaMentions.map((mention) => (
              <a
                key={mention.id}
                className="block rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
                href={mention.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <DocumentTextIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <span className="font-semibold text-gray-900">{mention.publication}</span>
                </div>
                <h3 className="mb-2 line-clamp-2 text-lg font-medium text-gray-900">
                  {mention.title}
                </h3>
                <p className="text-sm text-gray-500">{mention.date}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Assets */}
      <section className="py-16" id="brand-assets">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Brand Assets</h2>
            <p className="mt-2 text-lg text-gray-600">
              Download official Skillancer brand assets for press and media use.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {brandAssets.map((asset) => (
              <div key={asset.name} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{asset.name}</h3>
                    <p className="mt-1 text-gray-600">{asset.description}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                      <span>Formats: {asset.formats.join(', ')}</span>
                      <span>Size: {asset.size}</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200">
                    <ArrowDownTrayIcon className="h-5 w-5" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl bg-green-50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <PhotoIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Complete Press Kit</h3>
                <p className="mt-1 text-gray-600">
                  Download our complete press kit including all logos, executive photos, product
                  screenshots, and brand guidelines.
                </p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition-colors hover:bg-green-500">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Download Press Kit (45 MB)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Media Contact */}
      <section className="bg-gray-50 py-16" id="contact">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">Media Contact</h2>
            <p className="mt-4 text-lg text-gray-600">
              For press inquiries, interview requests, or additional information, please contact our
              communications team.
            </p>

            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-gray-900">Press Inquiries</p>
                  <a
                    className="text-green-600 hover:text-green-500"
                    href="mailto:press@skillancer.com"
                  >
                    press@skillancer.com
                  </a>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Media Relations</p>
                  <p className="text-gray-600">Sarah Chen, VP of Communications</p>
                  <a
                    className="text-green-600 hover:text-green-500"
                    href="mailto:sarah.chen@skillancer.com"
                  >
                    sarah.chen@skillancer.com
                  </a>
                </div>
              </div>

              <p className="mt-6 text-sm text-gray-500">
                We typically respond to media inquiries within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link className="text-gray-600 hover:text-green-600" href="/about">
              About Us
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/leadership">
              Leadership
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/careers">
              Careers
            </Link>
            <Link className="text-gray-600 hover:text-green-600" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
