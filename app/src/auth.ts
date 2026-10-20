import { createHash, timingSafeEqual } from 'node:crypto';

/** Returns the stored key_hash if an active record exists, else null. */
export type KeyLookup = (keyHash: string) => Promise<{ keyHash: string; active: boolean } | null>;

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const DUMMY_HASH = sha256Hex('dummy');

/**
 * Verifies an API key. Always hashes and always performs the lookup (even for a missing/malformed
 * header) so hit and miss paths do comparable work. Throws on lookup failure (caller fails closed).
 */
export async function verifyApiKey(
  header: string | undefined,
  lookup: KeyLookup,
): Promise<boolean> {
  const candidate = sha256Hex(header ?? '');
  const record = await lookup(candidate);
  const hashMatch = safeEqual(record?.keyHash ?? DUMMY_HASH, candidate);
  return header !== undefined && header.length > 0 && record !== null && hashMatch && record.active;
}
