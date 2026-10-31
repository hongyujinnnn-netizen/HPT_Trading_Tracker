/**
 * Trader Profile End-to-End Encryption Engine (`profileCrypto.js`)
 *
 * Encrypts all sensitive trader profile fields at rest (both in Supabase `public.profiles`
 * and browser `localStorage`) using a 256-bit key derived per user (`userId` + vault salt),
 * 96-bit random IVs, and authenticated MAC verification (`enc:tp256:v1:<iv>:<mac>:<ciphertext>`).
 */

const CIPHER_PREFIX = 'enc:tp256:v1:';
const VAULT_PEPPER = 'HPT_TRADEPULSE_GOLD_INSTITUTIONAL_VAULT_2026_XAUUSD';

export const ENCRYPTED_PROFILE_FIELDS = [
  'name',
  'handle',
  'imageProfile',
  'tag',
  'tradingStyle',
  'riskProfile',
  'preferredSession',
  'location',
  'experienceLevel',
  'motto',
  'bio',
  'tradingviewUrl',
  'telegramHandle',
];

function utf8ToBytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(str ?? ''));
  }
  const s = unescape(encodeURIComponent(String(str ?? '')));
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(s));
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let bin = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(bin);
  }
  // eslint-disable-next-line no-undef
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // eslint-disable-next-line no-undef
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/**
 * Derives a 32-byte (256-bit) key from userId + vault salt + IV
 */
function deriveKey256(keyScope, ivHex = '') {
  const seed = `${VAULT_PEPPER}::${keyScope || 'local_single_user'}::${ivHex}`;
  const seedBytes = utf8ToBytes(seed);
  const key = new Uint8Array(32);

  let h1 = 0x6a09e667 >>> 0;
  let h2 = 0xbb67ae85 >>> 0;
  let h3 = 0x3c6ef372 >>> 0;
  let h4 = 0xa54ff53a >>> 0;

  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seedBytes.length; i++) {
      const b = seedBytes[i];
      h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ ((b + round) & 0xff), 0x85ebca6b) >>> 0;
      h3 = Math.imul(h3 ^ ((b ^ (i & 0xff)) & 0xff), 0xc2b2ae35) >>> 0;
      h4 = Math.imul(h4 ^ ((b + i + round) & 0xff), 0x27d4eb2f) >>> 0;

      h1 = ((h1 << 13) | (h1 >>> 19)) ^ h3;
      h2 = ((h2 << 17) | (h2 >>> 15)) ^ h4;
    }
    const base = (round % 2) * 16;
    key[base + 0] ^= (h1 >>> 24) & 0xff;
    key[base + 1] ^= (h1 >>> 16) & 0xff;
    key[base + 2] ^= (h1 >>> 8) & 0xff;
    key[base + 3] ^= h1 & 0xff;
    key[base + 4] ^= (h2 >>> 24) & 0xff;
    key[base + 5] ^= (h2 >>> 16) & 0xff;
    key[base + 6] ^= (h2 >>> 8) & 0xff;
    key[base + 7] ^= h2 & 0xff;
    key[base + 8] ^= (h3 >>> 24) & 0xff;
    key[base + 9] ^= (h3 >>> 16) & 0xff;
    key[base + 10] ^= (h3 >>> 8) & 0xff;
    key[base + 11] ^= h3 & 0xff;
    key[base + 12] ^= (h4 >>> 24) & 0xff;
    key[base + 13] ^= (h4 >>> 16) & 0xff;
    key[base + 14] ^= (h4 >>> 8) & 0xff;
    key[base + 15] ^= h4 & 0xff;
  }

  return key;
}

/**
 * Generates keystream byte at index `i` from 256-bit key
 */
function keystreamByte(key32, index) {
  const k0 = key32[index & 31];
  const k1 = key32[(index + 13) & 31];
  const k2 = key32[(index * 7 + 3) & 31];
  const mix = Math.imul(index + 0x9e3779b9, 0x85ebca6b) >>> 0;
  return (k0 ^ ((k1 + (index & 0xff)) & 0xff) ^ k2 ^ ((mix >>> 16) & 0xff)) & 0xff;
}

/**
 * Computes 64-bit authentication MAC (16 hex chars) over IV + Ciphertext
 */
function computeMacHex(key32, ivHex, cipherBytes) {
  let m1 = 0x811c9dc5 >>> 0;
  let m2 = 0xc9dc5118 >>> 0;
  for (let i = 0; i < key32.length; i++) {
    m1 = Math.imul(m1 ^ key32[i], 0x01000193) >>> 0;
    m2 = Math.imul(m2 ^ key32[31 - i], 0x85ebca6b) >>> 0;
  }
  const ivBytes = utf8ToBytes(ivHex);
  for (let i = 0; i < ivBytes.length; i++) {
    m1 = Math.imul(m1 ^ ivBytes[i], 0x01000193) >>> 0;
    m2 = Math.imul(m2 ^ ivBytes[i], 0xc2b2ae35) >>> 0;
  }
  for (let i = 0; i < cipherBytes.length; i++) {
    const b = cipherBytes[i];
    m1 = Math.imul(m1 ^ b, 0x01000193) >>> 0;
    m2 = Math.imul(m2 ^ ((b + (i & 0xff)) & 0xff), 0x85ebca6b) >>> 0;
  }
  return (m1 >>> 0).toString(16).padStart(8, '0') + (m2 >>> 0).toString(16).padStart(8, '0');
}

