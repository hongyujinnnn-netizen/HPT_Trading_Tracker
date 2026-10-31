/**
 * Canonical Trader Profile Schema (`public.profiles`)
 *
 * Enforces strict 1 User = 1 Profile architecture with end-to-end field encryption at rest:
 * - id: Unique profile ID (UUID in Supabase or 'prof_default_primary' locally)
 * - userId: Owner user_id (UUID, unique 1:1 per user)
 * - name: Trader display name / desk persona name (Encrypted at rest)
 * - handle: @username handle (Encrypted at rest)
 * - imageProfile: Avatar image URL or base64 data URL (Encrypted at rest)
 * - tag: Primary specialty badge (Encrypted at rest)
 * - tags: Array of custom skill/focus tags (Encrypted at rest)
 * - tradingStyle: Primary strategy archetype (Encrypted at rest)
 * - riskProfile: Risk mandate per trade (Encrypted at rest)
 * - preferredSession: Primary execution session (Encrypted at rest)
 * - location: Desk location / timezone city (Encrypted at rest)
 * - experienceLevel: Years of active gold trading (Encrypted at rest)
 * - motto: Core desk rule #1 (Encrypted at rest)
 * - bio: Extended trader biography / desk mandate (Encrypted at rest)
 * - tradingviewUrl: TradingView profile handle/URL (Encrypted at rest)
 * - telegramHandle: Telegram / Discord handle (Encrypted at rest)
 * - linkedAccountId: Optional sub-account ID linked to this profile
 * - isActive: Always true for the user's single canonical profile
 */

import { decryptProfileFromStorage } from '../utils/profileCrypto';

export const PROFILE_ROLE_TAGS = [
  'XAU/USD Specialist',
  'Prop Funded Trader',
  'ICT / SMC Analyst',
  'London Session Sniper',
  'NY Overlap Scalper',
  'Macro & Gold Swing',
  'Quantitative Desk',
  'Price Action Purist',
];

export const PROFILE_TRADING_STYLES = [
  'ICT / Smart Money',
  'Session Breakout',
  'Intraday Scalper',
  'Price Action & Structure',
  'Macro / News Momentum',
  'Swing & Position',
];

export const PROFILE_RISK_MANDATES = [
  'Conservative (0.5%–1%)',
  'Balanced Institutional (1%–2%)',
  'Aggressive Growth (2%+)',
];

export const PROFILE_SESSIONS = [
  'London & NY Overlap',
  'London Session Only',
  'New York Session Only',
  'Asian Liquidity Sweep',
  'Multi-Session Desk',
];

export const PROFILE_EXPERIENCE_LEVELS = [
  'Developing (< 1 yr)',
  'Intermediate (1–3 yrs)',
  'Advanced (3–5 yrs)',
  'Institutional Veteran (5+ yrs)',
];

export function createTraderProfile(data = {}) {
  const now = new Date().toISOString();
  const userId = data.userId || data.user_id || '';

  // Ensure any encrypted fields passed in are decrypted before normalization
  const decrypted = decryptProfileFromStorage(
    {
      ...data,
      userId,
      imageProfile: data.imageProfile ?? data.image_profile ?? '',
      tradingStyle: data.tradingStyle || data.trading_style || data.style || '',
      riskProfile: data.riskProfile || data.risk_profile || '',
      preferredSession: data.preferredSession || data.preferred_session || '',
      experienceLevel: data.experienceLevel || data.experience_level || '',
      tradingviewUrl: data.tradingviewUrl || data.tradingview_url || '',
      telegramHandle: data.telegramHandle || data.telegram_handle || '',
    },
    userId
  );

  const rawName = (decrypted.name || decrypted.displayName || 'Gold Trader').trim();
  const cleanHandleBase = rawName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'xautrader';
  const rawHandle = (decrypted.handle || `@${cleanHandleBase}`).trim();

  const normalized = {
    id: data.id || 'prof_default_primary',
    userId,
    name: rawName,
    handle: rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`,
    imageProfile: decrypted.imageProfile || '',
    tag: decrypted.tag || 'XAU/USD Specialist',
    tags:
      Array.isArray(decrypted.tags) && decrypted.tags.length > 0
        ? decrypted.tags
        : ['XAU/USD', 'London Session', 'ICT / SMC'],
    tradingStyle: decrypted.tradingStyle || PROFILE_TRADING_STYLES[0],
    riskProfile: decrypted.riskProfile || PROFILE_RISK_MANDATES[1],
    preferredSession: decrypted.preferredSession || PROFILE_SESSIONS[0],
    location: decrypted.location || 'Global Trading Desk',
    experienceLevel: decrypted.experienceLevel || PROFILE_EXPERIENCE_LEVELS[1],
    motto:
      decrypted.motto ||
      'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
    bio: decrypted.bio || '',
    tradingviewUrl: decrypted.tradingviewUrl || '',
    telegramHandle: decrypted.telegramHandle || '',
    linkedAccountId: data.linkedAccountId || data.linked_account_id || 'all',
    isActive: true,
    isEncrypted: true,
    encryptionFingerprint: decrypted.encryptionFingerprint || '',
    createdAt: data.createdAt || data.created_at || now,
    updatedAt: data.updatedAt || data.updated_at || now,
  };

  return decryptProfileFromStorage(normalized, userId);
}
