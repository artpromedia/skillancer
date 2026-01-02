import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Clients | Skillancer Executive',
  description: 'Manage your client engagements and workspaces',
};

export default function ExecutiveClientsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
