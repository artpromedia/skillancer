import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found | SkillPod',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-purple-100">
          <span className="text-5xl font-bold text-purple-400">404</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold text-gray-900">Page Not Found</h1>

        <p className="mb-8 text-gray-600">
          The SkillPod page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
