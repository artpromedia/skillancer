'use client';

/**
 * Admin Dashboard Layout
 *
 * Main layout with sidebar navigation, header, and role-based access control.
 * Includes environment indicator and audit logging.
 *
 * @module app/layout
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  CreditCard,
  Scale,
  Shield,
  MonitorPlay,
  BarChart3,
  Settings,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  HelpCircle,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import type { LucideIcon } from 'lucide-react';
import '../styles/globals.css';
import {
  AdminAuthProvider,
  useAdminAuth,
  type AdminUser,
  type AdminRole,
} from '../lib/providers/auth';

// ============================================================================
// Query Client
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: number;
  roles?: AdminRole[];
  children?: NavItem[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get user initials from name or email
 */
function getUserInitials(user: AdminUser | null): string {
  if (!user) return '?';

  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }

  if (user.name) {
    const parts = user.name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.substring(0, 2).toUpperCase();
  }

  return user.email.substring(0, 2).toUpperCase();
}

/**
 * Get display name for role
 */
function getRoleDisplayName(role: AdminRole): string {
  const roleNames: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    super_admin: 'Super Admin',
    ADMIN: 'Admin',
    admin: 'Admin',
    operations: 'Operations',
    moderator: 'Moderator',
    support: 'Support',
    finance: 'Finance',
    analytics: 'Analytics',
  };
  return roleNames[role] || role.replace('_', ' ');
}

// ============================================================================
// Navigation Config
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    href: '/users',
    roles: ['super_admin', 'operations', 'support'],
  },
  {
    id: 'jobs',
    label: 'Jobs & Projects',
    icon: Briefcase,
    href: '/jobs',
    roles: ['super_admin', 'operations', 'moderator'],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: FileText,
    href: '/contracts',
    roles: ['super_admin', 'operations'],
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    href: '/payments',
    roles: ['super_admin', 'finance'],
  },
  {
    id: 'disputes',
    label: 'Disputes',
    icon: Scale,
    href: '/disputes',
    badge: 12,
    roles: ['super_admin', 'operations'],
  },
  {
    id: 'moderation',
    label: 'Content Moderation',
    icon: Shield,
    href: '/moderation',
    badge: 45,
    roles: ['super_admin', 'moderator'],
  },
  {
    id: 'skillpod',
    label: 'SkillPod Sessions',
    icon: MonitorPlay,
    href: '/skillpod',
    roles: ['super_admin', 'operations'],
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    icon: BarChart3,
    href: '/reports',
    roles: ['super_admin', 'analytics'],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    roles: ['super_admin'],
  },
];

// ============================================================================
// Environment Indicator
// ============================================================================

function EnvironmentIndicator() {
  const env = process.env.NEXT_PUBLIC_ENV || 'development';

  if (env === 'production') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        PRODUCTION
      </div>
    );
  }

  if (env === 'staging') {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
        <span className="h-2 w-2 rounded-full bg-yellow-500" />
        STAGING
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      DEV
    </div>
  );
}

// ============================================================================
// Sidebar Component
// ============================================================================

function Sidebar({
  isOpen,
  onClose,
  currentPath,
  userRole,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  userRole: AdminRole;
}>) {
  const filteredNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(userRole));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/50 lg:hidden"
          type="button"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-900 shadow-lg transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-700 px-4">
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Admin</span>
          </Link>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Environment */}
        <div className="border-b border-gray-700 px-4 py-3">
          <EnvironmentIndicator />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {filteredNav.map((item) => {
            const isActive =
              currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href));
            return (
              <Link
                key={item.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
                href={item.href}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Help & Support */}
        <div className="border-t border-gray-700 p-4">
          <Link
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
            href="/help"
          >
            <HelpCircle className="h-5 w-5" />
            Help & Docs
          </Link>
          <a
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white"
            href="https://status.skillancer.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Activity className="h-5 w-5" />
            System Status
          </a>
        </div>
      </aside>
    </>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header({
  onMenuClick,
  notifications,
  user,
  onLogout,
}: Readonly<{
  onMenuClick: () => void;
  notifications: number;
  user: AdminUser | null;
  onLogout: () => void;
}>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          className="rounded p-2 hover:bg-gray-100 lg:hidden dark:hover:bg-gray-700"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5 text-gray-500" />
        </button>

        {/* Global Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-80 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="Search users, transactions, disputes..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 md:inline">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Alerts */}
        <button className="relative rounded-lg p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20">
          <AlertTriangle className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-xs font-medium text-white">
            3
          </span>
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="h-5 w-5 text-gray-500" />
          {notifications > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
              {notifications > 9 ? '9+' : notifications}
            </span>
          )}
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium">{getUserInitials(user)}</span>
              )}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.name || 'Admin'}
              </p>
              <p className="text-xs text-gray-500">
                {user ? getRoleDisplayName(user.role) : 'Not signed in'}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>

          {isUserMenuOpen && (
            <>
              <button
                aria-label="Close menu"
                className="fixed inset-0 z-40 cursor-default border-0 bg-transparent"
                type="button"
                onClick={() => setIsUserMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.name || 'Admin'}
                  </p>
                  <p className="text-sm text-gray-500">{user?.email || 'Not signed in'}</p>
                </div>
                <Link
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  href="/settings/profile"
                >
                  <User className="h-4 w-4" />
                  My Profile
                </Link>
                <Link
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  href="/settings/activity"
                >
                  <Activity className="h-4 w-4" />
                  My Activity Log
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Admin Layout Inner
// ============================================================================

function AdminLayoutInner({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout, isLoading } = useAdminAuth();

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  // Show loading state while auth is being verified
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentPath={pathname}
        isOpen={isSidebarOpen}
        userRole={user?.role || 'support'}
        onClose={closeSidebar}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          notifications={5}
          user={user}
          onLogout={logout}
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

// ============================================================================
// Root Layout
// ============================================================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dynamic import for ErrorProvider
  const ErrorProvider = require('../lib/providers/error-provider').ErrorProvider;

  return (
    <html lang="en">
      <head>
        <title>Skillancer Admin</title>
        <meta content="Internal admin dashboard" name="description" />
        <meta content="noindex, nofollow" name="robots" />
      </head>
      <body className="bg-gray-100 dark:bg-gray-900">
        <ErrorProvider>
          <QueryClientProvider client={queryClient}>
            <AdminAuthProvider apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || ''}>
              <AdminLayoutInner>{children}</AdminLayoutInner>
            </AdminAuthProvider>
          </QueryClientProvider>
        </ErrorProvider>
      </body>
    </html>
  );
}