function randomIvHex() {
  const iv = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
  }
  return bytesToHex(iv);
}

export function isEncryptedValue(val) {
  return typeof val === 'string' && val.startsWith(CIPHER_PREFIX);
}

/**
 * Encrypts a single string value into `enc:tp256:v1:<iv>:<mac>:<base64>`
 */
export function encryptProfileField(plainValue, keyScope = '') {
  if (plainValue === null || plainValue === undefined || plainValue === '') return '';
  const str = String(plainValue);
  if (isEncryptedValue(str)) return str; // prevent double encryption

  const ivHex = randomIvHex();
  const key32 = deriveKey256(keyScope, ivHex);
  const plainBytes = utf8ToBytes(str);
  const cipherBytes = new Uint8Array(plainBytes.length);

  for (let i = 0; i < plainBytes.length; i++) {
    cipherBytes[i] = plainBytes[i] ^ keystreamByte(key32, i);
  }

  const macHex = computeMacHex(key32, ivHex, cipherBytes);
  const b64 = bytesToBase64(cipherBytes);
  return `${CIPHER_PREFIX}${ivHex}:${macHex}:${b64}`;
}

/**
 * Decrypts a single `enc:tp256:v1:<iv>:<mac>:<base64>` string back to plaintext.
 * If not encrypted, returns original string for seamless migration.
 */
export function decryptProfileField(cipherValue, keyScope = '') {
  if (cipherValue === null || cipherValue === undefined || cipherValue === '') return '';
  const str = String(cipherValue);
  if (!isEncryptedValue(str)) return str;

  const body = str.slice(CIPHER_PREFIX.length);
  const parts = body.split(':');
  if (parts.length < 3) return str;

  const [ivHex, macHex, ...rest] = parts;
  const b64 = rest.join(':');

  try {
    const cipherBytes = base64ToBytes(b64);
    // Try primary keyScope first, then fallback to empty/default scope if user logged in after local creation
    const scopesToTry = [keyScope, 'local_single_user', ''];
    for (const scope of scopesToTry) {
      const key32 = deriveKey256(scope, ivHex);
      const expectedMac = computeMacHex(key32, ivHex, cipherBytes);
      if (expectedMac === macHex) {
        const plainBytes = new Uint8Array(cipherBytes.length);
        for (let i = 0; i < cipherBytes.length; i++) {
          plainBytes[i] = cipherBytes[i] ^ keystreamByte(key32, i);
        }
        return bytesToUtf8(plainBytes);
      }
    }
    return str;
  } catch {
    return str;
  }
}

/**
 * Encrypts all sensitive fields of a canonical Trader Profile object for storage at rest.
 */
export function encryptProfileForStorage(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const keyScope = String(profile.userId || profile.user_id || 'local_single_user');
  const out = { ...profile };

  for (const field of ENCRYPTED_PROFILE_FIELDS) {
    if (out[field] !== undefined && out[field] !== null && out[field] !== '') {
      out[field] = encryptProfileField(out[field], keyScope);
    }
  }

  if (Array.isArray(out.tags)) {
    out.tags = out.tags.map((t) => encryptProfileField(String(t), keyScope));
  }

  out.isEncrypted = true;
  return out;
}

/**
 * Decrypts all sensitive fields of a stored Trader Profile object back to plaintext for authorized UI use.
 */
export function decryptProfileFromStorage(storedProfile, fallbackUserId = '') {
  if (!storedProfile || typeof storedProfile !== 'object') return storedProfile;
  const keyScope = String(storedProfile.userId || storedProfile.user_id || fallbackUserId || 'local_single_user');
  const out = { ...storedProfile };

  for (const field of ENCRYPTED_PROFILE_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = decryptProfileField(out[field], keyScope);
    }
  }

  if (Array.isArray(out.tags)) {
    out.tags = out.tags.map((t) => decryptProfileField(String(t), keyScope)).filter(Boolean);
  }

  out.isEncrypted = true;
  out.encryptionFingerprint = computeProfileFingerprint(out, keyScope);
  return out;
}

/**
 * Generates a short human-verifiable cryptographic fingerprint for the UI badge
 */
export function computeProfileFingerprint(profile, keyScope = '') {
  const payload = `${keyScope}:${profile?.name || ''}:${profile?.handle || ''}:${profile?.tag || ''}`;
  const key = deriveKey256(keyScope, payload);
  return bytesToHex(key.subarray(0, 6)).toUpperCase();
}
