/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Project Form Component
 *
 * Add/Edit project form with sections for project details,
 * timeline, budget, and settings.
 *
 * @module components/projects/project-form
 */

import {
  FolderKanban,
  Calendar,
  DollarSign,
  Clock,
  Tag,
  Settings,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ProjectType = 'fixed' | 'hourly' | 'retainer' | 'milestone';
export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high';

export interface ProjectFormData {
  // Basic Info
  name: string;
  description?: string;
  clientId: string;
  platform: string;

  // Timeline
  startDate: string;
  dueDate?: string;

  // Project Type & Budget
  type: ProjectType;
  budget: number;
  hourlyRate?: number;
  hoursEstimated?: number;

  // Settings
  status: ProjectStatus;
  priority: ProjectPriority;

  // Tags
  tags: string[];

  // Notes
  notes?: string;
}

export interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  clients: { id: string; name: string }[];
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Helpers
// ============================================================================

function getSubmitButtonText(isLoading: boolean, hasExistingName: boolean): string {
  if (isLoading) return 'Saving...';
  return hasExistingName ? 'Save Changes' : 'Create Project';
}

const PLATFORMS = [
  'Skillancer',
  'Upwork',
  'Fiverr',
  'Toptal',
  'Freelancer',
  'Direct',
  'Referral',
  'Other',
];

const PROJECT_TYPES: { value: ProjectType; label: string; description: string }[] = [
  { value: 'fixed', label: 'Fixed Price', description: 'One-time project with set budget' },
  { value: 'hourly', label: 'Hourly', description: 'Bill based on hours worked' },
  { value: 'retainer', label: 'Retainer', description: 'Recurring monthly engagement' },
  { value: 'milestone', label: 'Milestone', description: 'Payment tied to deliverables' },
];

// ============================================================================
// Form Section Component
// ============================================================================

function FormSection({
  title,
  icon: Icon,
  children,
  collapsible = false,
  defaultOpen = true,
}: Readonly<{
  title: string;
  icon: typeof FolderKanban;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <button
        className={`flex w-full items-center justify-between p-4 ${
          collapsible ? 'cursor-pointer' : 'cursor-default'
        }`}
        type="button"
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        {collapsible &&
          (isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ))}
      </button>
      {isOpen && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">{children}</div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectForm({
  initialData,
  clients,
  onSubmit,
  onCancel,
  isLoading = false,
}: Readonly<ProjectFormProps>) {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    clientId: initialData?.clientId || '',
    platform: initialData?.platform || 'Direct',
    startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
    dueDate: initialData?.dueDate || '',
    type: initialData?.type || 'fixed',
    budget: initialData?.budget || 0,
    hourlyRate: initialData?.hourlyRate,
    hoursEstimated: initialData?.hoursEstimated,
    status: initialData?.status || 'active',
    priority: initialData?.priority || 'medium',
    tags: initialData?.tags || [],
    notes: initialData?.notes || '',
  });

  const [newTag, setNewTag] = useState('');

  const updateField = <K extends keyof ProjectFormData>(field: K, value: ProjectFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateField('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateField(
      'tags',
      formData.tags.filter((t) => t !== tag)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Basic Info */}
      <FormSection icon={FolderKanban} title="Project Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-name"
            >
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-name"
              placeholder="E-commerce Platform Redesign"
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-description"
            >
              Description
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-description"
              placeholder="Brief description of the project scope..."
              rows={3}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-client"
            >
              Client <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-client"
              value={formData.clientId}
              onChange={(e) => updateField('clientId', e.target.value)}
            >
              <option value="">Select a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-platform"
            >
              Source Platform
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-platform"
              value={formData.platform}
              onChange={(e) => updateField('platform', e.target.value)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      {/* Timeline */}
      <FormSection icon={Calendar} title="Timeline">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-start-date"
            >
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-start-date"
              type="date"
              value={formData.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-due-date"
            >
              Due Date
            </label>
            <input
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-due-date"
              type="date"
              value={formData.dueDate}
              onChange={(e) => updateField('dueDate', e.target.value)}
            />
          </div>
        </div>
      </FormSection>

      {/* Budget & Billing */}
      <FormSection icon={DollarSign} title="Budget & Billing">
        <div className="space-y-4">
          {/* Project Type Selection */}
          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Project Type
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    formData.type === type.value
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                  }`}
                  type="button"
                  onClick={() => updateField('type', type.value)}
                >
                  <p
                    className={`font-medium ${formData.type === type.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}
                  >
                    {type.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Budget fields based on type */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                htmlFor="project-budget"
              >
                {formData.type === 'hourly' ? 'Budget Cap' : 'Total Budget'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  id="project-budget"
                  placeholder="10000"
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) => updateField('budget', Number.parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {(formData.type === 'hourly' || formData.type === 'retainer') && (
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  htmlFor="project-hourly-rate"
                >
                  Hourly Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    id="project-hourly-rate"
                    placeholder="100"
                    type="number"
                    value={formData.hourlyRate || ''}
                    onChange={(e) =>
                      updateField('hourlyRate', Number.parseFloat(e.target.value) || undefined)
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <label
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                htmlFor="project-hours-estimated"
              >
                Estimated Hours
              </label>
              <input
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                id="project-hours-estimated"
                placeholder="100"
                type="number"
                value={formData.hoursEstimated || ''}
                onChange={(e) =>
                  updateField('hoursEstimated', Number.parseFloat(e.target.value) || undefined)
                }
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* Settings */}
      <FormSection collapsible defaultOpen={false} icon={Settings} title="Settings">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-status"
            >
              Status
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-status"
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value as ProjectStatus)}
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              htmlFor="project-priority"
            >
              Priority
            </label>
            <select
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              id="project-priority"
              value={formData.priority}
              onChange={(e) => updateField('priority', e.target.value as ProjectPriority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
      </FormSection>

      {/* Tags */}
      <FormSection collapsible defaultOpen={false} icon={Tag} title="Tags">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {tag}
                <button
                  className="rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Add a tag..."
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <button
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              type="button"
              onClick={handleAddTag}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </FormSection>

      {/* Notes */}
      <FormSection collapsible defaultOpen={false} icon={Clock} title="Notes">
        <textarea
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Internal notes about this project..."
          rows={4}
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
        />
      </FormSection>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          disabled={isLoading}
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={isLoading || !formData.name || !formData.clientId}
          type="submit"
        >
          {getSubmitButtonText(isLoading, !!initialData?.name)}
        </button>
      </div>
    </form>
  );
}

export default ProjectForm;
