import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Panel | CultCrate',
  robots: { index: false, follow: false },
};

/**
 * Server-side route guard (second layer after middleware, third after the API checks).
 * Non-admins are redirected before any admin UI is rendered or sent to the browser.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (session.status === 'anonymous') redirect('/auth?redirect=/admin');
  if (session.status === 'forbidden') redirect('/dashboard');

  return <>{children}</>;
}
