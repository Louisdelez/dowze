import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifyCredentials } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'requête invalide' }, { status: 400 });
  }
  const username = (body.username || '').trim();
  const password = body.password || '';
  if (!username || !password || !verifyCredentials(username, password)) {
    return NextResponse.json({ error: 'Identifiants incorrects.' }, { status: 401 });
  }
  const token = await signSession(username);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
