import { describe, it, expect } from 'vitest';
import {
  encryptProfileField,
  decryptProfileField,
  encryptProfileForStorage,
  decryptProfileFromStorage,
  isEncryptedValue,
} from '../profileCrypto';
import { createTraderProfile } from '../../types/profileSchema';

describe('Profile End-to-End Encryption & 1:1 Identity Vault', () => {
  const userId = 'a1e3ce57-88b1-4c9a-9000-123456789abc';

  it('encrypts and decrypts single fields with authenticated MAC verification', () => {
    const plain = 'hongnacap2022 — Balanced Institutional (1%–2%)';
    const cipher = encryptProfileField(plain, userId);

    expect(isEncryptedValue(cipher)).toBe(true);
    expect(cipher.startsWith('enc:tp256:v1:')).toBe(true);
    expect(cipher).not.toContain('hongnacap2022');

    const decrypted = decryptProfileField(cipher, userId);
    expect(decrypted).toBe(plain);
  });

  it('encrypts all sensitive profile attributes at rest and decrypts them losslessly', () => {
    const profile = createTraderProfile({
      id: 'prof_1',
      userId,
      name: 'hongnacap2022',
      handle: '@hongnacap2022',
      imageProfile: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      tag: 'XAU/USD Specialist',
      tags: ['XAU/USD', 'London Session', 'ICT / SMC'],
      tradingStyle: 'ICT / Smart Money',
      riskProfile: 'Balanced Institutional (1%–2%)',
      preferredSession: 'London & NY Overlap',
      location: 'Phnom Penh, KH',
      experienceLevel: 'Intermediate (1–3 yrs)',
      motto: 'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
    });

    const encryptedRecord = encryptProfileForStorage(profile);

    // Every sensitive field in storage must be encrypted ciphertext
    expect(isEncryptedValue(encryptedRecord.name)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.handle)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.imageProfile)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.tag)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.tradingStyle)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.riskProfile)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.preferredSession)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.location)).toBe(true);
    expect(isEncryptedValue(encryptedRecord.motto)).toBe(true);
    expect(encryptedRecord.tags.every((t) => isEncryptedValue(t))).toBe(true);

    // Raw JSON must not leak plaintext identity fields
    const serialized = JSON.stringify(encryptedRecord);
    expect(serialized).not.toContain('hongnacap2022');
    expect(serialized).not.toContain('XAU/USD Specialist');

    // Decrypting restores the exact profile fields
    const restored = decryptProfileFromStorage(encryptedRecord, userId);
    expect(restored.name).toBe('hongnacap2022');
    expect(restored.handle).toBe('@hongnacap2022');
    expect(restored.imageProfile).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(restored.tag).toBe('XAU/USD Specialist');
    expect(restored.tags).toEqual(['XAU/USD', 'London Session', 'ICT / SMC']);
    expect(restored.tradingStyle).toBe('ICT / Smart Money');
    expect(restored.riskProfile).toBe('Balanced Institutional (1%–2%)');
    expect(restored.motto).toContain('Protect capital first');
    expect(restored.encryptionFingerprint).toHaveLength(12);
  });
});
