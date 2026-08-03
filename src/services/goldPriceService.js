/**
 * Centralized Gold Price Service (Singleton)
 *
 * Architecture: Leader–Follower with Supabase Realtime Broadcast
 *
 * Problem: Finnhub free tier allows only 1 WebSocket connection per API key.
 *          If multiple users open the app, only 1 can connect.
 *
 * Solution: ONE user (the "leader") connects to Finnhub and broadcasts ticks
 *           to ALL other users via Supabase Realtime Broadcast channel.
 *           If the leader closes their browser, another user auto-promotes.
 *
 * Flow:
 *   1. All clients join Supabase Broadcast channel "gold-price-live"
 *   2. Listen for leader heartbeats (sent every 3s by the current leader)
 *   3. If no heartbeat received within 6s → this client becomes the leader
 *   4. Leader connects to Finnhub WS and broadcasts every tick to channel
 *   5. Followers receive ticks from channel (zero Finnhub connections)
 *   6. If Supabase is not configured → direct Finnhub connection (single user)
 *
 * Fallback layers:
 *   - gold-api.com REST (2s polling when WS is down)
 *   - CoinGecko REST (last resort)
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

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
    this._source = 'unknown'; // 'finnhub' | 'goldapi' | 'coingecko' | 'broadcast'
    this._lastUpdated = null;
    this._tickCount = 0;
    this._ticksPerSecond = 0;

    // Connection state
    this._connectionState = ConnectionState.OFFLINE;
    this._ws = null;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
    this._lastTickTime = 0;
    this._wsConsecutiveFailures = 0;

    // Fallback polling
    this._fallbackIntervalId = null;
    this._fallbackPollMs = 2000;
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

    // ─── Leader–Follower state ──────────────────────────
    this._clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._isLeader = false;
    this._broadcastChannel = null;
    this._lastLeaderHeartbeat = 0;       // timestamp of last heartbeat received
    this._leaderCheckTimer = null;       // interval to check if leader is alive
    this._leaderHeartbeatTimer = null;   // interval to send heartbeats (leader only)
    this._promotionDelay = null;         // timeout before self-promoting to leader
  }

  // ─── Public API ───────────────────────────────────────

  getPrice() {
    return this._price;
  }

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
      isLeader: this._isLeader,
    };
  }

  subscribe(callback) {
    this._listeners.add(callback);

    if (!this._isRunning) {
      this._start();
    }

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

    const hasFinnhub = this._finnhubKey && this._finnhubKey !== 'your_finnhub_api_key_here';

    // If Supabase is configured → use leader/follower broadcast pattern
    if (isSupabaseConfigured && supabase && hasFinnhub) {
      this._joinBroadcastChannel();
    } else if (hasFinnhub) {
      // No Supabase → single user mode, connect directly
      console.warn('[GoldPrice] Supabase not configured. Using direct Finnhub connection (single-user mode).');
      this._promoteToLeader();
    } else {
      console.warn('[GoldPrice] No Finnhub API key. Using REST polling fallback.');
      this._startFallbackPolling();
    }
  }

  _stop() {
    this._isRunning = false;
    this._demoteFromLeader();
    this._leaveBroadcastChannel();
    this._stopFallbackPolling();
    this._stopWsRetryInterval();

    if (this._tickRateIntervalId) {
      clearInterval(this._tickRateIntervalId);
      this._tickRateIntervalId = null;
    }
    if (this._leaderCheckTimer) {
      clearInterval(this._leaderCheckTimer);
      this._leaderCheckTimer = null;
    }
    if (this._promotionDelay) {
      clearTimeout(this._promotionDelay);
      this._promotionDelay = null;
    }

    this._connectionState = ConnectionState.OFFLINE;
  }

  // ─── Supabase Broadcast: Leader Election ──────────────

  _joinBroadcastChannel() {
    if (this._broadcastChannel) return;

    this._setConnectionState(ConnectionState.CONNECTING);

    this._broadcastChannel = supabase.channel('gold-price-live', {
      config: { broadcast: { self: false } },
    });

    // Listen for price tick broadcasts from the leader
    this._broadcastChannel.on('broadcast', { event: 'tick' }, (payload) => {
      this._onBroadcastTick(payload.payload);
    });

    // Listen for leader heartbeats
    this._broadcastChannel.on('broadcast', { event: 'heartbeat' }, (payload) => {
      this._onLeaderHeartbeat(payload.payload);
    });

    this._broadcastChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GoldPrice] Joined broadcast channel as ${this._clientId}`);

        // Wait to see if a leader announces itself
        // Use random jitter (2-5s) to prevent all clients promoting simultaneously
        const jitter = 2000 + Math.random() * 3000;
        this._lastLeaderHeartbeat = 0;

        this._promotionDelay = setTimeout(() => {
          if (this._lastLeaderHeartbeat === 0 && !this._isLeader) {
            console.log('[GoldPrice] No leader detected. Promoting self to leader.');
            this._promoteToLeader();
          }
        }, jitter);

        // Continuously check if leader is alive (every 3s)
        this._leaderCheckTimer = setInterval(() => {
          if (!this._isLeader && this._lastLeaderHeartbeat > 0) {
            const silenceMs = Date.now() - this._lastLeaderHeartbeat;
            if (silenceMs > 6000) {
              console.log(`[GoldPrice] Leader silent for ${(silenceMs / 1000).toFixed(0)}s. Promoting self.`);
              this._lastLeaderHeartbeat = 0;
              // Random jitter to avoid simultaneous promotion
              const jitter = 500 + Math.random() * 2000;
              setTimeout(() => {
                if (!this._isLeader && this._isRunning) {
                  this._promoteToLeader();
                }
              }, jitter);
            }
          }
        }, 3000);
      }
    });
  }

  _leaveBroadcastChannel() {
    if (this._broadcastChannel) {
      try {
        supabase.removeChannel(this._broadcastChannel);
      } catch (e) { /* ignore */ }
      this._broadcastChannel = null;
    }
  }

  /** Called when we receive a heartbeat from the current leader */
  _onLeaderHeartbeat(payload) {
    if (!payload || payload.clientId === this._clientId) return;

    this._lastLeaderHeartbeat = Date.now();

    // If we were trying to promote, cancel it — a leader exists
    if (this._promotionDelay) {
      clearTimeout(this._promotionDelay);
      this._promotionDelay = null;
    }

    // If we are also a leader (split brain), the older leader wins
    if (this._isLeader && payload.promotedAt && payload.promotedAt < this._leaderPromotedAt) {
      console.log('[GoldPrice] Older leader detected. Demoting self.');
      this._demoteFromLeader();
    }
  }

  /** Called when we receive a tick broadcast from the leader */
  _onBroadcastTick(payload) {
    if (!payload || typeof payload.price !== 'number') return;

    this._lastLeaderHeartbeat = Date.now(); // tick also counts as heartbeat

    const newPrice = payload.price;

    // Bad tick filter
    if (this._price !== null) {
      const deviation = Math.abs(newPrice - this._price) / this._price;
      if (deviation > 0.05) return;
    }

    if (this._openPrice === null) {
      this._openPrice = newPrice;
    }

    this._previousPrice = this._price;
    this._price = newPrice;
    this._bid = payload.bid ?? this._bid;
    this._ask = payload.ask ?? this._ask;
    this._change24h = payload.change24h ?? this._change24h;
    this._source = 'broadcast';
    this._lastUpdated = payload.lastUpdated || new Date().toISOString();
    this._lastTickTime = Date.now();

    this._tickTimestamps.push(Date.now());
    this._tickCount++;

    if (this._connectionState !== ConnectionState.LIVE) {
      this._setConnectionState(ConnectionState.LIVE);
    }

    this._notify();
  }

  // ─── Leader Role ──────────────────────────────────────

  _promoteToLeader() {
    if (this._isLeader) return;

    this._isLeader = true;
    this._leaderPromotedAt = Date.now();
    console.log(`[GoldPrice] 🏆 Promoted to LEADER (${this._clientId})`);

    // Start sending heartbeats so followers know we're alive
    this._startLeaderHeartbeat();

    // Connect to Finnhub
    this._connectWebSocket();
  }

  _demoteFromLeader() {
    if (!this._isLeader) return;

    this._isLeader = false;
    console.log(`[GoldPrice] Demoted from leader (${this._clientId})`);

    // Disconnect from Finnhub
    this._disconnectWebSocket();

    // Stop sending heartbeats
    this._stopLeaderHeartbeat();
  }

  _startLeaderHeartbeat() {
    this._stopLeaderHeartbeat();

    // Send heartbeat immediately, then every 3s
    this._sendHeartbeat();
    this._leaderHeartbeatTimer = setInterval(() => this._sendHeartbeat(), 3000);
  }

  _stopLeaderHeartbeat() {
    if (this._leaderHeartbeatTimer) {
      clearInterval(this._leaderHeartbeatTimer);
      this._leaderHeartbeatTimer = null;
    }
  }

  _sendHeartbeat() {
    if (!this._broadcastChannel || !this._isLeader) return;
    try {
      this._broadcastChannel.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: {
          clientId: this._clientId,
          promotedAt: this._leaderPromotedAt,
          price: this._price,
          ts: Date.now(),
        },
      });
    } catch (e) { /* ignore */ }
  }

  /** Broadcast a price tick to all followers */
  _broadcastTick() {
    if (!this._broadcastChannel || !this._isLeader) return;
    try {
      this._broadcastChannel.send({
        type: 'broadcast',
        event: 'tick',
        payload: {
          price: this._price,
          bid: this._bid,
          ask: this._ask,
          change24h: this._change24h,
          lastUpdated: this._lastUpdated,
          source: this._source,
          ts: Date.now(),
        },
      });
    } catch (e) { /* ignore */ }
  }

  // ─── WebSocket Layer (Leader Only) ────────────────────

  _connectWebSocket() {
    this._disconnectWebSocket();
    this._setConnectionState(ConnectionState.CONNECTING);

    try {
      const url = `wss://ws.finnhub.io?token=${this._finnhubKey}`;
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        console.log('[GoldPrice] WebSocket connected to Finnhub (leader mode)');
        this._reconnectAttempts = 0;
        this._wsConsecutiveFailures = 0;

        this._ws.send(JSON.stringify({
          type: 'subscribe',
          symbol: this._finnhubSymbol,
        }));

        this._stopFallbackPolling();
        this._stopWsRetryInterval();
        this._startHeartbeat();
        this._setConnectionState(ConnectionState.LIVE);
      };

      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'trade' && Array.isArray(msg.data)) {
            this._processWsTicks(msg.data);
          } else if (msg.type === 'ping') {
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

        if (this._isRunning && this._isLeader) {
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
   * Only the leader runs this. After processing, broadcast to followers.
   */
  _processWsTicks(ticks) {
    const latest = ticks[ticks.length - 1];
    if (!latest || typeof latest.p !== 'number') return;

    const newPrice = parseFloat(latest.p.toFixed(2));

    // Bad tick filter
    if (this._price !== null) {
      const deviation = Math.abs(newPrice - this._price) / this._price;
      if (deviation > 0.05) {
        console.warn(`[GoldPrice] Rejected bad tick: $${newPrice} (${(deviation * 100).toFixed(1)}% deviation)`);
        return;
      }
    }

    if (this._openPrice === null) {
      this._openPrice = newPrice;
    }

    // Bid/ask from tick data
    if (ticks.length >= 2) {
      const prices = ticks.map(t => t.p).sort((a, b) => a - b);
      this._bid = parseFloat(prices[0].toFixed(2));
      this._ask = parseFloat(prices[prices.length - 1].toFixed(2));
    } else {
      this._bid = parseFloat((newPrice - 0.15).toFixed(2));
      this._ask = parseFloat((newPrice + 0.15).toFixed(2));
    }

    this._previousPrice = this._price;
    this._price = newPrice;
    this._source = 'finnhub';
    this._lastUpdated = new Date(latest.t || Date.now()).toISOString();
    this._lastTickTime = Date.now();

    if (this._openPrice) {
      this._change24h = parseFloat((((newPrice - this._openPrice) / this._openPrice) * 100).toFixed(2));
    }

    this._tickTimestamps.push(Date.now());
    this._tickCount++;

    this._resetHeartbeat();
    this._notify();

    // 📡 Broadcast to all followers via Supabase
    this._broadcastTick();
  }

  // ─── Heartbeat Monitor (Finnhub WS liveness) ─────────

  _startHeartbeat() {
    this._stopHeartbeat();
    this._lastTickTime = Date.now();

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

    if (this._wsConsecutiveFailures >= 3) {
      console.log('[GoldPrice] WebSocket failed 3+ times. Switching to REST fallback.');
      this._setConnectionState(ConnectionState.FALLBACK);
      this._startFallbackPolling();
      this._startWsRetryInterval();
      return;
    }

    this._setConnectionState(ConnectionState.RECONNECTING);
    this._reconnectAttempts++;

    const baseDelay = 1000;
    const delay = Math.min(baseDelay * Math.pow(2, this._reconnectAttempts - 1), 30000);

    console.log(`[GoldPrice] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this._reconnectAttempts})`);

    this._reconnectTimer = setTimeout(() => {
      if (this._isRunning && this._isLeader) {
        this._connectWebSocket();
      }
    }, delay);
  }

  // ─── REST Fallback Layer ──────────────────────────────

  _startFallbackPolling() {
    if (this._fallbackIntervalId) return;

    this._fetchRestPrice();

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

  _startWsRetryInterval() {
    this._stopWsRetryInterval();
    this._wsRetryIntervalId = setInterval(() => {
      if (this._isRunning && this._isLeader && this._connectionState === ConnectionState.FALLBACK) {
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

  async _fetchRestPrice() {
    const fetched = await this._tryGoldApi();
    if (!fetched) {
      await this._tryCoinGecko();
    }
    // If leader and fetched from REST, broadcast to followers too
    if (this._isLeader && this._price !== null) {
      this._broadcastTick();
    }
  }

  async _tryGoldApi() {
    try {
      const res = await fetch('https://api.gold-api.com/price/XAU');
      if (!res.ok) return false;
      const data = await res.json();
      if (data && typeof data.price === 'number') {
        const newPrice = parseFloat(data.price.toFixed(2));

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
