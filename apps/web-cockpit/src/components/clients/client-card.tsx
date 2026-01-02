'use client';

/**
 * Client Card Component
 *
 * Reusable client card for displaying client information
 * in grid or list views.
 *
 * @module components/clients/client-card
 */

import { Mail, Phone, Plus, MoreHorizontal, MessageSquare } from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

export interface ClientCardProps {
  id: string;
  companyName: string;
  contactName: string;
  contactTitle?: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'prospect';
  platform: string;
  tags?: string[];
  projectsCount: number;
  totalRevenue: number;
  lastContact: string;
  onEmail?: () => void;
  onCall?: () => void;
  onNewProject?: () => void;
  onLogActivity?: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'inactive':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    case 'prospect':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getPlatformColor(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'skillancer':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'upwork':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'fiverr':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'toptal':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Main Component
// ============================================================================

export function ClientCard({
  id,
  companyName,
  contactName,
  contactTitle,
  email,
  phone,
  avatar,
  status,
  platform,
  tags = [],
  projectsCount,
  totalRevenue,
  lastContact,
  onEmail,
  onCall,
  onNewProject,
  onLogActivity,
}: Readonly<ClientCardProps>) {
  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEmail) {
      onEmail();
    } else {
      globalThis.location.href = `mailto:${email}`;
    }
  };

  const handleCallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onCall) {
      onCall();
    } else if (phone) {
      globalThis.location.href = `tel:${phone}`;
    }
  };

  const handleNewProjectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onNewProject?.();
  };

  const handleLogActivityClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onLogActivity?.();
  };

  return (
    <Link
      className="group block rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      href={`/clients/${id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img alt={companyName} className="h-12 w-12 rounded-full object-cover" src={avatar} />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-semibold text-white">
              {getInitials(companyName)}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate font-medium text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
              {companyName}
            </h3>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {contactName}
              {contactTitle && ` · ${contactTitle}`}
            </p>
          </div>
        </div>
        <span
          className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(status)}`}
        >
          {status}
        </span>
      </div>

      {/* Tags Row */}
      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */}
      <div className="mt-3 flex items-center gap-2 overflow-hidden">
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(platform)}`}
        >
          {platform}
        </span>
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */}
        {(tags as string[]).slice(0, 2).map((tag: string) => (
          <span
            key={tag}
            className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          >
            {tag}
          </span>
        ))}
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
        {(tags as string[]).length > 2 && (
          <span className="flex-shrink-0 text-xs text-gray-400">
            +{(tags as string[]).length - 2}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Projects</p>
          <p className="font-medium text-gray-900 dark:text-white">{projectsCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Last Contact</p>
          <p className="font-medium text-gray-900 dark:text-white">{formatDate(lastContact)}</p>
        </div>
      </div>

      {/* Quick Actions (visible on hover) */}
      <div className="mt-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          onClick={handleEmailClick}
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </button>
        {phone && (
          <button
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick={handleCallClick}
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </button>
        )}
        <button
          className="flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
          onClick={handleNewProjectClick}
        >
          <Plus className="h-3.5 w-3.5" />
          Project
        </button>
        <button
          className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          onClick={handleLogActivityClick}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Log
        </button>
      </div>
    </Link>
  );
}

// ============================================================================
// List Row Variant
// ============================================================================

export function ClientListRow({
  id,
  companyName,
  contactName,
  // email and phone are part of ClientCardProps but not used in list view
  avatar,
  status,
  platform,
  projectsCount,
  totalRevenue,
  lastContact,
}: Readonly<ClientCardProps>) {
  return (
    <Link
      className="group flex items-center gap-4 border-b border-gray-100 px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
      href={`/clients/${id}`}
    >
      {avatar ? (
        <img
          alt={companyName}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          src={avatar}
        />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
          {getInitials(companyName)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {companyName}
        </p>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{contactName}</p>
      </div>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(platform)}`}
      >
        {platform}
      </span>
      <span
        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getStatusColor(status)}`}
      >
        {status}
      </span>
      <div className="w-20 text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{projectsCount}</p>
        <p className="text-xs text-gray-500">projects</p>
      </div>
      <div className="w-24 text-right">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatCurrency(totalRevenue)}
        </p>
        <p className="text-xs text-gray-500">revenue</p>
      </div>
      <div className="w-24 text-right">
        <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(lastContact)}</p>
      </div>
      <button
        className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-700"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </Link>
  );
}

export default ClientCard;
