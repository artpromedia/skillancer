import { redirect } from 'next/navigation';

export default function Home() {
  // Root redirects to marketing homepage
  redirect('/');
}
