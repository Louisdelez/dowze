import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Chiffrement des clés API BYOK au repos (AES-256-GCM).
 * Format stocké : base64( iv[12] | tag[16] | ciphertext ).
 * La clé provient de `COPILOTE_SECRET_KEY` (32 octets en base64 ou hex).
 */

function parseKey(secret: string): Buffer {
  // Accepte hex (64 car.) ou base64 ; doit faire 32 octets.
  const asHex = /^[0-9a-fA-F]{64}$/.test(secret) ? Buffer.from(secret, 'hex') : null;
  const key = asHex ?? Buffer.from(secret, 'base64');
  if (key.length !== 32) {
    throw new Error('COPILOTE_SECRET_KEY doit décoder vers 32 octets (base64 ou hex).');
  }
  return key;
}

export function encryptSecret(plain: string, secret: string): string {
  const key = parseKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptSecret(encoded: string, secret: string): string {
  const key = parseKey(secret);
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
