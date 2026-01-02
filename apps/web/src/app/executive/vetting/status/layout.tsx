import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vetting Status - Skillancer',
  description: 'Track your executive vetting progress.',
};

export default function VettingStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
