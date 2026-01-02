'use client';

import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  GlobeAltIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentChartBarIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface FinancialHighlight {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
}

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'earnings' | 'conference' | 'presentation';
  location?: string;
}

interface Report {
  id: string;
  title: string;
  date: string;
  type: 'quarterly' | 'annual' | 'filing';
  size: string;
}

const financialHighlights: FinancialHighlight[] = [
  { label: 'Revenue', value: '$156M', change: '+42%', trend: 'up' },
  { label: 'Gross Marketplace Volume', value: '$2.1B', change: '+38%', trend: 'up' },
  { label: 'Active Clients', value: '145K', change: '+25%', trend: 'up' },
  { label: 'Verified Freelancers', value: '1.2M', change: '+52%', trend: 'up' },
];

const upcomingEvents: Event[] = [
  {
    id: '1',
    title: 'Q4 2024 Earnings Call',
    date: 'January 28, 2025',
    type: 'earnings',
  },
  {
    id: '2',
    title: 'J.P. Morgan Tech Conference',
    date: 'February 15, 2025',
    type: 'conference',
    location: 'San Francisco, CA',
  },
  {
    id: '3',
    title: 'Investor Day 2025',
    date: 'March 20, 2025',
    type: 'presentation',
    location: 'New York, NY',
  },
];

const recentReports: Report[] = [
  {
    id: 'q3-2024',
    title: 'Q3 2024 Earnings Report',
    date: 'October 28, 2024',
    type: 'quarterly',
    size: '2.4 MB',
  },
  {
    id: 'q2-2024',
    title: 'Q2 2024 Earnings Report',
    date: 'July 28, 2024',
    type: 'quarterly',
    size: '2.2 MB',
  },
  {
    id: 'annual-2023',
    title: '2023 Annual Report',
    date: 'February 28, 2024',
    type: 'annual',
    size: '8.5 MB',
  },
  {
    id: '10k-2023',
    title: 'Form 10-K 2023',
    date: 'February 28, 2024',
    type: 'filing',
    size: '4.1 MB',
  },
];

const keyMetrics = [
  {
    icon: GlobeAltIcon,
    label: 'Countries',
    value: '180+',
    description: 'Global marketplace reach',
  },
  {
    icon: UserGroupIcon,
    label: 'Platform Users',
    value: '5M+',
    description: 'Registered users worldwide',
  },
  {
    icon: CurrencyDollarIcon,
    label: 'Freelancer Earnings',
    value: '$500M+',
    description: 'Paid to freelancers in 2024',
  },
  {
    icon: ChartBarIcon,
    label: 'Net Revenue Retention',
    value: '125%',
    description: 'Enterprise customer retention',
  },
];

function getEventIcon(type: Event['type']) {
  switch (type) {
    case 'earnings':
      return <ChartBarIcon className="h-5 w-5" />;
    case 'conference':
      return <BuildingOffice2Icon className="h-5 w-5" />;
    case 'presentation':
      return <DocumentChartBarIcon className="h-5 w-5" />;
    default:
      return <CalendarIcon className="h-5 w-5" />;
  }
}

