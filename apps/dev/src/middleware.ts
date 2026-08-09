import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// Protège toute l'app : sans session valide → /login (ou 401 pour les API).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Tout sauf /login, l'API de login, les LIENS DE PARTAGE publics, les assets Next et le favicon.
  matcher: ['/((?!login|api/login|api/files/public|_next/static|_next/image|favicon.ico).*)'],
};
