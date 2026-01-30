/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/**
 * Cockpit App Layout
 *
 * Main layout with sidebar navigation, header with timer widget,
 * notifications, and user menu.
 *
 * @module app/layout
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Home,
  Clock,
  Briefcase,
  Users,
  DollarSign,
  FileText,
  Calendar,
  Puzzle,
  BarChart3,
  Settings,
  Search,
  Bell,
  Plus,
  Timer,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import '../styles/globals.css';

// ============================================================================
// TanStack Query Client
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
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
  icon: typeof Home;
  href: string;
  badge?: number;
}

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
}

// ============================================================================
// Navigation Config
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/' },
  { id: 'ai-coach', label: 'AI Coach', icon: Sparkles, href: '/ai/coach' },
  { id: 'time', label: 'Time Tracking', icon: Clock, href: '/time' },
  { id: 'projects', label: 'Projects', icon: Briefcase, href: '/projects' },
  { id: 'clients', label: 'Clients', icon: Users, href: '/clients' },
  { id: 'finances', label: 'Finances', icon: DollarSign, href: '/finances' },
  { id: 'invoices', label: 'Invoices', icon: FileText, href: '/invoices' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: '/calendar' },
  { id: 'integrations', label: 'Integrations', icon: Puzzle, href: '/integrations' },
  { id: 'reports', label: 'Reports', icon: BarChart3, href: '/reports' },
  { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

// ============================================================================
// Sidebar Component
// ============================================================================

function Sidebar({
  isOpen,
  onClose,
  currentPath,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
}>) {
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
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-200 lg:static lg:translate-x-0 dark:bg-gray-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">Cockpit</span>
          </Link>
          <button className="rounded p-1 hover:bg-gray-100 lg:hidden" onClick={onClose}>
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
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

        {/* User Profile Mini */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                Alex Johnson
              </p>
              <p className="truncate text-xs text-gray-500">alex@example.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================================
// Header Timer Widget
// ============================================================================

function HeaderTimerWidget() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    // Check for active timer
    const stored = localStorage.getItem('activeTimer');
    if (stored) {
      const timer = JSON.parse(stored) as { projectName?: string; startTime: string };
      setIsRunning(true);
      setProjectName(timer.projectName || 'No project');
      const startTime = new Date(timer.startTime).getTime();
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  if (!isRunning) {
    return (
      <Link
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        href="/time?action=start"
      >
        <Timer className="h-4 w-4" />
        Start Timer
      </Link>
    );
  }

  return (
    <Link
      className="flex items-center gap-3 rounded-lg bg-green-50 px-3 py-2 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      href="/time"
    >
      <div className="relative">
        <Timer className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-green-500" />
      </div>
      <span className="hidden font-mono text-sm font-medium sm:inline">
        {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:
        {seconds.toString().padStart(2, '0')}
      </span>
      <span className="hidden text-sm md:inline">{projectName}</span>
    </Link>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function Header({
  onMenuClick,
  notifications,
}: Readonly<{
  onMenuClick: () => void;
  notifications: number;
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

        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="w-64 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="Search..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Timer Widget */}
        <HeaderTimerWidget />

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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
              <span className="text-sm font-medium">AJ</span>
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Alex Johnson</p>
                  <p className="text-xs text-gray-500">alex@example.com</p>
                </div>
                <Link
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  href="/settings/profile"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Link
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  href="/settings"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <Link
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  href="/help"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help Center
                </Link>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => {
                      // Handle logout
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
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
// Floating Action Button
// ============================================================================

function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { id: 'timer', label: 'Start Timer', icon: Timer, href: '/time?action=start' },
    { id: 'entry', label: 'Add Time Entry', icon: Clock, href: '/time?action=add' },
    { id: 'expense', label: 'Log Expense', icon: DollarSign, href: '/expenses/new' },
    { id: 'invoice', label: 'Create Invoice', icon: FileText, href: '/invoices/new' },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <>
          <button
            aria-label="Close actions"
            className="fixed inset-0 cursor-default border-0 bg-transparent"
            type="button"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-16 right-0 mb-2 space-y-2">
            {actions.map((action) => (
              <Link
                key={action.id}
                className="flex items-center gap-3 whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                href={action.href}
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            ))}
          </div>
        </>
      )}
      <button
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:bg-blue-700 ${
          isOpen ? 'rotate-45' : ''
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

// ============================================================================
// Main Layout
// ============================================================================

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const notifications = 3;

  return (
    <html lang="en">
      <body className="bg-gray-50 dark:bg-gray-900">
        <QueryClientProvider client={queryClient}>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <Sidebar
              currentPath={pathname}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content */}
            <div className="flex flex-1 flex-col">
              <Header notifications={notifications} onMenuClick={() => setSidebarOpen(true)} />
              <main className="flex-1">{children}</main>
            </div>
          </div>

          {/* Floating Action Button */}
          <FloatingActionButton />
        </QueryClientProvider>
      </body>
    </html>
  );
}
