import RestMenuPageClient from './rest-menu-client';
import { getServerUser } from '@/lib/auth-server';
import { getRestMenuPageData } from '@/lib/data-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RestMenuPage() {
  let initialData: Awaited<ReturnType<typeof getRestMenuPageData>> = null;
  try {
    const user = await getServerUser();
    if (user?.uid) {
      initialData = await getRestMenuPageData(user.uid);
    }
  } catch {
    // Server data optional
  }
  return <RestMenuPageClient initialData={initialData ?? undefined} />;
}

