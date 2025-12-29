'use client';

import { useState } from 'react';

import { Impersonate } from '../../components/support';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'reset_password',
    label: 'Reset Password',
    description: 'Send password reset email',
    icon: '🔑',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'verify_email',
    label: 'Verify Email',
    description: 'Manually verify user email',
    icon: '✉️',
    color: 'bg-green-50 text-green-700',
  },
  {
    id: 'unlock_account',
    label: 'Unlock Account',
    description: 'Remove account lock',
    icon: '🔓',
    color: 'bg-yellow-50 text-yellow-700',
  },
  {
    id: 'clear_sessions',
    label: 'Clear Sessions',
    description: 'Log out all devices',
    icon: '📱',
    color: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'refresh_kyc',
    label: 'Refresh KYC',
    description: 'Re-trigger verification',
    icon: '📋',
    color: 'bg-indigo-50 text-indigo-700',
  },
  {
    id: 'recalc_balance',
    label: 'Recalculate Balance',
    description: 'Fix balance discrepancy',
    icon: '💰',
    color: 'bg-orange-50 text-orange-700',
  },
];

interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

const mockTickets: SupportTicket[] = [
  {
    id: 'T-001',
    userId: 'u1',
    userName: 'John Doe',
    subject: 'Cannot withdraw funds',
    status: 'open',
    priority: 'high',
    createdAt: '2024-01-15 10:30',
  },
  {
    id: 'T-002',
    userId: 'u2',
    userName: 'Jane Smith',
    subject: 'Profile verification stuck',
    status: 'pending',
    priority: 'medium',
    createdAt: '2024-01-15 09:15',
  },
  {
    id: 'T-003',
    userId: 'u3',
    userName: 'Bob Wilson',
    subject: 'Payment not received',
    status: 'open',
    priority: 'high',
    createdAt: '2024-01-15 08:45',
  },
  {
    id: 'T-004',
    userId: 'u4',
    userName: 'Alice Brown',
    subject: 'How to change email',
    status: 'resolved',
    priority: 'low',
    createdAt: '2024-01-14 16:20',
  },
];

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showImpersonate, setShowImpersonate] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'tickets'>('tools');

  const handleUserSearch = () => {
    if (searchQuery.trim()) {
      setSelectedUserId('u-12345');
    }
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };

  const statusColors = {
    open: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Tools</h1>
        <p className="text-gray-600">User lookup, quick actions, and support utilities</p>
      </div>

      {/* User Search */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">User Lookup</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-lg border px-4 py-2"
            placeholder="Search by email, user ID, or name..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
          />
          <button
            className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
            onClick={handleUserSearch}
          >
            Search
          </button>
        </div>

        {/* Selected User */}
        {selectedUserId && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-medium text-indigo-700">
                  JD
                </div>
                <div>
                  <p className="font-medium text-gray-900">John Doe</p>
                  <p className="text-sm text-gray-500">john.doe@example.com</p>
                  <p className="text-xs text-gray-400">ID: {selectedUserId}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600"
                  onClick={() => setShowImpersonate(true)}
                >
                  Impersonate
                </button>
                <a
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  href={`/users/${selectedUserId}`}
                >
                  View Profile
                </a>
              </div>
            </div>

            {/* User Stats */}
            <div className="mt-4 grid grid-cols-5 gap-3">
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Account Status</div>
                <div className="text-sm font-medium text-green-600">Active</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Account Age</div>
                <div className="text-sm font-medium text-gray-900">8 months</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Verification</div>
                <div className="text-sm font-medium text-green-600">Verified</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Balance</div>
                <div className="text-sm font-medium text-gray-900">$2,450.00</div>
              </div>
              <div className="rounded-lg bg-white p-3">
                <div className="text-xs text-gray-500">Open Disputes</div>
                <div className="text-sm font-medium text-red-600">1</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === 'tools'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('tools')}
        >
          Quick Actions
        </button>
        <button
          className={`border-b-2 px-4 py-2 text-sm font-medium ${
            activeTab === 'tickets'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('tickets')}
        >
          Support Tickets
        </button>
      </div>

      {/* Quick Actions */}
      {activeTab === 'tools' && (
        <div className="grid grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className={`rounded-lg border p-4 text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${action.color}`}
              disabled={!selectedUserId}
            >
              <div className="mb-2 text-2xl">{action.icon}</div>
              <p className="font-medium">{action.label}</p>
              <p className="text-sm opacity-75">{action.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Support Tickets */}
      {activeTab === 'tickets' && (
        <div className="rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Ticket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mockTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-900">{ticket.id}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      onClick={() => {
                        setSearchQuery(ticket.userName);
                        setSelectedUserId(ticket.userId);
                      }}
                    >
                      {ticket.userName}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{ticket.subject}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[ticket.priority]}`}
                    >
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[ticket.status]}`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{ticket.createdAt}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Impersonate Modal */}
      {showImpersonate && selectedUserId && (
        <Impersonate
          userId={selectedUserId}
          userName="John Doe"
          onClose={() => setShowImpersonate(false)}
        />
      )}
    </div>
  );
}
