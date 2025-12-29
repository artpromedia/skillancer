'use client';

import { useState } from 'react';

type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support' | 'analyst';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'invited' | 'suspended';
  lastLogin: string | null;
  createdAt: string;
  permissions: string[];
}

const mockAdmins: AdminUser[] = [
  {
    id: 'a1',
    name: 'John Super',
    email: 'john@skillancer.com',
    role: 'super_admin',
    status: 'active',
    lastLogin: '2024-01-15 09:30',
    createdAt: '2023-01-01',
    permissions: ['all'],
  },
  {
    id: 'a2',
    name: 'Jane Admin',
    email: 'jane@skillancer.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2024-01-14 16:45',
    createdAt: '2023-03-15',
    permissions: ['users', 'moderation', 'disputes', 'payments', 'reports'],
  },
  {
    id: 'a3',
    name: 'Mike Mod',
    email: 'mike@skillancer.com',
    role: 'moderator',
    status: 'active',
    lastLogin: '2024-01-15 08:00',
    createdAt: '2023-06-01',
    permissions: ['moderation', 'disputes'],
  },
  {
    id: 'a4',
    name: 'Sarah Support',
    email: 'sarah@skillancer.com',
    role: 'support',
    status: 'active',
    lastLogin: '2024-01-15 10:15',
    createdAt: '2023-08-20',
    permissions: ['users:read', 'support'],
  },
  {
    id: 'a5',
    name: 'Alex Analyst',
    email: 'alex@skillancer.com',
    role: 'analyst',
    status: 'active',
    lastLogin: '2024-01-13 14:00',
    createdAt: '2023-10-10',
    permissions: ['reports', 'analytics'],
  },
  {
    id: 'a6',
    name: 'Pending User',
    email: 'pending@example.com',
    role: 'moderator',
    status: 'invited',
    lastLogin: null,
    createdAt: '2024-01-10',
    permissions: ['moderation'],
  },
];

const roleColors: Record<AdminRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-indigo-100 text-indigo-700',
  moderator: 'bg-blue-100 text-blue-700',
  support: 'bg-green-100 text-green-700',
  analyst: 'bg-yellow-100 text-yellow-700',
};

const permissionGroups = [
  { name: 'Users', permissions: ['users', 'users:read', 'users:write', 'users:suspend'] },
  { name: 'Moderation', permissions: ['moderation', 'moderation:approve', 'moderation:reject'] },
  { name: 'Disputes', permissions: ['disputes', 'disputes:resolve'] },
  { name: 'Payments', permissions: ['payments', 'payments:refund', 'payments:payout'] },
  { name: 'Reports', permissions: ['reports', 'analytics'] },
  { name: 'Settings', permissions: ['settings', 'feature-flags'] },
  { name: 'Support', permissions: ['support', 'impersonate'] },
];

export default function AdminsPage() {
  const [admins] = useState<AdminUser[]>(mockAdmins);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');

  const filteredAdmins =
    filterRole === 'all' ? admins : admins.filter((a) => a.role === filterRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-gray-600">Manage admin access and permissions</p>
        </div>
        <button
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={() => setShowInviteModal(true)}
        >
          Invite Admin
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Total Admins</div>
          <div className="text-2xl font-bold text-gray-900">{admins.length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Super Admins</div>
          <div className="text-2xl font-bold text-purple-600">
            {admins.filter((a) => a.role === 'super_admin').length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Moderators</div>
          <div className="text-2xl font-bold text-blue-600">
            {admins.filter((a) => a.role === 'moderator').length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Active Today</div>
          <div className="text-2xl font-bold text-green-600">
            {admins.filter((a) => a.lastLogin?.includes('2024-01-15')).length}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Pending Invites</div>
          <div className="text-2xl font-bold text-yellow-600">
            {admins.filter((a) => a.status === 'invited').length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'super_admin', 'admin', 'moderator', 'support', 'analyst'].map((role) => (
          <button
            key={role}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filterRole === role
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setFilterRole(role)}
          >
            {role === 'all' ? 'All Roles' : role.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Admins List */}
      <div className="rounded-lg border bg-white">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Permissions
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Last Login
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAdmins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
                      {admin.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{admin.name}</p>
                      <p className="text-sm text-gray-500">{admin.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${roleColors[admin.role]}`}
                  >
                    {admin.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 text-sm ${
                      admin.status === 'active'
                        ? 'text-green-600'
                        : admin.status === 'invited'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        admin.status === 'active'
                          ? 'bg-green-600'
                          : admin.status === 'invited'
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                      }`}
                    />
                    {admin.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {admin.permissions.slice(0, 3).map((perm) => (
                      <span
                        key={perm}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                      >
                        {perm}
                      </span>
                    ))}
                    {admin.permissions.length > 3 && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        +{admin.permissions.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{admin.lastLogin || 'Never'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      onClick={() => setSelectedAdmin(admin)}
                    >
                      Edit
                    </button>
                    {admin.role !== 'super_admin' && (
                      <button className="text-sm font-medium text-red-600 hover:text-red-700">
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Invite Admin</h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowInviteModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="admin@example.com"
                  type="email"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select className="w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">Select role...</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="support">Support</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Permissions</label>
                <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border p-3">
                  {permissionGroups.map((group) => (
                    <div key={group.name}>
                      <p className="text-sm font-medium text-gray-900">{group.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm}
                            className="flex items-center gap-1 text-sm text-gray-600"
                          >
                            <input className="rounded" type="checkbox" />
                            {perm}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  onClick={() => setShowInviteModal(false)}
                >
                  Send Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Edit Admin: {selectedAdmin.name}
              </h3>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setSelectedAdmin(null)}
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  defaultValue={selectedAdmin.role}
                  disabled={selectedAdmin.role === 'super_admin'}
                >
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="support">Support</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Permissions</label>
                <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border p-3">
                  {permissionGroups.map((group) => (
                    <div key={group.name}>
                      <p className="text-sm font-medium text-gray-900">{group.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm}
                            className="flex items-center gap-1 text-sm text-gray-600"
                          >
                            <input
                              className="rounded"
                              defaultChecked={
                                selectedAdmin.permissions.includes('all') ||
                                selectedAdmin.permissions.includes(perm)
                              }
                              disabled={selectedAdmin.role === 'super_admin'}
                              type="checkbox"
                            />
                            {perm}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setSelectedAdmin(null)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  onClick={() => setSelectedAdmin(null)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
