// Force dynamic rendering to prevent static prerendering issues with QueryClient
export const dynamic = 'force-dynamic';

export default function ApiManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
