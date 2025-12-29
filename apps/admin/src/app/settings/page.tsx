'use client';

import Link from 'next/link';

const settingsCategories = [
  {
    id: 'feature-flags',
    name: 'Feature Flags',
    description: 'Toggle features and rollout percentages',
    icon: '🚩',
  },
  {
    id: 'admins',
    name: 'Admin Users',
    description: 'Manage admin accounts and permissions',
    icon: '👤',
  },
  {
    id: 'commission',
    name: 'Commission Rates',
    description: 'Platform fees and pricing configuration',
    icon: '💵',
  },
  {
    id: 'verification',
    name: 'Verification Settings',
    description: 'Identity and skill verification requirements',
    icon: '✅',
  },
  {
    id: 'emails',
    name: 'Email Templates',
    description: 'Customize transactional email templates',
    icon: '📧',
  },
  {
    id: 'notifications',
    name: 'Notification Settings',
    description: 'Push and in-app notification configuration',
    icon: '🔔',
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Third-party service configurations',
    icon: '🔗',
  },
  {
    id: 'maintenance',
    name: 'Maintenance Mode',
    description: 'Platform maintenance and downtime settings',
    icon: '🔧',
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-600">Configure platform-wide settings and features</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 gap-4">
        {settingsCategories.map((category) => (
          <Link
            key={category.id}
            className="rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
            href={`/settings/${category.id}`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{category.icon}</span>
              <div>
                <h3 className="font-medium text-gray-900">{category.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{category.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Settings */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium text-gray-900">Quick Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Maintenance Mode</p>
              <p className="text-sm text-gray-500">Temporarily disable public access</p>
            </div>
            <button className="relative h-6 w-11 rounded-full bg-gray-200 transition-colors">
              <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">New User Registration</p>
              <p className="text-sm text-gray-500">Allow new users to sign up</p>
            </div>
            <button className="relative h-6 w-11 rounded-full bg-green-500 transition-colors">
              <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Payment Processing</p>
              <p className="text-sm text-gray-500">Enable payment transactions</p>
            </div>
            <button className="relative h-6 w-11 rounded-full bg-green-500 transition-colors">
              <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-medium text-gray-900">Environment Information</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Environment</dt>
            <dd className="font-medium text-gray-900">Production</dd>
          </div>
          <div>
            <dt className="text-gray-500">Version</dt>
            <dd className="font-medium text-gray-900">v2.4.1</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Deploy</dt>
            <dd className="font-medium text-gray-900">2024-01-15 10:30 UTC</dd>
          </div>
          <div>
            <dt className="text-gray-500">Database</dt>
            <dd className="font-medium text-gray-900">PostgreSQL 15.2</dd>
          </div>
          <div>
            <dt className="text-gray-500">Cache</dt>
            <dd className="font-medium text-gray-900">Redis 7.0</dd>
          </div>
          <div>
            <dt className="text-gray-500">Region</dt>
            <dd className="font-medium text-gray-900">us-east-1</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
