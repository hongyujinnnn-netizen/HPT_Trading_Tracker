/**
 * Trade Store Repository Interface
 * Abstracts storage operations so swapping from LocalStorage to Supabase or indexedDB
 * is a single file change without rewriting UI components or TradeContext.
 */

import { createTrade } from '../types/tradeSchema';
import { createTradingAccount } from '../types/accountSchema';
import { createTargetPlan, PLAN_PRESETS } from '../types/planSchema';
import { createTraderProfile } from '../types/profileSchema';
import { encryptProfileForStorage, isEncryptedValue } from '../utils/profileCrypto';
import { INITIAL_ACCOUNTS } from '../utils/mockData';

const STORAGE_KEY = 'tradepulse_gold_trades_v1';
const SETTINGS_KEY = 'tradepulse_gold_settings_v1';
const INIT_KEY = 'tradepulse_gold_initialized_v1';
const ACCOUNTS_KEY = 'tradepulse_gold_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'tradepulse_gold_active_account_v1';
const PLANS_KEY = 'tradepulse_gold_target_plans_v1';
const ACTIVE_PLAN_KEY = 'tradepulse_gold_active_target_plan_v1';
const PROFILES_KEY = 'tradepulse_gold_profiles_v1';
const ACTIVE_PROFILE_KEY = 'tradepulse_gold_active_profile_v1';
const LEGACY_PROFILE_META_KEY = 'tradepulse_trader_profile_meta';

export const DEFAULT_SETTINGS = {
  accountBalance: 10000,
  baseCurrency: 'USD',
  defaultRiskPct: 1.0,
  targetRRRatio: 2.0,
  contractSize: 100, // 100 oz per standard lot for XAU/USD (configurable for micro/cent accounts)
  sessionTimezone: 'GMT+7 (Phnom Penh)',
  theme: 'dark-gold',
};

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[tradeStore] Failed to write to localStorage for key "${key}":`, e);
    return false;
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[tradeStore] Failed to remove localStorage key "${key}":`, e);
    return false;
  }
}

