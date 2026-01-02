'use client';

import {
  BriefcaseIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  CurrencyDollarIcon,
  CheckBadgeIcon,
  ArrowTrendingUpIcon,
  BellIcon,
  ClockIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

// Mock data for dashboard
const stats = [
  {
    name: 'Active Contracts',
    value: '3',
    icon: BriefcaseIcon,
    change: '+1',
    changeType: 'increase',
  },
  {
    name: 'Pending Proposals',
    value: '7',
    icon: DocumentTextIcon,
    change: '+2',
    changeType: 'increase',
  },
  {
    name: 'Unread Messages',
    value: '12',
    icon: ChatBubbleLeftRightIcon,
    change: '-3',
    changeType: 'decrease',
  },
  { name: 'Avg. Rating', value: '4.9', icon: StarIcon, change: '+0.1', changeType: 'increase' },
];

const recentActivity = [
  {
    id: 1,
    type: 'proposal_accepted',
    title: 'Proposal Accepted',
    description: 'Your proposal for "E-commerce Website Redesign" was accepted',
    time: '2 hours ago',
    icon: CheckBadgeIcon,
    iconColor: 'text-green-600 bg-green-100',
  },
  {
    id: 2,
    type: 'message',
    title: 'New Message',
    description: 'John Doe sent you a message regarding the Mobile App project',
    time: '4 hours ago',
    icon: ChatBubbleLeftRightIcon,
    iconColor: 'text-blue-600 bg-blue-100',
  },
  {
    id: 3,
    type: 'payment',
    title: 'Payment Received',
    description: 'You received $1,500 for "Brand Identity Design"',
    time: '1 day ago',
    icon: CurrencyDollarIcon,
    iconColor: 'text-green-600 bg-green-100',
  },
  {
    id: 4,
    type: 'endorsement',
    title: 'New Endorsement',
    description: 'Sarah Miller endorsed your React.js skills',
    time: '2 days ago',
    icon: StarIcon,
    iconColor: 'text-yellow-600 bg-yellow-100',
  },
];

const activeContracts = [
  {
    id: 1,
    title: 'E-commerce Website Redesign',
    client: 'TechCorp Inc.',
    budget: '$5,000',
    deadline: 'Jan 15, 2025',
    progress: 65,
    status: 'In Progress',
  },
  {
    id: 2,
    title: 'Mobile App Development',
    client: 'StartupXYZ',
    budget: '$8,500',
    deadline: 'Feb 1, 2025',
    progress: 30,
    status: 'In Progress',
  },
  {
    id: 3,
    title: 'API Integration',
    client: 'DataFlow LLC',
    budget: '$2,000',
    deadline: 'Jan 5, 2025',
    progress: 90,
    status: 'Review',
  },
];

const recommendedJobs = [
  {
    id: 1,
    title: 'Senior React Developer',
    company: 'InnovateTech',
    budget: '$80-100/hr',
    skills: ['React', 'TypeScript', 'Node.js'],
    matchScore: 95,
  },
  {
    id: 2,
    title: 'Full-Stack Web Application',
    company: 'GrowthStartup',
    budget: '$10,000-15,000',
    skills: ['Next.js', 'PostgreSQL', 'AWS'],
    matchScore: 88,
  },
  {
    id: 3,
    title: 'UI/UX Redesign Project',
    company: 'DesignAgency',
    budget: '$5,000-8,000',
    skills: ['Figma', 'React', 'CSS'],
    matchScore: 82,
  },
];

const notifications = [
  { id: 1, message: 'Complete your profile to improve visibility', type: 'info' },
  { id: 2, message: 'Contract deadline approaching: API Integration (2 days)', type: 'warning' },
  { id: 3, message: 'New job matches your skills: 5 opportunities', type: 'success' },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link className="text-2xl font-bold text-green-600" href="/">
                Skillancer
              </Link>
              <nav className="hidden items-center gap-6 md:flex">
                <Link className="font-medium text-green-600" href="/dashboard">
                  Dashboard
                </Link>
                <Link className="text-gray-600 hover:text-gray-900" href="/jobs">
                  Find Jobs
                </Link>
                <Link className="text-gray-600 hover:text-gray-900" href="/dashboard/contracts">
                  Contracts
                </Link>
                <Link className="text-gray-600 hover:text-gray-900" href="/dashboard/messages">
                  Messages
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-500 hover:text-gray-700">
                <BellIcon className="h-6 w-6" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <Link className="flex items-center gap-2" href="/dashboard/profile">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 font-medium text-white">
                  JD
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, John! 👋</h1>
          <p className="mt-1 text-gray-600">
            Here's what's happening with your freelancing business.
          </p>
        </div>

        {/* Notifications Banner */}
        {notifications.length > 0 && (
          <div className="mb-8 space-y-2">
            {notifications.slice(0, 2).map((notification) => (
              <div
                key={notification.id}
                className={`flex items-center justify-between rounded-lg p-4 ${
                  notification.type === 'warning'
                    ? 'border border-yellow-200 bg-yellow-50'
                    : notification.type === 'success'
                      ? 'border border-green-200 bg-green-50'
                      : 'border border-blue-200 bg-blue-50'
                }`}
              >
                <p
                  className={`text-sm ${
                    notification.type === 'warning'
                      ? 'text-yellow-800'
                      : notification.type === 'success'
                        ? 'text-green-800'
                        : 'text-blue-800'
                  }`}
                >
                  {notification.message}
                </p>
                <button className="text-sm font-medium text-gray-500 hover:text-gray-700">
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <stat.icon className="h-6 w-6 text-green-600" />
                </div>
                <span
                  className={`inline-flex items-center text-sm font-medium ${
                    stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.name}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Active Contracts */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Active Contracts</h2>
                <Link
                  className="text-sm font-medium text-green-600 hover:text-green-500"
                  href="/dashboard/contracts"
                >
                  View All
                </Link>
              </div>
              <div className="divide-y divide-gray-200">
                {activeContracts.map((contract) => (
                  <div key={contract.id} className="p-6 transition-colors hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900">{contract.title}</h3>
                        <p className="mt-1 text-sm text-gray-600">{contract.client}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          contract.status === 'Review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {contract.status}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <CurrencyDollarIcon className="h-4 w-4" />
                        {contract.budget}
                      </div>
                      <div className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        Due: {contract.deadline}
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium text-gray-900">{contract.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-green-600 transition-all"
                          style={{ width: `${contract.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="p-4 transition-colors hover:bg-gray-50">
                    <div className="flex gap-3">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${activity.iconColor}`}
                      >
                        <activity.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                        <p className="truncate text-sm text-gray-600">{activity.description}</p>
                        <p className="mt-1 text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Jobs */}
        <div className="mt-8">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ArrowTrendingUpIcon className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Recommended for You</h2>
              </div>
              <Link
                className="text-sm font-medium text-green-600 hover:text-green-500"
                href="/jobs"
              >
                Browse All Jobs
              </Link>
            </div>
            <div className="grid grid-cols-1 divide-y divide-gray-200 md:grid-cols-3 md:divide-x md:divide-y-0">
              {recommendedJobs.map((job) => (
                <div key={job.id} className="p-6 transition-colors hover:bg-gray-50">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      {job.matchScore}% Match
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{job.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{job.company}</p>
                  <p className="mt-2 text-sm font-medium text-green-600">{job.budget}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <button className="mt-4 w-full rounded-lg border border-green-600 px-4 py-2 text-center text-sm font-medium text-green-600 transition-colors hover:bg-green-50">
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow-lg"
            href="/dashboard/proposals"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">My Proposals</span>
          </Link>
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow-lg"
            href="/dashboard/messages"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Messages</span>
          </Link>
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow-lg"
            href="/dashboard/endorsements"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
              <StarIcon className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Endorsements</span>
          </Link>
          <Link
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-green-300 hover:shadow-lg"
            href="/dashboard/recommendations"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <UserGroupIcon className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Recommendations</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <Link className="hover:text-green-600" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-green-600" href="/terms">
              Terms
            </Link>
            <Link className="hover:text-green-600" href="/faq">
              Help
            </Link>
            <Link className="hover:text-green-600" href="/contact">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
