import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found | Skillancer',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
          <span className="text-5xl font-bold text-gray-400">404</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold text-gray-900">Page Not Found</h1>

        <p className="mb-8 text-gray-600">
          Sorry, we could not find the page you are looking for. It might have been moved, deleted,
          or never existed.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Go Home
          </Link>

          <Link
            href="/jobs"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Browse Jobs
          </Link>
        </div>

        <div className="mt-12">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <Link href="/contact" className="text-green-600 hover:text-green-700">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
