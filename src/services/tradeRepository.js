import { tradeStore } from './tradeStore';
import { supabaseStore } from './supabaseStore';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export const tradeRepository = {
  /**
   * Determine active mode: 'supabase' or 'unauthenticated'
   */
  async getActiveMode() {
    if (!isSupabaseConfigured || !supabase) return 'local';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session ? 'supabase' : 'unauthenticated';
    } catch {
      return 'unauthenticated';
    }
  },

  /**
   * Fetch all trades for active session
   */
  async getAllTrades() {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        return await supabaseStore.getAllTrades();
      }
      return [];
    }
    // Fallback if Supabase not configured in env
    return await tradeStore.getAllTrades();
  },

  /**
   * Fetch database views directly from Supabase
   */
  async getDashboardViews() {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        return await supabaseStore.getDashboardViews();
      }
    }
    return null;
  },

  /**
   * Fetch economic events calendar
   */
  async getEconomicEvents() {
    if (isSupabaseConfigured && supabase) {
      return await supabaseStore.getEconomicEvents();
    }
    return [];
  },

  /**
   * Add a new trade
   */
  async addTrade(tradeData) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const added = await supabaseStore.addTrade(tradeData, session.user.id);
        if (added) return added;
      }
      return null;
    }
    return await tradeStore.addTrade(tradeData);
  },

  /**
   * Delete trade
   */
  async deleteTrade(id) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        return await supabaseStore.deleteTrade(id);
      }
      return false;
    }
    return await tradeStore.deleteTrade(id);
  },

  /**
   * Import batch
   */
  async importBatch(batch) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const promises = batch.map((t) => supabaseStore.addTrade(t, session.user.id));
        await Promise.all(promises);
        return await supabaseStore.getAllTrades();
      }
      return [];
    }
    return await tradeStore.importBatch(batch);
  },

  /**
   * Bulk migrate local storage trades to cloud atomically
   */
  async migrateLocalTradesToCloud(userId) {
    const localTrades = await tradeStore.getAllTrades();
    if (!localTrades.length) return true;

    const success = await supabaseStore.migrateLocalTradesToCloud(userId, localTrades);
    if (success) {
      // Clear local store only after verified cloud insertion
      await tradeStore.clearAll();
    }
    return success;
  },

  /**
   * Fetch settings
   */
  async getSettings() {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const dbSettings = await supabaseStore.getSettings(session.user.id);
        if (dbSettings) {
          return {
            accountBalance: parseFloat(dbSettings.account_balance) || 10000,
            baseCurrency: dbSettings.base_currency || 'USD',
            defaultRiskPct: parseFloat(dbSettings.default_risk_pct) || 1.0,
            contractSize: parseFloat(dbSettings.contract_size) || 100,
            sessionTimezone: dbSettings.session_timezone || 'Asia/Phnom_Penh',
          };
        }
      }
    }
    return tradeStore.getSettings();
  },

  /**
   * Save settings
   */
  async saveSettings(settings) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabaseStore.saveSettings(session.user.id, {
          account_balance: settings.accountBalance,
          default_risk_pct: settings.defaultRiskPct,
          contract_size: settings.contractSize,
          session_timezone: settings.sessionTimezone,
        });
      }
    }
    return tradeStore.saveSettings(settings);
  },

  /**
   * Fetch latest price snapshot
   */
  async getLatestPriceSnapshot() {
    if (isSupabaseConfigured && supabase) {
      return await supabaseStore.getLatestPriceSnapshot();
    }
    return null;
  },

  /**
   * Fetch 24h price feed health diagnostic
   */
  async getPriceFeedHealth24h() {
    if (isSupabaseConfigured && supabase) {
      return await supabaseStore.getPriceFeedHealth24h();
    }
    return null;
  },

  /**
   * Subscribe to Realtime gold price updates
   */
  subscribeToGoldPrice(onNewSnapshot) {
    if (isSupabaseConfigured && supabase) {
      return supabaseStore.subscribeToGoldPrice(onNewSnapshot);
    }
    return null;
  },

  // ── Pending Orders ──────────────────────────────────────────────

  async getActiveOrders() {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return await supabaseStore.getActiveOrders();
    }
    return [];
  },

  async getAllOrders() {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return await supabaseStore.getAllOrders();
    }
    return [];
  },

  async createPendingOrder(orderData) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return await supabaseStore.createPendingOrder(orderData, session.user.id);
    }
    return null;
  },

  async updateOrderStatus(orderId, updates) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return await supabaseStore.updateOrderStatus(orderId, updates);
    }
    return null;
  },

  async cancelOrder(orderId) {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return await supabaseStore.cancelOrder(orderId);
    }
    return null;
  }
};
