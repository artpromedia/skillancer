'use client';

import { useState } from 'react';

type DataSource = 'users' | 'contracts' | 'payments' | 'jobs' | 'skillpod' | 'disputes';
type ChartType = 'line' | 'bar' | 'pie' | 'table';

interface ReportConfig {
  dataSource: DataSource;
  metrics: string[];
  dimensions: string[];
  filters: { field: string; operator: string; value: string }[];
  dateRange: { start: string; end: string };
  chartType: ChartType;
}

const dataSources: { key: DataSource; label: string; metrics: string[]; dimensions: string[] }[] = [
  {
    key: 'users',
    label: 'Users',
    metrics: ['signups', 'active_users', 'retention_rate', 'churn_rate'],
    dimensions: ['date', 'user_type', 'country', 'verification_level'],
  },
  {
    key: 'contracts',
    label: 'Contracts',
    metrics: ['count', 'total_value', 'avg_value', 'completion_rate'],
    dimensions: ['date', 'status', 'category', 'client_type'],
  },
  {
    key: 'payments',
    label: 'Payments',
    metrics: ['volume', 'count', 'avg_transaction', 'fees_collected'],
    dimensions: ['date', 'type', 'status', 'currency'],
  },
  {
    key: 'jobs',
    label: 'Jobs',
    metrics: ['posted', 'filled', 'fill_rate', 'avg_bids'],
    dimensions: ['date', 'category', 'budget_range', 'job_type'],
  },
  {
    key: 'skillpod',
    label: 'SkillPod',
    metrics: ['sessions', 'total_hours', 'violations', 'resource_usage'],
    dimensions: ['date', 'tenant', 'user_type'],
  },
  {
    key: 'disputes',
    label: 'Disputes',
    metrics: ['opened', 'resolved', 'avg_resolution_time', 'total_value'],
    dimensions: ['date', 'type', 'resolution'],
  },
];

