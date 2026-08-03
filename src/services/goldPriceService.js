/**
 * Centralized Gold Price Service (Singleton)
 *
 * Architecture: WebSocket-first with REST API fallback
 *
 * Layer 1 (Primary):  Finnhub WebSocket — tick-by-tick ~100ms-1s updates
 * Layer 2 (Fallback): gold-api.com REST  — 2s polling when WS is down
 * Layer 3 (Emergency): CoinGecko REST    — 30s polling as last resort
 *
 * Features:
 *   - Auto-reconnect with exponential backoff (1s → 2s → 4s → … → 30s max)
 *   - Heartbeat monitor — force reconnect if no data for 10s
 *   - Bad tick filter — rejects >5% deviation spikes
 *   - Connection state exposed to UI
 *   - Bid/Ask spread from real tick data
 */

// Connection states exposed to consumers
const ConnectionState = {
  CONNECTING: 'connecting',
  LIVE: 'live',
  RECONNECTING: 'reconnecting',
  FALLBACK: 'fallback',
  OFFLINE: 'offline',
};

class GoldPriceService {
  constructor() {
    // Price state
    this._price = null;
    this._previousPrice = null;
    this._bid = null;
    this._ask = null;
    this._change24h = 0;
    this._source = 'unknown'; // 'finnhub' | 'goldapi' | 'coingecko'
    this._lastUpdated = null;
    this._tickCount = 0;
    this._ticksPerSecond = 0;

    // Connection state
    this._connectionState = ConnectionState.OFFLINE;
    this._ws = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 10;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._lastTickTime = 0;
    this._wsConsecutiveFailures = 0;

    // Fallback polling
    this._fallbackIntervalId = null;
    this._fallbackPollMs = 2000; // 2s when in fallback mode
    this._wsRetryIntervalId = null;

    // Tick rate measurement
    this._tickTimestamps = [];
    this._tickRateIntervalId = null;

    // Subscribers
    this._listeners = new Set();
    this._hasActiveOrders = false;
    this._isRunning = false;

    // Finnhub config
    this._finnhubKey = import.meta.env.VITE_FINNHUB_API_KEY || '';
    this._finnhubSymbol = 'OANDA:XAU_USD';

    // Opening price for daily change calculation
    this._openPrice = null;
  }

  // ─── Public API ───────────────────────────────────────

  /** Get current price synchronously */
  getPrice() {
    return this._price;
  }

  /** Get full state snapshot */
  getState() {
    return {
      price: this._price,
      previousPrice: this._previousPrice,
      bid: this._bid,
      ask: this._ask,
      change24h: this._change24h,
      source: this._source,
      lastUpdated: this._lastUpdated,
      hasActiveOrders: this._hasActiveOrders,
      connectionState: this._connectionState,
      ticksPerSecond: this._ticksPerSecond,
    };
  }

  /**
   * Subscribe to price updates.
   * Callback receives full state object.
   * Returns an unsubscribe function.
   */
  subscribe(callback) {
    this._listeners.add(callback);

    // Start if first subscriber
    if (!this._isRunning) {
      this._start();
    }

    // Immediately emit current state if available
    if (this._price !== null) {
      try { callback(this.getState()); } catch (e) { console.error('[GoldPrice] subscriber error:', e); }
    }

    return () => {
      this._listeners.delete(callback);
      if (this._listeners.size === 0) {
        this._stop();
      }
    };
  }

  /**
   * Toggle fast/normal mode based on active orders.
   */
  setHasActiveOrders(hasOrders) {
    this._hasActiveOrders = hasOrders;
  }

  // ─── Lifecycle ────────────────────────────────────────

  _start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._reconnectAttempts = 0;
    this._wsConsecutiveFailures = 0;

    // Start tick rate measurement
    this._tickRateIntervalId = setInterval(() => this._measureTickRate(), 1000);

