import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply to Executive Network - Skillancer',
  description:
    'Join our elite network of fractional executives. Rigorous vetting ensures only the best.',
};

export default function ExecutiveApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
