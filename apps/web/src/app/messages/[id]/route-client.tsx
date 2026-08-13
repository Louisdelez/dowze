'use client';

import { useParams } from 'next/navigation';
import { Messenger } from '@/components/messenger';

export function ConversationClient() {
  const params = useParams<{ id: string }>();
  return <Messenger activeId={params?.id ?? null} />;
}
