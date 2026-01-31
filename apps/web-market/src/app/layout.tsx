import { ThemeProvider, Toaster } from '@skillancer/ui';
import { Suspense } from 'react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { ErrorProvider } from '@/lib/providers/error-provider';
import { QueryProvider } from '@/lib/providers/query-provider';
import { MarketAuthProvider } from '@/lib/providers/auth-provider';

import type { Metadata, Viewport } from 'next';

import '@/styles/globals.css';

// CSS variable for font - using system fonts for offline builds
// In production, this would be Inter from Google Fonts
const fontClassName = 'font-system';

export const metadata: Metadata = {
  title: {
    default: 'Skillancer - Find the Perfect Match for Your Next Project',
    template: '%s | Skillancer',
  },
  description:
    'Find the perfect match for your next project. Verified, quality matches between clients and freelancers. Smart AI matching, secure payments, and guaranteed satisfaction.',
  keywords: [
    'freelance',
    'marketplace',
    'jobs',
    'remote work',
    'hire freelancers',
    'find work',
    'talent',
    'skills',
    'verified freelancers',
    'AI matching',
  ],
  authors: [{ name: 'Skillancer' }],
  creator: 'Skillancer',
  publisher: 'Skillancer',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://market.skillancer.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Skillancer',
    title: 'Skillancer - Find the Perfect Match for Your Next Project',
    description:
      'Verified, quality matches between clients and freelancers. Smart AI matching connects you with top talent.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Skillancer - Find the Perfect Match',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skillancer - Find the Perfect Match for Your Next Project',
    description:
      'Verified, quality matches between clients and freelancers. Smart AI matching connects you with top talent.',
    images: ['/og-image.jpg'],
    creator: '@skillancer',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/assets/logo/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/logo/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/assets/logo/icons/favicon-32.png',
    apple: [
      { url: '/assets/logo/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
      { url: '/assets/logo/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#10b981' },
    { media: '(prefers-color-scheme: dark)', color: '#10b981' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning className={fontClassName} lang="en">
      <body className="bg-background min-h-screen font-sans antialiased">
        <ThemeProvider
          disableTransitionOnChange
          enableSystem
          attribute="class"
          defaultTheme="system"
        >
          <ErrorProvider>
            <QueryProvider>
              <MarketAuthProvider apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || ''}>
                <div className="relative flex min-h-screen flex-col">
                  <Suspense fallback={<HeaderSkeleton />}>
                    <Header />
                  </Suspense>
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </MarketAuthProvider>
              <Toaster closeButton richColors position="bottom-right" />
            </QueryProvider>
          </ErrorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

function HeaderSkeleton() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container flex h-16 items-center">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="ml-auto flex items-center gap-4">
          <div className="bg-muted h-8 w-20 animate-pulse rounded" />
          <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        </div>
      </div>
    </header>
  );
}
