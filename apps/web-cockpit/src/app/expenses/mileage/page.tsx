/* eslint-disable jsx-a11y/label-has-associated-control */
'use client';

import { cn } from '@skillancer/ui';
import {
  ArrowLeft,
  Car,
  Plus,
  Search,
  Calendar,
  Route,
  DollarSign,
  Edit,
  Trash2,
  Download,
  X,
  Check,
  Briefcase,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface MileageTrip {
  id: string;
  date: string;
  purpose: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  ratePerMile: number;
  projectId?: string;
  projectName?: string;
  isRoundTrip: boolean;
  notes?: string;
}

const IRS_RATE_2024 = 0.67; // IRS standard mileage rate for 2024

// TODO(Sprint-10): Replace with API call to GET /api/cockpit/expenses/mileage
const mockTrips: MileageTrip[] = [
  {
    id: '1',
    date: '2024-01-15',
    purpose: 'Client meeting',
    startLocation: 'Home Office',
    endLocation: 'Acme Corp - Downtown',
    distance: 12.5,
    ratePerMile: IRS_RATE_2024,
    projectId: 'proj-1',
    projectName: 'Website Redesign',
    isRoundTrip: true,
    notes: 'Met with stakeholders for project kickoff',
  },
  {
    id: '2',
    date: '2024-01-14',
    purpose: 'Equipment pickup',
    startLocation: 'Home Office',
    endLocation: 'Best Buy - Tech District',
    distance: 8.2,
    ratePerMile: IRS_RATE_2024,
    isRoundTrip: true,
  },
  {
    id: '3',
    date: '2024-01-12',
    purpose: 'Networking event',
    startLocation: 'Home Office',
    endLocation: 'Convention Center',
    distance: 15.0,
    ratePerMile: IRS_RATE_2024,
    isRoundTrip: true,
  },
  {
    id: '4',
    date: '2024-01-10',
    purpose: 'Site visit',
    startLocation: 'Home Office',
    endLocation: 'TechStart Inc - North Campus',
    distance: 22.3,
    ratePerMile: IRS_RATE_2024,
    projectId: 'proj-2',
    projectName: 'Mobile App',
    isRoundTrip: true,
  },
];

const mockProjects = [
  { id: 'proj-1', name: 'Website Redesign', clientName: 'Acme Corp' },
  { id: 'proj-2', name: 'Mobile App', clientName: 'TechStart Inc' },
  { id: 'proj-3', name: 'Brand Identity', clientName: 'Design Studio' },
];

export default function MileagePage() {
  const [trips, setTrips] = useState<MileageTrip[]>(mockTrips);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [editingTrip, setEditingTrip] = useState<MileageTrip | null>(null);

  // Calculate totals
  const totalMiles = trips.reduce(
    (sum, trip) => sum + (trip.isRoundTrip ? trip.distance * 2 : trip.distance),
    0
  );
  const totalDeduction = trips.reduce(
    (sum, trip) => sum + (trip.isRoundTrip ? trip.distance * 2 : trip.distance) * trip.ratePerMile,
    0
  );
  const thisMonthTrips = trips.filter((trip) => {
    const tripDate = new Date(trip.date);
    const now = new Date();
    return tripDate.getMonth() === now.getMonth() && tripDate.getFullYear() === now.getFullYear();
  });
  const thisMonthMiles = thisMonthTrips.reduce(
    (sum, trip) => sum + (trip.isRoundTrip ? trip.distance * 2 : trip.distance),
    0
  );

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.startLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.endLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="mb-4 flex items-center gap-4">
            <Link className="rounded-lg p-2 transition-colors hover:bg-gray-100" href="/expenses">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mileage Tracker</h1>
              <p className="text-sm text-gray-500">
                Track business trips for tax deductions at ${IRS_RATE_2024}/mile (2024 IRS rate)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2">
                <Route className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm text-gray-500">Total Miles (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalMiles.toFixed(1)} mi</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Tax Deduction (YTD)</span>
            </div>
            <p className="text-2xl font-bold text-green-600">${totalDeduction.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">This Month</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{thisMonthMiles.toFixed(1)} mi</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm text-gray-500">Total Trips</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{trips.length}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-64 rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Search trips..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4" />
              Log Trip
            </button>
          </div>
        </div>

        {/* Trips List */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Purpose
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Project
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Distance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Deduction
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTrips.map((trip) => {
                const actualDistance = trip.isRoundTrip ? trip.distance * 2 : trip.distance;
                const deduction = actualDistance * trip.ratePerMile;
                return (
                  <tr key={trip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{formatDate(trip.date)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{trip.purpose}</p>
                      {trip.notes && (
                        <p className="max-w-xs truncate text-sm text-gray-500">{trip.notes}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <Navigation className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="text-sm">
                          <p className="text-gray-900">{trip.startLocation}</p>
                          <p className="text-gray-500">→ {trip.endLocation}</p>
                          {trip.isRoundTrip && (
                            <span className="text-xs text-indigo-600">(Round trip)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {trip.projectName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-700">
                          <Briefcase className="h-3 w-3" />
                          {trip.projectName}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-gray-900">
                        {actualDistance.toFixed(1)} mi
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-green-600">${deduction.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                          onClick={() => setEditingTrip(trip)}
                        >
                          <Edit className="h-4 w-4 text-gray-500" />
                        </button>
                        <button className="rounded-lg p-2 transition-colors hover:bg-gray-100">
                          <Trash2 className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTrips.length === 0 && (
            <div className="py-12 text-center">
              <div className="mb-4 inline-block rounded-full bg-gray-100 p-4">
                <Car className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mb-1 text-lg font-medium text-gray-900">No trips logged</h3>
              <p className="mb-4 text-sm text-gray-500">Start tracking your business mileage</p>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="h-4 w-4" />
                Log Your First Trip
              </button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <h4 className="mb-1 font-medium text-blue-900">💡 Tax Tip</h4>
          <p className="text-sm text-blue-700">
            The IRS allows you to deduct ${IRS_RATE_2024} per mile for business travel in 2024. Keep
            records of your trips including the date, destination, and business purpose for your tax
            return.
          </p>
        </div>
      </div>

      {/* Add/Edit Trip Modal */}
      {(showAddModal || editingTrip) && (
        <TripModal
          initialData={editingTrip || undefined}
          isOpen={true}
          projects={mockProjects}
          onClose={() => {
            setShowAddModal(false);
            setEditingTrip(null);
          }}
          onSubmit={(trip) => {
            if (editingTrip) {
              setTrips(
                trips.map((t) => (t.id === editingTrip.id ? { ...trip, id: editingTrip.id } : t))
              );
            } else {
              setTrips([{ ...trip, id: Date.now().toString() }, ...trips]);
            }
            setShowAddModal(false);
            setEditingTrip(null);
          }}
        />
      )}
    </div>
  );
}

// Trip Modal Component
interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (trip: MileageTrip) => void;
  initialData?: MileageTrip;
  projects: { id: string; name: string; clientName: string }[];
}

function TripModal({ isOpen, onClose, onSubmit, initialData, projects }: TripModalProps) {
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState(initialData?.purpose || '');
  const [startLocation, setStartLocation] = useState(initialData?.startLocation || 'Home Office');
  const [endLocation, setEndLocation] = useState(initialData?.endLocation || '');
  const [distance, setDistance] = useState(initialData?.distance || 0);
  const [isRoundTrip, setIsRoundTrip] = useState(initialData?.isRoundTrip ?? true);
  const [projectId, setProjectId] = useState(initialData?.projectId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const selectedProject = projects.find((p) => p.id === projectId);
    onSubmit({
      id: '',
      date,
      purpose,
      startLocation,
      endLocation,
      distance,
      ratePerMile: IRS_RATE_2024,
      isRoundTrip,
      projectId: projectId || undefined,
      projectName: selectedProject?.name,
      notes: notes || undefined,
    });

    setIsSaving(false);
  };

  const actualDistance = isRoundTrip ? distance * 2 : distance;
  const deduction = actualDistance * IRS_RATE_2024;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Trip' : 'Log Trip'}
          </h2>
          <button className="rounded-lg p-2 transition-colors hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Business Purpose</label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Client meeting, Site visit"
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          {/* Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Start location"
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Destination"
                type="text"
                value={endLocation}
                onChange={(e) => setEndLocation(e.target.value)}
              />
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              One-way Distance (miles)
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min="0"
              step="0.1"
              type="number"
              value={distance}
              onChange={(e) => setDistance(Number.parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Round Trip */}
          <div className="flex items-center gap-3">
            <input
              checked={isRoundTrip}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              id="isRoundTrip"
              type="checkbox"
              onChange={(e) => setIsRoundTrip(e.target.checked)}
            />
            <label className="text-sm text-gray-700" htmlFor="isRoundTrip">
              Round trip (double the distance)
            </label>
          </div>

          {/* Project */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Project (optional)
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.clientName})
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Additional details..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Total Distance</p>
                <p className="text-lg font-bold text-green-900">
                  {actualDistance.toFixed(1)} miles
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-700">Tax Deduction</p>
                <p className="text-lg font-bold text-green-900">${deduction.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 p-6">
          <button
            className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cn(
              'flex items-center gap-2 rounded-lg px-6 py-2 transition-colors',
              !purpose || !endLocation || distance <= 0 || isSaving
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            )}
            disabled={!purpose || !endLocation || distance <= 0 || isSaving}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {initialData ? 'Save Changes' : 'Log Trip'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
