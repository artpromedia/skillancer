'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

// ============================================================================
// Navigation Configuration
// ============================================================================

const navigation: NavItem[] = [
  {
    label: 'Products',
    href: '#',
    children: [
      { label: 'SkillPod', href: '/skillpod' },
      { label: 'SmartMatch', href: '/smartmatch' },
      { label: 'Cockpit', href: '/cockpit' },
      { label: 'Verify', href: '/verify' },
    ],
  },
  {
    label: 'Solutions',
    href: '#',
    children: [
      { label: 'For Freelancers', href: '/for-freelancers' },
      { label: 'For Clients', href: '/for-clients' },
      { label: 'Enterprise', href: '/enterprise' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Help', href: '/help' },
];

// ============================================================================
// Header Component
// ============================================================================

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 shadow-sm backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* Logo */}
          <Link className="flex items-center gap-2" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent">
              Skillancer
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                {item.children ? (
                  <>
                    <button
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        isScrolled
                          ? 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                          : 'text-slate-700 hover:bg-white/10 hover:text-indigo-600'
                      }`}
                    >
                      {item.label}
                      <svg
                        className="ml-1 inline-block h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M19 9l-7 7-7-7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    </button>
                    {openDropdown === item.label && (
                      <div className="absolute left-0 top-full pt-2">
                        <div className="min-w-[200px] rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              className="block px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-indigo-600"
                              href={child.href}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'text-indigo-600'
                        : isScrolled
                          ? 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                          : 'text-slate-700 hover:bg-white/10 hover:text-indigo-600'
                    }`}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isScrolled
                  ? 'text-slate-700 hover:text-indigo-600'
                  : 'text-slate-700 hover:text-indigo-600'
              }`}
              href="/login"
            >
              Log in
            </Link>
            <Link
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg"
              href="/signup"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            aria-label="Toggle menu"
            className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white shadow-xl lg:hidden">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-4">
            {navigation.map((item) => (
              <div key={item.label}>
                {item.children ? (
                  <div className="space-y-1">
                    <button
                      className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() =>
                        setOpenDropdown(openDropdown === item.label ? null : item.label)
                      }
                    >
                      {item.label}
                      <svg
                        className={`h-4 w-4 transition-transform ${
                          openDropdown === item.label ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M19 9l-7 7-7-7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                    </button>
                    {openDropdown === item.label && (
                      <div className="space-y-1 pl-4">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            className="block rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                            href={child.href}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    className={`block rounded-lg px-4 py-3 text-sm font-medium hover:bg-slate-50 ${
                      pathname === item.href ? 'text-indigo-600' : 'text-slate-700'
                    }`}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <Link
                className="block w-full rounded-lg px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="block w-full rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-center text-sm font-semibold text-white"
                href="/signup"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
