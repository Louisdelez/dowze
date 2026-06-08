import { describe, it, expect } from 'vitest';
import { CORE_VERSION, SCHEMAS_VERSION } from './index';

const SEMVER = /^\d+\.\d+\.\d+$/;

describe('@dowze/core — fondation', () => {
  it('expose une version semver', () => {
    expect(CORE_VERSION).toMatch(SEMVER);
  });

  it('réexporte la version des schémas (câblage du workspace OK)', () => {
    expect(SCHEMAS_VERSION).toMatch(SEMVER);
  });
});
