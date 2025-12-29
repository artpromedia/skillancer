'use client';

import { useState, useEffect } from 'react';

interface LiveMetric {
  label: string;
  value: number;
  change: number;
  unit?: string;
}

export default function RealtimeMetricsPage() {
  const [metrics, setMetrics] = useState<LiveMetric[]>([
    { label: 'Users Online', value: 1247, change: 12 },
    { label: 'Active Sessions', value: 89, change: 3 },
    { label: 'Transactions/min', value: 23, change: -2 },
    { label: 'SkillPod Sessions', value: 47, change: 5 },
  ]);

  const [alerts] = useState([
    { type: 'warning', message: 'High API latency detected (>500ms)', time: '2 min ago' },
    { type: 'info', message: 'New deployment completed: v2.4.1', time: '15 min ago' },
    { type: 'success', message: 'Database backup completed', time: '1 hour ago' },
  ]);

  const [systemStatus] = useState({
    api: { status: 'operational', latency: 45 },
    database: { status: 'operational', latency: 12 },
    redis: { status: 'operational', latency: 3 },
    skillpod: { status: 'operational', latency: 28 },
    payments: { status: 'degraded', latency: 520 },
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) =>
        prev.map((m) => ({
          ...m,
          value: m.value + Math.floor(Math.random() * 10) - 5,
          change: Math.floor(Math.random() * 10) - 5,
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      operational: 'bg-green-500',
      degraded: 'bg-yellow-500',
      down: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getAlertColor = (type: string) => {
    const colors: Record<string, string> = {
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
    };
    return colors[type] || 'bg-gray-50 border-gray-200 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Real-time Metrics</h1>
          <p className="text-gray-600">Live platform monitoring and alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {/* Live Counters */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">{metric.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">
                {metric.value.toLocaleString()}
              </span>
              <span
                className={`text-sm font-medium ${
                  metric.change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {metric.change >= 0 ? '+' : ''}
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Live Charts */}
        <div className="col-span-2 space-y-6">
          {/* Signup Rate Chart */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Signup Rate (Last Hour)</h3>
            <div className="flex h-48 items-end justify-between gap-1">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-indigo-500"
                  style={{ height: `${20 + Math.random() * 80}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>60 min ago</span>
              <span>Now</span>
            </div>
          </div>

          {/* Transaction Rate Chart */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Transaction Rate (Last Hour)</h3>
            <div className="flex h-48 items-end justify-between gap-1">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-green-500"
                  style={{ height: `${10 + Math.random() * 90}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>60 min ago</span>
              <span>Now</span>
            </div>
          </div>

          {/* Error Rate Chart */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Error Rate (Last Hour)</h3>
            <div className="flex h-32 items-end justify-between gap-1">
              {Array.from({ length: 60 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-red-500"
                  style={{ height: `${Math.random() * 20}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>60 min ago</span>
              <span>Now</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* System Status */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">System Status</h3>
            <div className="space-y-3">
              {Object.entries(systemStatus).map(([service, status]) => (
                <div key={service} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${getStatusColor(status.status)}`} />
                    <span className="text-sm font-medium capitalize text-gray-900">{service}</span>
                  </div>
                  <span
                    className={`text-sm ${status.latency > 200 ? 'text-yellow-600' : 'text-gray-500'}`}
                  >
                    {status.latency}ms
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Panel */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Recent Alerts</h3>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className={`rounded-lg border p-3 ${getAlertColor(alert.type)}`}>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs opacity-75">{alert.time}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Today&apos;s Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Signups</dt>
                <dd className="font-medium text-gray-900">342</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total Transactions</dt>
                <dd className="font-medium text-gray-900">1,247</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Revenue</dt>
                <dd className="font-medium text-gray-900">$45,230</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Avg Response Time</dt>
                <dd className="font-medium text-gray-900">127ms</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
