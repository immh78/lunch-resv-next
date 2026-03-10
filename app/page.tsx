import HomePageClient from './home-page-client';
import { getServerUser } from '@/lib/auth-server';
import { getMainPageData } from '@/lib/data-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  let initialData: Awaited<ReturnType<typeof getMainPageData>> = null;
  try {
    const user = await getServerUser();
    if (user?.uid) {
      initialData = await getMainPageData(user.uid);
    }
  } catch {
    // Server data optional (e.g. missing Firebase Admin env)
  }
  return <HomePageClient initialData={initialData ?? undefined} />;
}
