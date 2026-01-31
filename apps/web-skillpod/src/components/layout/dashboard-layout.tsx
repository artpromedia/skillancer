'use client';

import { cn } from '@skillancer/ui';
import {
  Home,
  BookOpen,
  Award,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  Settings,
  User,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SkillPodAuthProvider, useSkillPodAuth, type SkillPodUser } from '@/lib/providers/auth';

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Learning', href: '/learn', icon: BookOpen },
  { label: 'Assessments', href: '/assessments', icon: ClipboardCheck },
  { label: 'Credentials', href: '/credentials', icon: Award },
  { label: 'SkillPods', href: '/pods', icon: GraduationCap },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const bottomNavItems: NavItem[] = [{ label: 'Settings', href: '/settings', icon: Settings }];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col border-r border-gray-200 bg-white transition-all',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        {!collapsed && (
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900">SkillPod</span>
          </Link>
        )}
        <button
          className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <Link
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                href={item.href}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    isActive(item.href)
                      ? 'text-indigo-600'
                      : 'text-gray-400 group-hover:text-gray-600'
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-100 py-4">
        <ul className="space-y-1 px-2">
          {bottomNavItems.map((item) => (
            <li key={item.href}>
              <Link
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                href={item.href}
              >
                <item.icon className="h-5 w-5" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function Header() {
  const { user, logout, isLoading } = useSkillPodAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /**
   * Get user initials from name or email
   */
  function getUserInitials(u: SkillPodUser | null): string {
    if (!u) return '?';

    if (u.firstName && u.lastName) {
      return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
    }

    if (u.name) {
      const parts = u.name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return u.name.substring(0, 2).toUpperCase();
    }

    return u.email.substring(0, 2).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="max-w-xl flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-lg border-0 bg-gray-100 py-2 pl-10 pr-4 transition-colors focus:bg-white focus:ring-2 focus:ring-indigo-500"
              placeholder="Search skills, assessments, credentials..."
              type="search"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="ml-4 flex items-center gap-4">
          <button className="relative rounded-lg p-2 transition-colors hover:bg-gray-100">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-white">{getUserInitials(user)}</span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {userMenuOpen && (
              <>
                <button
                  aria-label="Close menu"
                  className="fixed inset-0 z-40 cursor-default border-0 bg-transparent"
                  type="button"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{user?.name || 'Guest'}</p>
                    <p className="text-xs text-gray-500">{user?.email || 'Not signed in'}</p>
                  </div>
                  <Link
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <div className="border-t border-gray-200">
                    <button
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
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
      </div>
    </header>
  );
}

function DashboardLayoutInner({ children }: { readonly children: React.ReactNode }) {
  const { isLoading } = useSkillPodAuth();

  // Show loading state while auth is being verified
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <SkillPodAuthProvider apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || ''}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SkillPodAuthProvider>
  );
}

export default DashboardLayout;
