import { describe, it, expect } from 'vitest';
import { CORE_VERSION, SCHEMAS_VERSION } from './index';

describe('@dowze/core — fondation', () => {
  it('expose une version', () => {
    expect(CORE_VERSION).toBe('2.18.0');
  });

  it('réexporte la version des schémas (câblage du workspace OK)', () => {
    expect(SCHEMAS_VERSION).toBe('2.18.0');
  });
});
