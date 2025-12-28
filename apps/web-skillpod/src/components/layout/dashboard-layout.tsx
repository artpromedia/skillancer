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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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
          <button className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
              <User className="h-4 w-4 text-white" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
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

export default DashboardLayout;
