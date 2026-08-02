/**
 * Centralized Gold Price Service (Singleton)
 *
 * Polls real XAU/USD price from gold-api.com with CoinGecko PAX Gold fallback.
 * Provides subscription-based price updates for all consumers.
 *
 * Polling frequency:
 *   - 5 seconds when active orders exist (fast mode)
 *   - 30 seconds otherwise (normal mode)
 */

class GoldPriceService {
  constructor() {
    this._price = null;
    this._previousPrice = null;
    this._change24h = 0;
    this._source = 'unknown'; // 'goldapi' | 'coingecko' | 'unknown'
    this._lastUpdated = null;
    this._listeners = new Set();
    this._intervalId = null;
    this._hasActiveOrders = false;
    this._isRunning = false;
    this._fetchInProgress = false;
  }

  /** Get current price synchronously */
  getPrice() {
    return this._price;
  }

  /** Get full state snapshot */
  getState() {
    return {
      price: this._price,
      previousPrice: this._previousPrice,
      change24h: this._change24h,
      source: this._source,
      lastUpdated: this._lastUpdated,
      hasActiveOrders: this._hasActiveOrders,
    };
  }

  /**
   * Subscribe to price updates.
   * Callback receives: { price, previousPrice, change24h, source, lastUpdated }
   * Returns an unsubscribe function.
   */
  subscribe(callback) {
    this._listeners.add(callback);

    // Start polling if this is the first subscriber
    if (!this._isRunning) {
      this._start();
    }

    // Immediately emit current state if we have a price
    if (this._price !== null) {
      try { callback(this.getState()); } catch (e) { console.error('[GoldPriceService] subscriber error:', e); }
    }

    return () => {
      this._listeners.delete(callback);
      // Stop polling if no more subscribers
      if (this._listeners.size === 0) {
        this._stop();
      }
    };
  }

  /**
   * Tell the service whether active orders exist.
   * This adjusts polling frequency (5s fast vs 30s normal).
   */
  setHasActiveOrders(hasOrders) {
    const changed = this._hasActiveOrders !== hasOrders;
    this._hasActiveOrders = hasOrders;
    if (changed && this._isRunning) {
      // Restart with new interval
      this._stop();
      this._start();
    }
  }

  /** Internal: start polling */
  _start() {
    if (this._isRunning) return;
    this._isRunning = true;

    // Fetch immediately on start
    this._fetchPrice();

    const intervalMs = this._hasActiveOrders ? 5000 : 30000;
    this._intervalId = setInterval(() => this._fetchPrice(), intervalMs);
  }

  /** Internal: stop polling */
  _stop() {
    this._isRunning = false;
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /** Internal: fetch price from APIs */
  async _fetchPrice() {
    if (this._fetchInProgress) return;
    this._fetchInProgress = true;

    try {
      // Try gold-api.com first
      const fetched = await this._tryGoldApi();
      if (!fetched) {
        // Fallback to CoinGecko PAX Gold
        await this._tryCoinGecko();
      }
    } catch (err) {
      console.warn('[GoldPriceService] fetch error:', err);
    } finally {
      this._fetchInProgress = false;
    }
  }

  async _tryGoldApi() {
    try {
      const res = await fetch('https://api.gold-api.com/price/XAU');
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.price === 'number') {
        this._previousPrice = this._price;
        this._price = parseFloat(data.price.toFixed(2));
        this._source = 'goldapi';
        this._lastUpdated = data.updatedAt || new Date().toISOString();
        if (typeof data.change_percent === 'number') {
          this._change24h = parseFloat(data.change_percent.toFixed(2));
        }
        this._notify();
        return true;
      }
    } catch (err) {
      console.warn('[GoldPriceService] gold-api warning:', err);
    }
    return false;
  }

  async _tryCoinGecko() {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true'
      );
      if (!res.ok) return false;
      const data = await res.json();
      if (data && data['pax-gold'] && typeof data['pax-gold'].usd === 'number') {
        this._previousPrice = this._price;
        this._price = parseFloat(data['pax-gold'].usd.toFixed(2));
        this._source = 'coingecko';
        this._lastUpdated = new Date().toISOString();
        if (typeof data['pax-gold'].usd_24h_change === 'number') {
          this._change24h = parseFloat(data['pax-gold'].usd_24h_change.toFixed(2));
        }
        this._notify();
        return true;
      }
    } catch (err) {
      console.warn('[GoldPriceService] coingecko warning:', err);
    }
    return false;
  }

  /** Internal: notify all subscribers */
  _notify() {
    const state = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[GoldPriceService] subscriber error:', e);
      }
    }
  }
}

// Export a singleton instance
export const goldPriceService = new GoldPriceService();