    // Try WebSocket first, fall back to REST if no API key
    if (this._finnhubKey && this._finnhubKey !== 'your_finnhub_api_key_here') {
      this._connectWebSocket();
    } else {
      console.warn('[GoldPrice] No Finnhub API key configured. Using REST polling fallback. Add VITE_FINNHUB_API_KEY to .env.local for real-time streaming.');
      this._startFallbackPolling();
    }
  }

  _stop() {
    this._isRunning = false;
    this._disconnectWebSocket();
    this._stopFallbackPolling();
    this._stopWsRetryInterval();

    if (this._tickRateIntervalId) {
      clearInterval(this._tickRateIntervalId);
      this._tickRateIntervalId = null;
    }

    this._connectionState = ConnectionState.OFFLINE;
  }

  // ─── WebSocket Layer (Primary) ────────────────────────

  _connectWebSocket() {
    // Clean up existing connection
    this._disconnectWebSocket();

    this._setConnectionState(ConnectionState.CONNECTING);

    try {
      const url = `wss://ws.finnhub.io?token=${this._finnhubKey}`;
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        console.log('[GoldPrice] WebSocket connected to Finnhub');
        this._reconnectAttempts = 0;
        this._wsConsecutiveFailures = 0;

        // Subscribe to XAU/USD
        this._ws.send(JSON.stringify({
          type: 'subscribe',
          symbol: this._finnhubSymbol,
        }));

        // Stop fallback polling if running
        this._stopFallbackPolling();
        this._stopWsRetryInterval();

        // Start heartbeat monitor
        this._startHeartbeat();

        this._setConnectionState(ConnectionState.LIVE);
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'trade' && Array.isArray(msg.data)) {
            this._processWsTicks(msg.data);
          } else if (msg.type === 'ping') {
            // Finnhub heartbeat — reset our monitor
            this._resetHeartbeat();
          }
        } catch (err) {
          console.warn('[GoldPrice] WS message parse error:', err);
        }
      };

      this._ws.onerror = (err) => {
        console.warn('[GoldPrice] WebSocket error:', err);
      };

      this._ws.onclose = (event) => {
        console.log(`[GoldPrice] WebSocket closed: code=${event.code} reason=${event.reason}`);
        this._stopHeartbeat();

        if (this._isRunning) {
          this._wsConsecutiveFailures++;
          this._scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[GoldPrice] WebSocket creation failed:', err);
      this._wsConsecutiveFailures++;
      this._scheduleReconnect();
    }
  }

  _disconnectWebSocket() {
    this._stopHeartbeat();

    if (this._ws) {
      try {
        // Unsubscribe before closing
        if (this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(JSON.stringify({
            type: 'unsubscribe',
            symbol: this._finnhubSymbol,
          }));
        }
        this._ws.onopen = null;
        this._ws.onmessage = null;
        this._ws.onerror = null;
        this._ws.onclose = null;
        this._ws.close();
      } catch (e) { /* ignore */ }
      this._ws = null;
    }

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /**
   * Process tick data from Finnhub WebSocket.
   * Each tick: { s: symbol, p: price, t: timestamp, v: volume }
   */
  _processWsTicks(ticks) {
    // Use the most recent tick
    const latest = ticks[ticks.length - 1];
    if (!latest || typeof latest.p !== 'number') return;

    const newPrice = parseFloat(latest.p.toFixed(2));

    // Bad tick filter: reject >5% deviation from last known price
    if (this._price !== null) {
      const deviation = Math.abs(newPrice - this._price) / this._price;
      if (deviation > 0.05) {
        console.warn(`[GoldPrice] Rejected bad tick: $${newPrice} (${(deviation * 100).toFixed(1)}% deviation from $${this._price})`);
        return;
      }
    }

    // Track opening price for daily change
    if (this._openPrice === null) {
      this._openPrice = newPrice;
    }

    // Update bid/ask from tick spread
    if (ticks.length >= 2) {
      const prices = ticks.map(t => t.p).sort((a, b) => a - b);
      this._bid = parseFloat(prices[0].toFixed(2));
      this._ask = parseFloat(prices[prices.length - 1].toFixed(2));
    } else {
      // Estimate bid/ask from single tick (typical XAU spread ~$0.20-0.50)
      this._bid = parseFloat((newPrice - 0.15).toFixed(2));
      this._ask = parseFloat((newPrice + 0.15).toFixed(2));
    }

    this._previousPrice = this._price;
    this._price = newPrice;
    this._source = 'finnhub';
    this._lastUpdated = new Date(latest.t || Date.now()).toISOString();
    this._lastTickTime = Date.now();

    // Calculate daily change %
    if (this._openPrice) {
      this._change24h = parseFloat((((newPrice - this._openPrice) / this._openPrice) * 100).toFixed(2));
    }

    // Track tick rate
    this._tickTimestamps.push(Date.now());
    this._tickCount++;

    this._resetHeartbeat();
    this._notify();
  }

  // ─── Heartbeat Monitor ────────────────────────────────

  _startHeartbeat() {
    this._stopHeartbeat();
    this._lastTickTime = Date.now();

    // Check every 5s; if no tick in 10s, force reconnect
    this._heartbeatTimer = setInterval(() => {
      const silenceMs = Date.now() - this._lastTickTime;
      if (silenceMs > 10000) {
        console.warn(`[GoldPrice] No ticks for ${(silenceMs / 1000).toFixed(0)}s — forcing reconnect`);
        this._disconnectWebSocket();
        this._wsConsecutiveFailures++;
        this._scheduleReconnect();
      }
    }, 5000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _resetHeartbeat() {
    this._lastTickTime = Date.now();
  }

  // ─── Reconnection Logic ───────────────────────────────

  _scheduleReconnect() {
    if (!this._isRunning) return;

    // After 3 consecutive failures, switch to REST fallback
    if (this._wsConsecutiveFailures >= 3) {
      console.log('[GoldPrice] WebSocket failed 3+ times. Switching to REST fallback with periodic WS retry.');
      this._setConnectionState(ConnectionState.FALLBACK);
      this._startFallbackPolling();
      this._startWsRetryInterval();
      return;
    }

    this._setConnectionState(ConnectionState.RECONNECTING);
    this._reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
    const baseDelay = 1000;
    const delay = Math.min(baseDelay * Math.pow(2, this._reconnectAttempts - 1), 30000);

    console.log(`[GoldPrice] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this._reconnectAttempts})`);

    this._reconnectTimer = setTimeout(() => {
      if (this._isRunning) {
        this._connectWebSocket();
      }
    }, delay);
  }

  // ─── REST Fallback Layer ──────────────────────────────

  _startFallbackPolling() {
    if (this._fallbackIntervalId) return;

    // Fetch immediately
    this._fetchRestPrice();

    // Poll at 2s for fast fallback
    this._fallbackIntervalId = setInterval(() => {
      this._fetchRestPrice();
    }, this._fallbackPollMs);
  }

  _stopFallbackPolling() {
    if (this._fallbackIntervalId) {
      clearInterval(this._fallbackIntervalId);
      this._fallbackIntervalId = null;
    }
  }

  /** Periodically retry WebSocket while in fallback mode */
  _startWsRetryInterval() {
    this._stopWsRetryInterval();
    // Try to reconnect WS every 60s
    this._wsRetryIntervalId = setInterval(() => {
      if (this._isRunning && this._connectionState === ConnectionState.FALLBACK) {
        console.log('[GoldPrice] Retrying WebSocket from fallback...');
        this._wsConsecutiveFailures = 0;
        this._reconnectAttempts = 0;
        this._connectWebSocket();
      }
    }, 60000);
  }

  _stopWsRetryInterval() {
    if (this._wsRetryIntervalId) {
      clearInterval(this._wsRetryIntervalId);
      this._wsRetryIntervalId = null;
    }
  }

  /** Fetch price from REST APIs (gold-api.com → CoinGecko) */
  async _fetchRestPrice() {
    const fetched = await this._tryGoldApi();
    if (!fetched) {
      await this._tryCoinGecko();
    }
  }

  async _tryGoldApi() {
    try {
      const res = await fetch('https://api.gold-api.com/price/XAU');
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.price === 'number') {
        const newPrice = parseFloat(data.price.toFixed(2));

        // Bad tick filter
        if (this._price !== null) {
          const deviation = Math.abs(newPrice - this._price) / this._price;
          if (deviation > 0.05) return false;
        }

        this._previousPrice = this._price;
        this._price = newPrice;
        this._source = 'goldapi';
        this._lastUpdated = data.updatedAt || new Date().toISOString();
        if (typeof data.change_percent === 'number') {
          this._change24h = parseFloat(data.change_percent.toFixed(2));
        }

        // Estimate bid/ask
        this._bid = parseFloat((newPrice - 0.20).toFixed(2));
        this._ask = parseFloat((newPrice + 0.20).toFixed(2));

        this._notify();
        return true;
      }
    } catch (err) {
      console.warn('[GoldPrice] gold-api warning:', err);
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
        const newPrice = parseFloat(data['pax-gold'].usd.toFixed(2));

        this._previousPrice = this._price;
        this._price = newPrice;
        this._source = 'coingecko';
        this._lastUpdated = new Date().toISOString();
        if (typeof data['pax-gold'].usd_24h_change === 'number') {
          this._change24h = parseFloat(data['pax-gold'].usd_24h_change.toFixed(2));
        }

        this._bid = parseFloat((newPrice - 0.30).toFixed(2));
        this._ask = parseFloat((newPrice + 0.30).toFixed(2));

        if (this._connectionState !== ConnectionState.FALLBACK) {
          this._setConnectionState(ConnectionState.FALLBACK);
        }

        this._notify();
        return true;
      }
    } catch (err) {
      console.warn('[GoldPrice] coingecko warning:', err);
    }
    return false;
  }

  // ─── Tick Rate Measurement ────────────────────────────

  _measureTickRate() {
    const now = Date.now();
    // Keep only ticks from the last 3 seconds for smoothing
    this._tickTimestamps = this._tickTimestamps.filter(t => now - t < 3000);
    this._ticksPerSecond = parseFloat((this._tickTimestamps.length / 3).toFixed(1));
  }

  // ─── Internal Helpers ─────────────────────────────────

  _setConnectionState(state) {
    if (this._connectionState !== state) {
      this._connectionState = state;
      this._notify();
    }
  }

  _notify() {
    const state = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[GoldPrice] subscriber error:', e);
      }
    }
  }
}

// Export a singleton instance
export const goldPriceService = new GoldPriceService();
export { ConnectionState };
