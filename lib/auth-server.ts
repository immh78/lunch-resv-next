import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

const SESSION_COOKIE_NAME = 'firebase-id-token';

export async function getServerUser(): Promise<{ uid: string; email?: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? undefined };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE_NAME };
