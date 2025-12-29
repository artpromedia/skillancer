'use client';

import Link from 'next/link';

export default function SkillPodAdminPage() {
  const stats = {
    activeSessions: 47,
    violationsToday: 12,
    storageUsed: '2.4 TB',
    storageTotal: '5 TB',
    cpuUsage: 68,
    memoryUsage: 54,
  };

  const recentAlerts = [
    {
      id: 'a1',
      type: 'security',
      message: 'Multiple file access attempts from user u123',
      severity: 'high',
      time: '5 min ago',
    },
    {
      id: 'a2',
      type: 'violation',
      message: 'Screen recording detected in session s456',
      severity: 'medium',
      time: '12 min ago',
    },
    {
      id: 'a3',
      type: 'resource',
      message: 'High CPU usage in tenant t789',
      severity: 'low',
      time: '25 min ago',
    },
  ];

  const quickLinks = [
    { label: 'View All Sessions', href: '/skillpod/sessions', icon: '🖥️' },
    { label: 'Review Violations', href: '/skillpod/violations', icon: '⚠️' },
    { label: 'Resource Monitoring', href: '/skillpod/resources', icon: '📊' },
    { label: 'Tenant Management', href: '/skillpod/tenants', icon: '🏢' },
  ];

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SkillPod Administration</h1>
        <p className="text-gray-600">Monitor and manage secure workspace sessions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Active Sessions</div>
          <div className="text-2xl font-bold text-green-600">{stats.activeSessions}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Violations Today</div>
          <div className="text-2xl font-bold text-red-600">{stats.violationsToday}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Storage Usage</div>
          <div className="text-2xl font-bold text-gray-900">{stats.storageUsed}</div>
          <div className="text-xs text-gray-500">of {stats.storageTotal}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Resource Usage</div>
          <div className="flex items-end gap-2">
            <div className="text-lg font-bold text-gray-900">CPU: {stats.cpuUsage}%</div>
            <div className="text-lg font-bold text-gray-900">Mem: {stats.memoryUsage}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Quick Links */}
        <div className="col-span-1">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-gray-50"
                  href={link.href}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="font-medium text-gray-900">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Security Alerts */}
        <div className="col-span-2">
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Recent Security Alerts</h3>
              <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View All →
              </button>
            </div>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-3 ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-xs opacity-75">{alert.time}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium uppercase">
                      {alert.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Sessions Preview */}
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Live Sessions</h3>
          <Link
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            href="/skillpod/sessions"
          >
            View All Sessions →
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Session #{1000 + i}</span>
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
              </div>
              <div className="aspect-video rounded bg-gray-200" />
              <div className="mt-2 text-xs text-gray-500">User: freelancer{i}@example.com</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
