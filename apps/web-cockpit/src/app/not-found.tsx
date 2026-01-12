import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found | Skillancer Cockpit',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100">
          <span className="text-5xl font-bold text-slate-400">404</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold text-slate-900">Page Not Found</h1>

        <p className="mb-8 text-slate-600">
          The page you are looking for does not exist in your Cockpit. It may have been moved or
          removed.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </Link>

          <Link
            href="/time"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Time Tracking
          </Link>
        </div>
      </div>
    </div>
  );
}
