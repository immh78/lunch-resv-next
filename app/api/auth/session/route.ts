import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { SESSION_COOKIE_NAME } from '@/lib/auth-server';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 5; // 5 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body?.token as string | undefined;
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }
    const auth = getAdminAuth();
    await auth.verifyIdToken(token);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('Session set error', e);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