export const tradeStore = {
  /**
   * Fetch all trading sub-accounts
   */
  async getAccounts() {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(createTradingAccount) : [];
    } catch (e) {
      console.error('Failed to read trading accounts from localStorage:', e);
      return [];
    }
  },

  /**
   * Save a new trading sub-account
   */
  async addAccount(accountData) {
    const account = createTradingAccount(accountData);
    const existing = await this.getAccounts();
    const updated = [...existing, account];
    safeSetItem(ACCOUNTS_KEY, JSON.stringify(updated));
    return account;
  },

  /**
   * Update existing sub-account
   */
  async updateAccount(id, updates) {
    const existing = await this.getAccounts();
    const index = existing.findIndex((a) => a.id === id);
    if (index === -1) return null;

    const updated = createTradingAccount({ ...existing[index], ...updates, id });
    existing[index] = updated;
    safeSetItem(ACCOUNTS_KEY, JSON.stringify(existing));
    return updated;
  },

  /**
   * Soft-delete (archive) an account
   */
  async archiveAccount(id) {
    return await this.updateAccount(id, { isArchived: true });
  },

  /**
   * Get active account ID from storage
   */
  getActiveAccountId() {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || 'all';
  },

  /**
   * Set active account ID in storage
   */
  setActiveAccountId(id) {
    if (id) {
      safeSetItem(ACTIVE_ACCOUNT_KEY, id);
    } else {
      safeRemoveItem(ACTIVE_ACCOUNT_KEY);
    }
  },

  /**
   * Check if database has been initialized before
   */
  isInitialized() {
    return localStorage.getItem(INIT_KEY) === 'true';
  },

  /**
   * Mark database as initialized
   */
  setInitialized() {
    safeSetItem(INIT_KEY, 'true');
  },

  /**
   * Fetch all trades from storage
   * @returns {Promise<Trade[]>}
   */
  async getAllTrades() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(createTrade) : [];
    } catch (e) {
      console.error('Failed to read trades from localStorage:', e);
      return [];
    }
  },

  /**
   * Save a new trade
   * @param {Partial<Trade>} tradeData 
   * @returns {Promise<Trade>}
   */
  async addTrade(tradeData) {
    const trade = createTrade(tradeData);
    const existing = await this.getAllTrades();
    const updated = [trade, ...existing];
    safeSetItem(STORAGE_KEY, JSON.stringify(updated));
    this.setInitialized();
    return trade;
  },

  /**
   * Update an existing trade by ID
   * @param {string} id 
   * @param {Partial<Trade>} updates 
   * @returns {Promise<Trade|null>}
   */
  async updateTrade(id, updates) {
    const existing = await this.getAllTrades();
    const index = existing.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updatedTrade = createTrade({ ...existing[index], ...updates, id });
    existing[index] = updatedTrade;
    safeSetItem(STORAGE_KEY, JSON.stringify(existing));
    return updatedTrade;
  },

  /**
   * Delete a trade by ID
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  async deleteTrade(id) {
    const existing = await this.getAllTrades();
    const filtered = existing.filter((t) => t.id !== id);
    safeSetItem(STORAGE_KEY, JSON.stringify(filtered));
    this.setInitialized();
    return true;
  },

  /**
   * Batch import trades (from CSV or seed data)
   * @param {Partial<Trade>[]} batch 
   * @returns {Promise<Trade[]>}
   */
  async importBatch(batch) {
    const normalized = batch.map(createTrade);
    const existing = await this.getAllTrades();
    const merged = [...normalized, ...existing];
    safeSetItem(STORAGE_KEY, JSON.stringify(merged));
    this.setInitialized();
    return merged;
  },

  /**
   * Bulk import trades and apply balance operations to sub-account
   */
  async bulkImportTrades(tradesToImport = [], balanceOps = [], accountId = '') {
    const normalized = tradesToImport.map((t) => createTrade({ ...t, accountId }));
    const existing = await this.getAllTrades();

    // Deduplicate by brokerPositionId
    const existingPositionIds = new Set(existing.filter((t) => t.brokerPositionId).map((t) => String(t.brokerPositionId)));
    const uniqueNew = normalized.filter((t) => !t.brokerPositionId || !existingPositionIds.has(String(t.brokerPositionId)));

    const merged = [...uniqueNew, ...existing];
    safeSetItem(STORAGE_KEY, JSON.stringify(merged));
    this.setInitialized();

    // Apply balance operations to target sub-account
    if (accountId && balanceOps.length > 0) {
      const netBalanceAdjustment = balanceOps.reduce((sum, op) => sum + (parseFloat(op.amount) || 0), 0);
      if (netBalanceAdjustment !== 0) {
        const accounts = await this.getAccounts();
        const acc = accounts.find((a) => a.id === accountId);
        if (acc) {
          const newBalance = Math.max(0, acc.initialBalance + netBalanceAdjustment);
          await this.updateAccount(accountId, { initialBalance: newBalance });
        }
      }
    }

    return merged;
  },

  /**
   * Clear all trades
   */
  async clearAll() {
    safeRemoveItem(STORAGE_KEY);
    safeRemoveItem(INIT_KEY);
    return [];
  },

  /**
   * Read settings
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Save settings
   */
  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    safeSetItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Fetch all target plans
   */
  async getPlans() {
    try {
      const raw = localStorage.getItem(PLANS_KEY);
      if (!raw) {
        // Seed default micro-doubler plan ($50 -> $100)
        const defaultPlan = createTargetPlan({
          ...PLAN_PRESETS[0],
          id: 'plan_default_micro_50_100',
        });
        safeSetItem(PLANS_KEY, JSON.stringify([defaultPlan]));
        return [defaultPlan];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(createTargetPlan) : [];
    } catch (e) {
      console.error('Failed to read target plans from localStorage:', e);
      return [];
    }
  },

  /**
   * Save all target plans
   */
  async savePlans(plans) {
    const normalized = plans.map(createTargetPlan);
    safeSetItem(PLANS_KEY, JSON.stringify(normalized));
    return normalized;
  },

  /**
   * Add a new target plan
   */
  async addPlan(planData) {
    const plan = createTargetPlan(planData);
    const existing = await this.getPlans();
    const updated = [plan, ...existing];
    await this.savePlans(updated);
    return plan;
  },

  /**
   * Update existing target plan
   */
  async updatePlan(id, updates) {
    const existing = await this.getPlans();
    const index = existing.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated = createTargetPlan({ ...existing[index], ...updates, id, updatedAt: new Date().toISOString() });
    existing[index] = updated;
    await this.savePlans(existing);
    return updated;
  },

  /**
   * Delete a target plan
   */
  async deletePlan(id) {
    const existing = await this.getPlans();
    const filtered = existing.filter((p) => p.id !== id);
    await this.savePlans(filtered);
    return filtered;
  },

  /**
   * Get active target plan ID
   */
  getActivePlanId() {
    return localStorage.getItem(ACTIVE_PLAN_KEY) || null;
  },

  /**
   * Set active target plan ID
   */
  setActivePlanId(id) {
    if (id) {
      safeSetItem(ACTIVE_PLAN_KEY, id);
    } else {
      safeRemoveItem(ACTIVE_PLAN_KEY);
    }
  },

  // ── Trader Profile (`profiles` table local store — strict 1 user = 1 encrypted profile) ──
  async getProfiles(defaultUser = {}) {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        if (list.length > 0 && list[0]) {
          const firstRaw = list[0];
          const decryptedSingle = createTraderProfile({
            ...firstRaw,
            userId: firstRaw.userId || defaultUser.id || '',
          });
          // Ensure stored payload in localStorage is encrypted at rest and restricted to 1 profile
          if (!isEncryptedValue(firstRaw.name) || list.length > 1) {
            const encryptedPayload = encryptProfileForStorage(decryptedSingle);
            safeSetItem(PROFILES_KEY, JSON.stringify([encryptedPayload]));
          }
          safeRemoveItem(LEGACY_PROFILE_META_KEY);
          return [decryptedSingle];
        }
      }
      // Migrate from legacy single-profile meta if present, then scrub plaintext legacy key
      let legacy = {};
      try {
        const legacyRaw = localStorage.getItem(LEGACY_PROFILE_META_KEY);
        if (legacyRaw) legacy = JSON.parse(legacyRaw);
      } catch (_e) {
        // ignore
      }
      const fallbackName = legacy.displayName || defaultUser.name || 'Gold Trader';
      const initialProfile = createTraderProfile({
        id: 'prof_default_primary',
        userId: defaultUser.id || '',
        name: fallbackName,
        handle: legacy.handle || `@${fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'xautrader'}`,
        tag: legacy.tag || 'XAU/USD Specialist',
        tags: legacy.tags || ['XAU/USD', 'London Session', 'ICT / SMC'],
        tradingStyle: legacy.style || 'ICT / Smart Money',
        riskProfile: legacy.riskProfile || 'Balanced Institutional (1%–2%)',
        motto: legacy.motto || 'Protect capital first. Execute A+ London & NY setups with strict stop-loss discipline.',
        isActive: true,
      });
      safeSetItem(PROFILES_KEY, JSON.stringify([encryptProfileForStorage(initialProfile)]));
      safeRemoveItem(LEGACY_PROFILE_META_KEY);
      return [initialProfile];
    } catch (e) {
      console.error('Failed to read profiles from localStorage:', e);
      return [createTraderProfile({ userId: defaultUser.id || '', name: defaultUser.name || 'Gold Trader' })];
    }
  },

  async saveProfiles(profiles) {
    const list = Array.isArray(profiles) && profiles.length > 0 ? [profiles[0]] : [];
    const normalized = list.map((p) => createTraderProfile(p));
    const encryptedAtRest = normalized.map((p) => encryptProfileForStorage(p));
    safeSetItem(PROFILES_KEY, JSON.stringify(encryptedAtRest));
    safeRemoveItem(LEGACY_PROFILE_META_KEY);
    return normalized;
  },

  async addProfile(profileData) {
    // Strict 1 user = 1 profile: update the single canonical profile instead of adding duplicates
    const existing = await this.getProfiles({ id: profileData?.userId || '' });
    const current = existing[0] || {};
    const merged = createTraderProfile({
      ...current,
      ...profileData,
      id: profileData?.id || current.id || 'prof_default_primary',
      updatedAt: new Date().toISOString(),
    });
    await this.saveProfiles([merged]);
    return merged;
  },

  async updateProfile(id, updates) {
    const existing = await this.getProfiles({ id: updates?.userId || '' });
    const current = existing[0] || {};
    const updated = createTraderProfile({
      ...current,
      ...updates,
      id: id || current.id || 'prof_default_primary',
      updatedAt: new Date().toISOString(),
    });
    await this.saveProfiles([updated]);
    return updated;
  },

  async deleteProfile(_id) {
    // 1 user = 1 profile cannot be deleted; return existing single profile
    return await this.getProfiles();
  },

  getActiveProfileId() {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || null;
  },

  setActiveProfileId(id) {
    if (id) {
      safeSetItem(ACTIVE_PROFILE_KEY, id);
    } else {
      safeRemoveItem(ACTIVE_PROFILE_KEY);
    }
  }
};
