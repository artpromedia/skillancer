'use client';

import { useState } from 'react';

import { Impersonate } from '../../components/support';
import { useTickets, useSupportStats } from '../../hooks/api/use-support';

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
    icon: 'key',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'verify_email',
    label: 'Verify Email',
    description: 'Manually verify user email',
    icon: 'mail',
    color: 'bg-green-50 text-green-700',
  },
  {
    id: 'unlock_account',
    label: 'Unlock Account',
    description: 'Remove account lock',
    icon: 'unlock',
    color: 'bg-yellow-50 text-yellow-700',
  },
  {
    id: 'clear_sessions',
    label: 'Clear Sessions',
    description: 'Log out all devices',
    icon: 'device',
    color: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'refresh_kyc',
    label: 'Refresh KYC',
    description: 'Re-trigger verification',
    icon: 'clipboard',
    color: 'bg-indigo-50 text-indigo-700',
  },
  {
    id: 'recalc_balance',
    label: 'Recalculate Balance',
    description: 'Fix balance discrepancy',
    icon: 'dollar',
    color: 'bg-orange-50 text-orange-700',
  },
];

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showImpersonate, setShowImpersonate] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'tickets'>('tools');
  const [ticketPage, setTicketPage] = useState(1);

  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = useTickets({
    page: ticketPage,
    limit: 20,
  } as never);
  const { data: statsData } = useSupportStats();

  const tickets = ticketsData?.data ?? [];
  const totalPages = ticketsData?.totalPages ?? 1;
  const supportStats = statsData?.data;

  const handleUserSearch = () => {
    if (searchQuery.trim()) {
      setSelectedUserId('u-12345');
    }
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
    urgent: 'bg-red-100 text-red-700',
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Tools</h1>
        <p className="text-gray-600">User lookup, quick actions, and support utilities</p>
      </div>

      {/* Stats bar */}
      {supportStats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">Open Tickets</div>
            <div className="text-2xl font-bold text-blue-600">{supportStats.openTickets ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">Avg Response Time</div>
            <div className="text-2xl font-bold text-gray-900">
              {supportStats.avgResponseTime ? `${Math.round(supportStats.avgResponseTime / 60)}m` : '-'}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">Resolved Today</div>
            <div className="text-2xl font-bold text-green-600">{supportStats.resolvedToday ?? 0}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">Satisfaction</div>
            <div className="text-2xl font-bold text-gray-900">
              {supportStats.satisfactionScore ? `${supportStats.satisfactionScore}%` : '-'}
            </div>
          </div>
        </div>
      )}

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
              <p className="font-medium">{action.label}</p>
              <p className="text-sm opacity-75">{action.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Support Tickets */}
      {activeTab === 'tickets' && (
        <>
          {/* Loading State */}
          {ticketsLoading && (
            <div className="flex items-center justify-center rounded-lg border bg-white py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <span className="ml-3 text-gray-500">Loading tickets...</span>
            </div>
          )}

          {/* Error State */}
          {ticketsError && !ticketsLoading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <p className="font-medium text-red-800">Failed to load tickets</p>
              <p className="mt-1 text-sm text-red-600">
                {ticketsError instanceof Error ? ticketsError.message : 'An unexpected error occurred'}
              </p>
            </div>
          )}

          {/* Tickets Table */}
          {!ticketsLoading && !ticketsError && tickets.length > 0 && (
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
                  {tickets.map((ticket: Record<string, unknown>) => (
                    <tr key={ticket.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm text-gray-900">
                        {(ticket.ticketNumber as string) || (ticket.id as string)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                          onClick={() => {
                            setSearchQuery(
                              (ticket.userName as string) ||
                              (ticket.user as Record<string, string>)?.name ||
                              ''
                            );
                            setSelectedUserId(
                              (ticket.userId as string) ||
                              (ticket.user as Record<string, string>)?.id ||
                              ''
                            );
                          }}
                        >
                          {(ticket.userName as string) ||
                            (ticket.user as Record<string, string>)?.name ||
                            'Unknown'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ticket.subject as string}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[(ticket.priority as string) || ''] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {ticket.priority as string}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[(ticket.status as string) || ''] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {ticket.status as string}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ticket.createdAt
                          ? new Date(ticket.createdAt as string).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-gray-500">
                  Page {ticketPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={ticketPage <= 1}
                    onClick={() => setTicketPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={ticketPage >= totalPages}
                    onClick={() => setTicketPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!ticketsLoading && !ticketsError && tickets.length === 0 && (
            <div className="rounded-lg border bg-white py-12 text-center">
              <p className="text-lg font-medium text-gray-900">No tickets found</p>
              <p className="mt-1 text-gray-500">There are no support tickets at this time</p>
            </div>
          )}
        </>
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
