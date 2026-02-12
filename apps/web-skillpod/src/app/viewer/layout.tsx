// Force dynamic rendering to prevent static prerendering issues with useSearchParams
export const dynamic = 'force-dynamic';

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