function getReportIcon(type: Report['type']) {
  switch (type) {
    case 'quarterly':
      return 'bg-blue-100 text-blue-600';
    case 'annual':
      return 'bg-green-100 text-green-600';
    case 'filing':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export default function InvestorsPage() {
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
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Investor Relations
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-300">
            Building the future of work. Access financial reports, SEC filings, and information for
            shareholders and prospective investors.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-500"
              href="#reports"
            >
              View Financial Reports
            </a>
            <a
              className="inline-flex items-center justify-center rounded-lg border border-gray-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800"
              href="#events"
            >
              Upcoming Events
            </a>
          </div>
        </div>
      </section>

      {/* Stock Info Banner (Placeholder) */}
      <section className="border-b border-gray-200 bg-gray-50 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">NASDAQ: SKLR</span>
              <span className="text-2xl font-bold text-gray-900">$78.52</span>
              <span className="inline-flex items-center font-medium text-green-600">
                <ArrowTrendingUpIcon className="mr-1 h-5 w-5" />
                +2.34 (3.07%)
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Last updated: December 30, 2024, 4:00 PM EST
            </div>
          </div>
        </div>
      </section>

      {/* Financial Highlights */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Financial Highlights</h2>
          <p className="mb-8 text-gray-600">Trailing twelve months ending September 30, 2024</p>

          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {financialHighlights.map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600">{item.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{item.value}</p>
                <p
                  className={`mt-2 text-sm font-medium ${
                    item.trend === 'up'
                      ? 'text-green-600'
                      : item.trend === 'down'
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {item.change} YoY
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Key Metrics</h2>

          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {keyMetrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <metric.icon className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
                <p className="mt-1 text-sm font-medium text-gray-900">{metric.label}</p>
                <p className="mt-1 text-sm text-gray-600">{metric.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reports & Filings */}
      <section className="py-16" id="reports">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Reports & Filings</h2>

          <div className="space-y-4">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-green-300"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg ${getReportIcon(report.type)}`}
                  >
                    <DocumentChartBarIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-500">{report.date}</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200">
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">Download</span>
                  <span className="text-sm text-gray-500">({report.size})</span>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
              href="/investors/filings"
            >
              View All SEC Filings
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="bg-gray-50 py-16" id="events">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Upcoming Events</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                    {getEventIcon(event.type)}
                  </div>
                  <span className="text-sm font-medium capitalize text-green-600">
                    {event.type}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {event.date}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-2">
                      <BuildingOffice2Icon className="h-4 w-4" />
                      {event.location}
                    </p>
                  )}
                </div>
                <button className="mt-4 text-sm font-medium text-green-600 hover:text-green-500">
                  Add to Calendar →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Corporate Governance */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-3xl font-bold text-gray-900">Corporate Governance</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link
              className="block rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
              href="/leadership"
            >
              <h3 className="text-lg font-semibold text-gray-900">Board of Directors</h3>
              <p className="mt-2 text-gray-600">
                Meet our board members and learn about their experience.
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-green-600">
                View Board →
              </span>
            </Link>

            <Link
              className="block rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-lg"
              href="/leadership"
            >
              <h3 className="text-lg font-semibold text-gray-900">Executive Team</h3>
              <p className="mt-2 text-gray-600">
                Learn about the leaders driving Skillancer's mission.
              </p>
              <span className="mt-4 inline-block text-sm font-medium text-green-600">
                View Team →
              </span>
            </Link>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-gray-900">Governance Documents</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a className="text-green-600 hover:text-green-500" href="#">
                    Certificate of Incorporation
                  </a>
                </li>
                <li>
                  <a className="text-green-600 hover:text-green-500" href="#">
                    Bylaws
                  </a>
                </li>
                <li>
                  <a className="text-green-600 hover:text-green-500" href="#">
                    Code of Conduct
                  </a>
                </li>
                <li>
                  <a className="text-green-600 hover:text-green-500" href="#">
                    Committee Charters
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* IR Contact */}
      <section className="bg-green-600 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold text-white">Investor Relations Contact</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-green-100">
            For investor inquiries, please contact our Investor Relations team.
          </p>
          <div className="inline-block rounded-xl bg-white p-8">
            <p className="font-semibold text-gray-900">John Smith</p>
            <p className="text-gray-600">Vice President, Investor Relations</p>
            <a
              className="mt-4 inline-block font-medium text-green-600 hover:text-green-500"
              href="mailto:ir@skillancer.com"
            >
              ir@skillancer.com
            </a>
          </div>
        </div>
      </section>

      {/* Email Alerts */}
      <section className="py-16">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Email Alerts</h2>
          <p className="mb-6 text-gray-600">
            Sign up to receive press releases, SEC filings, and event notifications.
          </p>
          <form className="flex gap-3">
            <input
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:ring-green-500"
              placeholder="Enter your email"
              type="email"
            />
            <button
              className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-500"
              type="submit"
            >
              Subscribe
            </button>
          </form>
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
            <Link className="text-gray-600 hover:text-green-600" href="/press">
              Press
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
