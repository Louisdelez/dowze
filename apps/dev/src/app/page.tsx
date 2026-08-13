import { cookies } from 'next/headers';
import { Workspace } from '@/components/workspace';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const jar = await cookies();
  const user = (await verifySession(jar.get(SESSION_COOKIE)?.value)) ?? '';
  return <Workspace user={user} />;
}
