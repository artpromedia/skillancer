'use client';

import { cn } from '@skillancer/ui';
import {
  Clock,
  Calendar,
  CheckCircle,
  Square as _Square,
  Search,
  Filter as _Filter,
  ChevronDown,
  Briefcase,
  DollarSign as _DollarSign,
} from 'lucide-react';
import { useState } from 'react';

// Types
interface TimeEntry {
  id: string;
  description: string;
  projectId: string;
  projectName: string;
  clientName: string;
  date: string;
  hours: number;
  rate: number;
  isBillable: boolean;
  isInvoiced: boolean;
}

interface ImportTimeEntriesProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: TimeEntry[]) => void;
  projectId?: string;
  clientId?: string;
}

// Mock Data
const mockTimeEntries: TimeEntry[] = [
  {
    id: '1',
    description: 'Frontend development - Homepage redesign',
    projectId: '1',
    projectName: 'Website Redesign',
    clientName: 'Acme Corp',
    date: '2024-12-14',
    hours: 4,
    rate: 150,
    isBillable: true,
    isInvoiced: false,
  },
  {
    id: '2',
    description: 'Backend API integration - User authentication',
    projectId: '1',
    projectName: 'Website Redesign',
    clientName: 'Acme Corp',
    date: '2024-12-13',
    hours: 6,
    rate: 150,
    isBillable: true,
    isInvoiced: false,
  },
  {
    id: '3',
    description: 'UI/UX design review and feedback',
    projectId: '1',
    projectName: 'Website Redesign',
    clientName: 'Acme Corp',
    date: '2024-12-12',
    hours: 3,
    rate: 125,
    isBillable: true,
    isInvoiced: false,
  },
  {
    id: '4',
    description: 'Database schema optimization',
    projectId: '1',
    projectName: 'Website Redesign',
    clientName: 'Acme Corp',
    date: '2024-12-11',
    hours: 5,
    rate: 150,
    isBillable: true,
    isInvoiced: false,
  },
  {
    id: '5',
    description: 'Mobile app development - Phase 1',
    projectId: '2',
    projectName: 'Mobile App',
    clientName: 'TechStart Inc',
    date: '2024-12-14',
    hours: 8,
    rate: 175,
    isBillable: true,
    isInvoiced: false,
  },
  {
    id: '6',
    description: 'Internal meeting',
    projectId: '1',
    projectName: 'Website Redesign',
    clientName: 'Acme Corp',
    date: '2024-12-10',
    hours: 1,
    rate: 0,
    isBillable: false,
    isInvoiced: false,
  },
];

const mockProjects = [
  { id: '1', name: 'Website Redesign', clientName: 'Acme Corp' },
  { id: '2', name: 'Mobile App', clientName: 'TechStart Inc' },
  { id: '3', name: 'Brand Identity', clientName: 'Design Studio' },
];

export function ImportTimeEntries({
  isOpen,
  onClose,
  onImport,
  projectId,
  _clientId,
}: ImportTimeEntriesProps) {
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [showOnlyBillable, setShowOnlyBillable] = useState(true);

  if (!isOpen) return null;

  // Filter entries
  const filteredEntries = mockTimeEntries.filter((entry) => {
    const matchesProject = !selectedProject || entry.projectId === selectedProject;
    const matchesSearch =
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBillable = !showOnlyBillable || entry.isBillable;
    const matchesDate = entry.date >= dateRange.start && entry.date <= dateRange.end;
    return matchesProject && matchesSearch && matchesBillable && matchesDate && !entry.isInvoiced;
  });

  // Calculations
  const selectedEntriesData = filteredEntries.filter((e) => selectedEntries.has(e.id));
  const totalHours = selectedEntriesData.reduce((sum, e) => sum + e.hours, 0);
  const totalAmount = selectedEntriesData.reduce((sum, e) => sum + e.hours * e.rate, 0);

  const toggleEntry = (id: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEntries(newSelected);
  };

  const toggleAll = () => {
    if (selectedEntries.size === filteredEntries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const handleImport = () => {
    onImport(selectedEntriesData);
    onClose();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white">
        {/* Header */}
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900">Import Time Entries</h2>
          <p className="mt-1 text-sm text-gray-500">Select time entries to add to your invoice</p>
        </div>

        {/* Filters */}
        <div className="space-y-4 border-b border-gray-100 p-4">
          <div className="flex gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search entries..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Project Filter */}
            <div className="relative w-48">
              <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                className="w-full appearance-none rounded-lg border border-gray-200 py-2 pl-10 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">All Projects</option>
                {mockProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <span className="text-gray-400">to</span>
              <input
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>

            {/* Billable Only */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={showOnlyBillable}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                type="checkbox"
                onChange={(e) => setShowOnlyBillable(e.target.checked)}
              />
              <span className="text-sm text-gray-600">Billable only</span>
            </label>
          </div>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length > 0 ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      checked={selectedEntries.size === filteredEntries.length}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      type="checkbox"
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Project
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-gray-50',
                      selectedEntries.has(entry.id) && 'bg-indigo-50'
                    )}
                    onClick={() => toggleEntry(entry.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        checked={selectedEntries.has(entry.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        type="checkbox"
                        onChange={() => toggleEntry(entry.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="line-clamp-1 text-sm text-gray-900">{entry.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">{entry.projectName}</div>
                      <div className="text-xs text-gray-400">{entry.clientName}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {entry.hours}h
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">${entry.rate}/h</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      ${(entry.hours * entry.rate).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No time entries found</p>
              <p className="text-sm text-gray-400">Try adjusting your filters</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-gray-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-sm text-gray-500">Selected</div>
                <div className="font-semibold text-gray-900">{selectedEntries.size} entries</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Hours</div>
                <div className="font-semibold text-gray-900">{totalHours}h</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Amount</div>
                <div className="font-semibold text-indigo-600">${totalAmount.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
                  selectedEntries.size > 0
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'cursor-not-allowed bg-gray-200 text-gray-400'
                )}
                disabled={selectedEntries.size === 0}
                onClick={handleImport}
              >
                <CheckCircle className="h-4 w-4" />
                Import {selectedEntries.size} {selectedEntries.size === 1 ? 'Entry' : 'Entries'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportTimeEntries;
