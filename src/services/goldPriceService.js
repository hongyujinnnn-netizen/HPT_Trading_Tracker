/**
 * Centralized Gold Price Service (Singleton)
 *
 * Architecture: per-client REST polling of keyless public price APIs.
 *
 * Sources (in priority order):
 *   1. gold-api.com REST  — primary, polled every 2 s while tab is visible
 *   2. CoinGecko PAX Gold — last resort
 *
 * NOTE on Finnhub:
 *   Finnhub's free tier covers US equities only. Both the WebSocket stream
 *   and the REST /quote endpoint return errors for OANDA:XAU_USD (forex).
 *   A paid Forex add-on would be required, so Finnhub is not used here.
 *   If tick-level streaming is ever needed, run it server-side via a
 *   Supabase Edge Function and publish through a private Realtime channel.
 */

const ConnectionState = {
  CONNECTING:   'connecting',
  LIVE:         'live',
  RECONNECTING: 'reconnecting',
  FALLBACK:     'fallback',
  OFFLINE:      'offline',
};

const MAX_TICK_DEVIATION = 0.05; // reject ticks that jump > 5 % from last price

class GoldPriceService {
  constructor() {
    // Price state
    this._price          = null;
    this._previousPrice  = null;
    this._bid            = null;
    this._ask            = null;
    this._change24h      = 0;
    this._source         = 'unknown'; // 'goldapi' | 'coingecko'
    this._lastUpdated    = null;
    this._ticksPerSecond = 0;

    // Connection state
    this._connectionState     = ConnectionState.OFFLINE;
    this._consecutiveFailures = 0;

    // Polling
    this._pollIntervalId = null;
    this._pollMs         = 2000;   // fast poll while tab visible
    this._hiddenPollMs   = 30000;  // slow poll when tab hidden + no active orders
    this._inFlight       = false;

    // Tick-rate measurement
    this._tickTimestamps     = [];
    this._tickRateIntervalId = null;

    // Subscribers
    this._listeners       = new Set();
    this._hasActiveOrders = false;
    this._isRunning       = false;

    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  // ─── Public API ───────────────────────────────────────

  getPrice() { return this._price; }

  getState() {
    return {
      price:           this._price,
      previousPrice:   this._previousPrice,
      bid:             this._bid,
      ask:             this._ask,
      change24h:       this._change24h,
      source:          this._source,
      lastUpdated:     this._lastUpdated,
      hasActiveOrders: this._hasActiveOrders,
      connectionState: this._connectionState,
      ticksPerSecond:  this._ticksPerSecond,
      isLeader: false, // kept for backwards compatibility
    };
  }

  subscribe(callback) {
    this._listeners.add(callback);
    if (!this._isRunning) this._start();
    if (this._price !== null) {
      try { callback(this.getState()); } catch (e) { console.error('[GoldPrice] subscriber error:', e); }
    }
    return () => {
      this._listeners.delete(callback);
      if (this._listeners.size === 0) this._stop();
    };
  }

  setHasActiveOrders(hasOrders) {
    const changed = this._hasActiveOrders !== hasOrders;
    this._hasActiveOrders = hasOrders;
    if (changed && this._isRunning) this._restartPolling();
  }

  // ─── Lifecycle ────────────────────────────────────────

  _start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._consecutiveFailures = 0;
    this._setConnectionState(ConnectionState.CONNECTING);
    this._tickRateIntervalId = setInterval(() => this._measureTickRate(), 1000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange);
    }
    this._restartPolling();
  }

  _stop() {
    this._isRunning = false;
    this._stopPolling();
    if (this._tickRateIntervalId) {
      clearInterval(this._tickRateIntervalId);
      this._tickRateIntervalId = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
    this._connectionState = ConnectionState.OFFLINE;
  }

  _onVisibilityChange() {
    if (this._isRunning) this._restartPolling();
  }

  // ─── Polling ──────────────────────────────────────────

  _currentPollMs() {
    const hidden = typeof document !== 'undefined' && document.hidden;
    // Keep fast polling while pending orders need monitoring, even in background
    return hidden && !this._hasActiveOrders ? this._hiddenPollMs : this._pollMs;
  }

  _restartPolling() {
    this._stopPolling();
    this._fetchRestPrice();
    this._pollIntervalId = setInterval(() => this._fetchRestPrice(), this._currentPollMs());
  }

  _stopPolling() {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  }

  async _fetchRestPrice() {
    if (this._inFlight) return; // avoid overlapping requests on slow networks
    this._inFlight = true;
    try {
      const ok = (await this._tryGoldApi()) || (await this._tryCoinGecko());
      if (ok) {
        this._consecutiveFailures = 0;
      } else {
        this._consecutiveFailures++;
        this._setConnectionState(
          this._consecutiveFailures >= 3 ? ConnectionState.OFFLINE : ConnectionState.RECONNECTING,
        );
      }
    } finally {
      this._inFlight = false;
    }
  }

  // ─── Price Sources ────────────────────────────────────

  async _tryGoldApi() {
    try {
      const res = await fetch('https://api.gold-api.com/price/XAU');
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.price === 'number') {
        return this._applyPrice(parseFloat(data.price.toFixed(2)), {
          source:     'goldapi',
          spreadHalf: 0.20,
          change:     data.change_percent,
          updatedAt:  data.updatedAt,
        });
      }
    } catch (err) {
      console.warn('[GoldPrice] gold-api warning:', err);
    }
    return false;
  }

  async _tryCoinGecko() {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true',
      );
      if (!res.ok) return false;
      const data = await res.json();
      const paxg = data && data['pax-gold'];
      if (paxg && typeof paxg.usd === 'number') {
        return this._applyPrice(parseFloat(paxg.usd.toFixed(2)), {
          source:     'coingecko',
          spreadHalf: 0.30,
          change:     paxg.usd_24h_change,
        });
      }
    } catch (err) {
      console.warn('[GoldPrice] coingecko warning:', err);
    }
    return false;
  }

  // ─── Price Application ────────────────────────────────

  /** Apply a validated price update. Returns false if the tick was rejected. */
  _applyPrice(newPrice, { source, spreadHalf, change, updatedAt }) {
    if (!Number.isFinite(newPrice) || newPrice <= 0) return false;

    if (this._price !== null) {
      const deviation = Math.abs(newPrice - this._price) / this._price;
      if (deviation > MAX_TICK_DEVIATION) {
        console.warn(`[GoldPrice] Rejected bad tick from ${source}: $${newPrice}`);
        return false;
      }
    }

    if (newPrice !== this._price) this._tickTimestamps.push(Date.now());

    this._previousPrice = this._price;
    this._price         = newPrice;
    this._source        = source;
    this._lastUpdated   = updatedAt || new Date().toISOString();

    if (typeof change === 'number' && Number.isFinite(change)) {
      this._change24h = parseFloat(change.toFixed(2));
    }

    this._bid = parseFloat((newPrice - spreadHalf).toFixed(2));
    this._ask = parseFloat((newPrice + spreadHalf).toFixed(2));

    this._setConnectionState(source === 'goldapi' ? ConnectionState.LIVE : ConnectionState.FALLBACK);
    this._notify();
    return true;
  }

  // ─── Tick Rate Measurement ────────────────────────────

  _measureTickRate() {
    const now = Date.now();
    this._tickTimestamps = this._tickTimestamps.filter(t => now - t < 3000);
    this._ticksPerSecond = parseFloat((this._tickTimestamps.length / 3).toFixed(1));
  }

  // ─── Helpers ──────────────────────────────────────────

  _setConnectionState(state) {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this._notify();
    }
  }

  _notify() {
    const state = this.getState();
    for (const listener of this._listeners) {
      try { listener(state); } catch (e) { console.error('[GoldPrice] subscriber error:', e); }
    }
  }
}

export const goldPriceService = new GoldPriceService();
export { ConnectionState };
