/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
'use client';

/**
 * Time Categories Page
 *
 * Manage time categories for organizing and filtering time entries.
 * Categories can be used for billing, reporting, and analysis.
 *
 * @module app/time/categories/page
 */

import {
  Tag,
  Plus,
  Edit3,
  Trash2,
  MoreHorizontal,
  Search,
  Check,
  X,
  Clock,
  DollarSign,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface TimeCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
  hourlyRate?: number;
  billable: boolean;
  isActive: boolean;
  entriesCount: number;
  totalHours: number;
}

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_CATEGORIES: TimeCategory[] = [
  {
    id: 'cat-1',
    name: 'Development',
    color: '#3B82F6',
    description: 'Coding, debugging, and software development tasks',
    hourlyRate: 150,
    billable: true,
    isActive: true,
    entriesCount: 234,
    totalHours: 485,
  },
  {
    id: 'cat-2',
    name: 'Design',
    color: '#8B5CF6',
    description: 'UI/UX design, mockups, and visual assets',
    hourlyRate: 125,
    billable: true,
    isActive: true,
    entriesCount: 89,
    totalHours: 156,
  },
  {
    id: 'cat-3',
    name: 'Meetings',
    color: '#F59E0B',
    description: 'Client calls, team meetings, and consultations',
    hourlyRate: 100,
    billable: true,
    isActive: true,
    entriesCount: 156,
    totalHours: 78,
  },
  {
    id: 'cat-4',
    name: 'Research',
    color: '#10B981',
    description: 'Market research, competitor analysis, learning',
    hourlyRate: 75,
    billable: false,
    isActive: true,
    entriesCount: 45,
    totalHours: 92,
  },
  {
    id: 'cat-5',
    name: 'Admin',
    color: '#6B7280',
    description: 'Administrative tasks, emails, organization',
    hourlyRate: undefined,
    billable: false,
    isActive: true,
    entriesCount: 67,
    totalHours: 34,
  },
];

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#D946EF',
  '#EC4899',
  '#F43F5E',
  '#6B7280',
  '#374151',
  '#000000',
];

// ============================================================================
// Utility Functions
// ============================================================================

function formatHours(hours: number): string {
  return `${hours.toLocaleString()}h`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// Category Form Component
// ============================================================================

function CategoryForm({
  category,
  onSave,
  onCancel,
}: {
  category?: TimeCategory;
  onSave: (data: Partial<TimeCategory>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    color: category?.color || PRESET_COLORS[0],
    description: category?.description || '',
    hourlyRate: category?.hourlyRate?.toString() || '',
    billable: category?.billable ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      hourlyRate: formData.hourlyRate ? Number.parseFloat(formData.hourlyRate) : undefined,
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        {category ? 'Edit Category' : 'New Category'}
      </h3>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            required
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="e.g., Development"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        {/* Color */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  formData.color === color
                    ? 'border-gray-900 dark:border-white'
                    : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="Brief description of this category"
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* Hourly Rate */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Default Hourly Rate
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              min={0}
              placeholder="0"
              step={1}
              type="number"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
            />
          </div>
        </div>

        {/* Billable Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Billable by default
          </label>
          <button
            className={`relative h-6 w-11 rounded-full transition-colors ${
              formData.billable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            type="button"
            onClick={() => setFormData({ ...formData, billable: !formData.billable })}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                formData.billable ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!formData.name}
            type="submit"
          >
            {category ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Category Card Component
// ============================================================================

function CategoryCard({
  category,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  category: TimeCategory;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-white p-4 transition-opacity dark:bg-gray-800 ${
        category.isActive
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-gray-100 opacity-60 dark:border-gray-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <Tag className="h-5 w-5" style={{ color: category.color }} />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
            {category.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => {
                    onEdit();
                    setIsMenuOpen(false);
                  }}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => {
                    onToggleActive();
                    setIsMenuOpen(false);
                  }}
                >
                  {category.isActive ? (
                    <>
                      <X className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={() => {
                    onDelete();
                    setIsMenuOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Entries</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {category.entriesCount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Hours</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatHours(category.totalHours)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rate</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {category.hourlyRate ? formatCurrency(category.hourlyRate) + '/hr' : '-'}
          </p>
        </div>
      </div>

      {/* Tags */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            category.billable
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          {category.billable ? 'Billable' : 'Non-billable'}
        </span>
        {!category.isActive && (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            Inactive
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TimeCategoriesPage() {
  const [categories, setCategories] = useState<TimeCategory[]>(SAMPLE_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TimeCategory | undefined>();

  // Filter categories
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate totals
  const totals = {
    entries: categories.reduce((sum, c) => sum + c.entriesCount, 0),
    hours: categories.reduce((sum, c) => sum + c.totalHours, 0),
    activeCount: categories.filter((c) => c.isActive).length,
  };

  const handleSaveCategory = (data: Partial<TimeCategory>) => {
    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategory.id ? { ...c, ...data } : c))
      );
    } else {
      const newCategory: TimeCategory = {
        id: `cat-${Date.now()}`,
        name: data.name || '',
        color: data.color || PRESET_COLORS[0],
        description: data.description,
        hourlyRate: data.hourlyRate,
        billable: data.billable ?? true,
        isActive: true,
        entriesCount: 0,
        totalHours: 0,
      };
      setCategories((prev) => [...prev, newCategory]);
    }
    setIsFormOpen(false);
    setEditingCategory(undefined);
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c)));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Categories</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Organize your time entries with custom categories
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
              <Tag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Categories</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {totals.activeCount}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/30">
              <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Hours</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatHours(totals.hours)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-900/30">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {totals.entries.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder="Search categories..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => {
            setEditingCategory(undefined);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {/* Form */}
      {isFormOpen && (
        <div className="mb-6">
          <CategoryForm
            category={editingCategory}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingCategory(undefined);
            }}
            onSave={handleSaveCategory}
          />
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onDelete={() => handleDeleteCategory(category.id)}
            onEdit={() => {
              setEditingCategory(category);
              setIsFormOpen(true);
            }}
            onToggleActive={() => handleToggleActive(category.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredCategories.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Tag className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {searchQuery
              ? 'No categories match your search'
              : 'No categories yet. Create your first one!'}
          </p>
          {!searchQuery && (
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Category
            </button>
          )}
        </div>
      )}
    </div>
  );
}
