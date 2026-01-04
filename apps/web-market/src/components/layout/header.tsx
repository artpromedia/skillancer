'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Badge,
  cn,
  useTheme,
  getInitials,
} from '@skillancer/ui';
import {
  Bell,
  Briefcase,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useCallback } from 'react';

import { SearchBar } from '@/components/search/search-bar';
import { Logo } from '@/components/brand';

// Navigation configuration
const mainNavItems = [
  {
    label: 'Find Work',
    href: '/jobs',
    items: [
      { label: 'Find Jobs', href: '/jobs', description: 'Browse all available jobs' },
      { label: 'Saved Jobs', href: '/jobs/saved', description: "Jobs you've bookmarked" },
      { label: 'Proposals', href: '/proposals', description: 'Track your submitted proposals' },
      { label: 'My Stats', href: '/freelancer/stats', description: 'Your performance metrics' },
    ],
  },
  {
    label: 'Find Talent',
    href: '/freelancers',
    items: [
      { label: 'Browse Talent', href: '/freelancers', description: 'Find skilled freelancers' },
      { label: 'Post a Job', href: '/jobs/post', description: 'Create a new job posting' },
      { label: 'My Jobs', href: '/client/jobs', description: 'Manage your job postings' },
      { label: 'Hired', href: '/client/contracts', description: 'Active contracts & hires' },
    ],
  },
  {
    label: 'Products',
    href: '/about',
    items: [
      { label: 'Fractional Executives', href: '/executives', description: 'On-demand C-suite leadership' },
      { label: 'SkillPod VDI', href: '/skillpod', description: 'Secure virtual desktop for work' },
      { label: 'Cockpit Dashboard', href: '/cockpit', description: 'Project management dashboard' },
      { label: 'SmartMatch AI', href: '/smartmatch', description: 'AI-powered job matching' },
      { label: 'Skill Verification', href: '/verification', description: 'Verify your skills' },
    ],
  },
  {
    label: 'Resources',
    href: '/about',
    items: [
      { label: 'How It Works', href: '/how-it-works', description: 'Learn the platform basics' },
      { label: 'About Us', href: '/about', description: 'Our mission and story' },
      { label: 'Trust & Safety', href: '/trust', description: 'Secure payments & verification' },
      { label: 'Success Stories', href: '/success-stories', description: 'Client testimonials' },
    ],
  },
];

// Mock user data - replace with actual auth
const mockUser = null as null | {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'freelancer' | 'client';
  unreadNotifications: number;
};

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();

  const user = mockUser; // Replace with useAuth hook when available

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Logo size="md" />

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex lg:items-center lg:gap-1">
            {mainNavItems.map((item) => (
              <DropdownMenu key={item.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    className={cn('gap-1 px-3', pathname.startsWith(item.href) && 'bg-accent')}
                    variant="ghost"
                  >
                    {item.label}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {item.items.map((subItem) => (
                    <DropdownMenuItem key={subItem.href} asChild>
                      <Link className="flex flex-col items-start gap-1" href={subItem.href}>
                        <span className="font-medium">{subItem.label}</span>
                        <span className="text-muted-foreground text-xs">{subItem.description}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </nav>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex md:max-w-md md:flex-1 lg:max-w-lg">
            <SearchBar className="w-full" />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Search Toggle */}
            <Button
              aria-label="Toggle search"
              className="md:hidden"
              size="icon"
              variant="ghost"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* Theme Toggle */}
            <Button aria-label="Toggle theme" size="icon" variant="ghost" onClick={toggleTheme}>
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {user ? (
              <>
                {/* Notifications */}
                <Button aria-label="Notifications" className="relative" size="icon" variant="ghost">
                  <Bell className="h-5 w-5" />
                  {user.unreadNotifications > 0 && (
                    <Badge
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                      variant="destructive"
                    >
                      {user.unreadNotifications > 9 ? '9+' : user.unreadNotifications}
                    </Badge>
                  )}
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="relative h-9 w-9 rounded-full" variant="ghost">
                      <Avatar className="h-9 w-9">
                        <AvatarImage alt={user.name} src={user.avatar} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/profile">
                          <User className="mr-2 h-4 w-4" />
                          Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={
                            user.role === 'freelancer'
                              ? '/freelancer/dashboard'
                              : '/client/dashboard'
                          }
                        >
                          <Briefcase className="mr-2 h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Auth Buttons */}
                <Button asChild className="hidden sm:inline-flex" variant="ghost">
                  <Link href="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}

            {/* Post a Job CTA (for clients) */}
            {(!user || user.role === 'client') && (
              <Button
                asChild
                className="hidden gap-2 bg-green-600 hover:bg-green-700 lg:inline-flex"
                variant="default"
              >
                <Link href="/jobs/post">
                  <Briefcase className="h-4 w-4" />
                  Post a Job
                </Link>
              </Button>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              aria-label="Toggle menu"
              className="lg:hidden"
              size="icon"
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        {searchOpen && (
          <div className="border-t py-3 md:hidden">
            <SearchBar className="w-full" onSearch={() => setSearchOpen(false)} />
          </div>
        )}
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="border-t lg:hidden">
          <nav className="container mx-auto space-y-4 px-4 py-4">
            {mainNavItems.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                  {item.label}
                </div>
                <div className="grid gap-1">
                  {item.items.map((subItem) => (
                    <Link
                      key={subItem.href}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm transition-colors',
                        pathname === subItem.href
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      )}
                      href={subItem.href}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {subItem.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {/* Mobile Auth */}
            {!user && (
              <div className="flex flex-col gap-2 border-t pt-4">
                <Button asChild className="w-full" variant="outline">
                  <Link href="/login">Log In</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
            {/* Mobile Post Job */}
            <Button
              asChild
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              variant="default"
            >
              <Link href="/jobs/post">
                <Briefcase className="h-4 w-4" />
                Post a Job
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
