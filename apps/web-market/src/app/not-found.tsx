import type { Metadata } from 'next';

import { ErrorPage } from '@/components/errors/ErrorPage';

export const metadata: Metadata = {
  title: 'Page Not Found | Skillancer',
  description: 'The page you are looking for does not exist.',
};

/**
 * 404 Not Found page
 * Displayed when a route doesn't exist
 */
export default function NotFound() {
  return (
    <ErrorPage
      type="404"
      code={404}
      title="Page Not Found"
      message="Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or never existed."
      showBackButton
      showHomeButton
    />
  );
}