export default function ReportBuilderPage() {
  const [config, setConfig] = useState<ReportConfig>({
    dataSource: 'users',
    metrics: ['signups'],
    dimensions: ['date'],
    filters: [],
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    chartType: 'line',
  });
  const [reportName, setReportName] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const currentSource = dataSources.find((ds) => ds.key === config.dataSource);

  const handleMetricToggle = (metric: string) => {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter((m) => m !== metric)
        : [...prev.metrics, metric],
    }));
  };

  const handleDimensionToggle = (dimension: string) => {
    setConfig((prev) => ({
      ...prev,
      dimensions: prev.dimensions.includes(dimension)
        ? prev.dimensions.filter((d) => d !== dimension)
        : [...prev.dimensions, dimension],
    }));
  };

  const addFilter = () => {
    setConfig((prev) => ({
      ...prev,
      filters: [...prev.filters, { field: '', operator: 'equals', value: '' }],
    }));
  };

  const removeFilter = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Report Builder</h1>
          <p className="text-gray-600">Create and customize reports with your data</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Generate Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="col-span-2 space-y-6">
          {/* Report Name */}
          <div className="rounded-lg border bg-white p-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Report Name</label>
            <input
              className="w-full rounded-lg border px-4 py-2"
              placeholder="e.g., Monthly User Growth Analysis"
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
            />
          </div>

          {/* Data Source */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Data Source</h3>
            <div className="grid grid-cols-3 gap-2">
              {dataSources.map((ds) => (
                <button
                  key={ds.key}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    config.dataSource === ds.key
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      dataSource: ds.key,
                      metrics: [ds.metrics[0] ?? ''],
                      dimensions: ['date'],
                    }))
                  }
                >
                  <span className="font-medium text-gray-900">{ds.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Metrics</h3>
            <div className="flex flex-wrap gap-2">
              {currentSource?.metrics.map((metric) => (
                <button
                  key={metric}
                  className={`rounded-full px-3 py-1 text-sm capitalize ${
                    config.metrics.includes(metric)
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handleMetricToggle(metric)}
                >
                  {metric.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Group By (Dimensions)</h3>
            <div className="flex flex-wrap gap-2">
              {currentSource?.dimensions.map((dimension) => (
                <button
                  key={dimension}
                  className={`rounded-full px-3 py-1 text-sm capitalize ${
                    config.dimensions.includes(dimension)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => handleDimensionToggle(dimension)}
                >
                  {dimension.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-lg border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Filters</h3>
              <button
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                onClick={addFilter}
              >
                + Add Filter
              </button>
            </div>
            {config.filters.length === 0 ? (
              <p className="text-sm text-gray-500">No filters applied</p>
            ) : (
              <div className="space-y-2">
                {config.filters.map((filter, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      className="rounded-lg border px-3 py-2 text-sm"
                      value={filter.field}
                      onChange={(e) => {
                        const newFilters = [...config.filters];
                        if (newFilters[i]) {
                          newFilters[i].field = e.target.value;
                        }
                        setConfig((prev) => ({ ...prev, filters: newFilters }));
                      }}
                    >
                      <option value="">Select field...</option>
                      {currentSource?.dimensions.map((d) => (
                        <option key={d} value={d}>
                          {d.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-lg border px-3 py-2 text-sm"
                      value={filter.operator}
                      onChange={(e) => {
                        const newFilters = [...config.filters];
                        if (newFilters[i]) {
                          newFilters[i].operator = e.target.value;
                        }
                        setConfig((prev) => ({ ...prev, filters: newFilters }));
                      }}
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                      <option value="contains">contains</option>
                      <option value="greater_than">greater than</option>
                      <option value="less_than">less than</option>
                    </select>
                    <input
                      className="flex-1 rounded-lg border px-3 py-2 text-sm"
                      placeholder="Value"
                      type="text"
                      value={filter.value}
                      onChange={(e) => {
                        const newFilters = [...config.filters];
                        if (newFilters[i]) {
                          newFilters[i].value = e.target.value;
                        }
                        setConfig((prev) => ({ ...prev, filters: newFilters }));
                      }}
                    />
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeFilter(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Date Range</h3>
            <div className="flex items-center gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Start Date</label>
                <input
                  className="rounded-lg border px-3 py-2"
                  type="date"
                  value={config.dateRange.start}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value },
                    }))
                  }
                />
              </div>
              <span className="text-gray-400">to</span>
              <div>
                <label className="mb-1 block text-xs text-gray-500">End Date</label>
                <input
                  className="rounded-lg border px-3 py-2"
                  type="date"
                  value={config.dateRange.end}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="flex gap-2">
                <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                  Last 7 days
                </button>
                <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                  Last 30 days
                </button>
                <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                  This month
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Visualization Type */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Visualization</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'line', label: 'Line Chart', icon: '📈' },
                { key: 'bar', label: 'Bar Chart', icon: '📊' },
                { key: 'pie', label: 'Pie Chart', icon: '🥧' },
                { key: 'table', label: 'Table', icon: '📋' },
              ].map((chart) => (
                <button
                  key={chart.key}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    config.chartType === chart.key
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, chartType: chart.key as ChartType }))
                  }
                >
                  <div className="text-xl">{chart.icon}</div>
                  <div className="mt-1 text-xs text-gray-700">{chart.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Export Options</h3>
            <div className="space-y-2">
              <button className="w-full rounded-lg border px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                📊 Export as Excel
              </button>
              <button className="w-full rounded-lg border px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                📄 Export as CSV
              </button>
              <button className="w-full rounded-lg border px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
                📑 Export as PDF
              </button>
            </div>
          </div>

          {/* Save & Schedule */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-4 font-medium text-gray-900">Save Report</h3>
            <div className="space-y-2">
              <button className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Save Template
              </button>
              <button className="w-full rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Schedule Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <div className="rounded-lg border bg-white p-6">
          <h3 className="mb-4 font-medium text-gray-900">Report Preview</h3>
          <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50">
            <p className="text-gray-500">Chart preview would render here based on configuration</p>
          </div>
        </div>
      )}
    </div>
  );
}
