/**
 * Trade Store Repository Interface
 * Abstracts storage operations so swapping from LocalStorage to Supabase or indexedDB
 * is a single file change without rewriting UI components or TradeContext.
 */

import { createTrade } from '../types/tradeSchema';

const STORAGE_KEY = 'tradepulse_gold_trades_v1';
const SETTINGS_KEY = 'tradepulse_gold_settings_v1';
const INIT_KEY = 'tradepulse_gold_initialized_v1';

export const DEFAULT_SETTINGS = {
  accountBalance: 10000,
  baseCurrency: 'USD',
  defaultRiskPct: 1.0,
  targetRRRatio: 2.0,
  contractSize: 100, // 100 oz per standard lot for XAU/USD (configurable for micro/cent accounts)
  sessionTimezone: 'GMT+7 (Phnom Penh)',
  theme: 'dark-gold',
};

export const tradeStore = {
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
    localStorage.setItem(INIT_KEY, 'true');
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    this.setInitialized();
    return merged;
  },

  /**
   * Clear all trades
   */
  async clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(INIT_KEY);
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  }
};
