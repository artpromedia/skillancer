import { Inter } from 'next/font/google';

import type { Metadata } from 'next';

import '../styles/globals.css';
import { defaultMetadata } from '@/lib/seo/metadata';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={inter.variable} lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
