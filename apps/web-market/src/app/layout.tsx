import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';

import { ThemeProvider, Toaster } from '@skillancer/ui';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { QueryProvider } from '@/lib/providers/query-provider';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Skillancer Market - Find Work, Hire Talent',
    template: '%s | Skillancer Market',
  },
  description:
    'Discover top freelance jobs and talented professionals. Skillancer Market connects skilled freelancers with clients seeking quality work. Smart matching, secure payments, and verified talent.',
  keywords: [
    'freelance',
    'marketplace',
    'jobs',
    'remote work',
    'hire freelancers',
    'find work',
    'talent',
    'skills',
  ],
  authors: [{ name: 'Skillancer' }],
  creator: 'Skillancer',
  publisher: 'Skillancer',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://market.skillancer.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Skillancer Market',
    title: 'Skillancer Market - Find Work, Hire Talent',
    description:
      'Discover top freelance jobs and talented professionals. Smart matching connects you with the right opportunities.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Skillancer Market',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skillancer Market - Find Work, Hire Talent',
    description:
      'Discover top freelance jobs and talented professionals. Smart matching connects you with the right opportunities.',
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
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="bg-background min-h-screen font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <div className="relative flex min-h-screen flex-col">
              <Suspense fallback={<HeaderSkeleton />}>
                <Header />
              </Suspense>
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <Toaster position="bottom-right" richColors closeButton />
          </QueryProvider>
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
