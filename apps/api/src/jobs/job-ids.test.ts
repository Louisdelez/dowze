import { describe, it, expect } from 'vitest';
import { digestJobId, peerNotifyJobId } from './job-ids';

describe('ids de jobs idempotents', () => {
  it('mêmes entrées → même id (déduplication)', () => {
    expect(digestJobId('a', '2026-Q2')).toBe(digestJobId('a', '2026-Q2'));
    expect(peerNotifyJobId('s', 'l')).toBe('peer-notify:s:l');
  });

  it('entrées différentes → ids différents', () => {
    expect(digestJobId('a', '2026-Q2')).not.toBe(digestJobId('a', '2026-Q3'));
  });
});
