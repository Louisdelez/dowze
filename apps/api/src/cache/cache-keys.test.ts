import { describe, it, expect } from 'vitest';
import { versionedKey, skillGraphKey, skillClosureKey } from './cache-keys';

describe('clés de cache versionnées', () => {
  it('compose namespace:vN:id', () => {
    expect(versionedKey('skill-graph', 3, 'all')).toBe('skill-graph:v3:all');
  });

  it('bump de version → clé différente (invalidation)', () => {
    expect(skillGraphKey(1)).not.toBe(skillGraphKey(2));
  });

  it('clés de clôture par compétence', () => {
    expect(skillClosureKey(2, 'abc')).toBe('skill-closure:v2:abc');
  });
});
