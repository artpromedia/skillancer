import { Metadata } from 'next';
import { NotificationsPageClient } from './NotificationsPageClient';

export const metadata: Metadata = {
  title: 'Notifications | Skillancer',
  description: 'View and manage your notifications',
};

export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
