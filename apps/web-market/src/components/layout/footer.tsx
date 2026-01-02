import { Button, Separator } from '@skillancer/ui';
import { Linkedin, Globe, DollarSign, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/brand';

const footerLinks = {
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Leadership', href: '/leadership' },
    { label: 'Investor Relations', href: '/investors' },
    { label: 'Contact Us', href: '/contact' },
  ],
  forClients: [
    { label: 'How to Hire', href: '/how-to-hire' },
    { label: 'Talent Marketplace', href: '/talent' },
    { label: 'Project Catalog', href: '/catalog' },
    { label: 'Hire an Agency', href: '/agencies' },
    { label: 'Enterprise', href: '/enterprise' },
    { label: 'Payroll Services', href: '/payroll' },
  ],
  forFreelancers: [
    { label: 'How to Find Work', href: '/how-to-find-work' },
    { label: 'Direct Contracts', href: '/direct-contracts' },
    { label: 'Find Freelance Jobs', href: '/jobs' },
    { label: 'Career Development', href: '/career' },
    { label: 'Community', href: '/community' },
    { label: 'Success Stories', href: '/success-stories' },
  ],
  resources: [
    { label: 'Help & Support', href: '/help' },
    { label: 'Blog', href: '/blog' },
    { label: 'Developer API', href: '/api-docs' },
    { label: 'Status Page', href: '/status' },
    { label: 'Podcast', href: '/podcast' },
    { label: 'Trust & Safety', href: '/trust' },
  ],
};

const socialLinks = [
  { label: 'Facebook', href: 'https://facebook.com/skillancer', icon: ExternalLink },
  { label: 'Twitter', href: 'https://twitter.com/skillancer', icon: ExternalLink },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/skillancer', icon: Linkedin },
  { label: 'Instagram', href: 'https://instagram.com/skillancer', icon: ExternalLink },
  { label: 'YouTube', href: 'https://youtube.com/skillancer', icon: ExternalLink },
];

const _languages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
];

const _currencies = [
  { code: 'USD', label: 'USD ($)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€' },
  { code: 'GBP', label: 'GBP (£)', symbol: '£' },
  { code: 'CAD', label: 'CAD ($)', symbol: '$' },
  { code: 'AUD', label: 'AUD ($)', symbol: '$' },
];

export function Footer() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Logo size="md" />
            <p className="text-muted-foreground mt-4 max-w-xs text-sm">
              Connecting businesses with top talent worldwide. Smart matching, secure payments, and
              verified professionals.
            </p>
            {/* Social Links */}
            <div className="mt-6 flex gap-2">
              {socialLinks.map((social) => (
                <Button
                  key={social.label}
                  asChild
                  className="hover:text-primary h-9 w-9"
                  size="icon"
                  variant="ghost"
                >
                  <a
                    aria-label={social.label}
                    href={social.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <social.icon className="h-4 w-4" />
                  </a>
                </Button>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          <div>
            <h3 className="mb-4 font-semibold">Company</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">For Clients</h3>
            <ul className="space-y-3">
              {footerLinks.forClients.map((link) => (
                <li key={link.href}>
                  <Link
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">For Freelancers</h3>
            <ul className="space-y-3">
              {footerLinks.forFreelancers.map((link) => (
                <li key={link.href}>
                  <Link
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Resources</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Legal Links */}
          <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
            <Link className="hover:text-foreground transition-colors" href="/terms">
              Terms of Service
            </Link>
            <Link className="hover:text-foreground transition-colors" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-foreground transition-colors" href="/cookies">
              Cookie Policy
            </Link>
            <Link className="hover:text-foreground transition-colors" href="/accessibility">
              Accessibility
            </Link>
          </div>

          {/* Language & Currency Selectors */}
          <div className="flex items-center gap-4">
            <Button className="text-muted-foreground gap-2" size="sm" variant="ghost">
              <Globe className="h-4 w-4" />
              <span>English</span>
            </Button>
            <Button className="text-muted-foreground gap-2" size="sm" variant="ghost">
              <DollarSign className="h-4 w-4" />
              <span>USD</span>
            </Button>
          </div>
        </div>

        {/* Copyright */}
        <div className="text-muted-foreground mt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} Skillancer Global Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
