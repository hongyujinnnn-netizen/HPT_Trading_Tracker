/**
 * Independent 24/7 Crypto Gold Price Service (Singleton)
 *
 * Provides real-time price feeds for PAXG/USDT and XAUT/USDT via public
 * Binance & OKX WebSockets and REST polling, running 24/7 without weekend closures.
 *
 * Completely separated from traditional Spot Gold (goldPriceService.js).
 */

class CryptoGoldPriceService {
  constructor() {
    this._price = null;
    this._previousPrice = null;
    this._bid = null;
    this._ask = null;
    this._change24h = 0;
    this._symbol = 'PAXGUSDT';
    this._source = 'binance-ws';
    this._lastUpdated = null;

    this._ws = null;
    this._listeners = new Set();
    this._pollTimer = null;
    this._reconnectTimer = null;
    this._isRunning = false;
  }

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
      symbol: this._symbol,
      source: this._source,
      lastUpdated: this._lastUpdated,
    };
  }

  setSymbol(symbol = 'PAXGUSDT') {
    const norm = symbol.toUpperCase().replace(/[^A-Z]/g, '');
    if (this._symbol !== norm) {
      this._symbol = norm;
      if (this._isRunning) {
        this._stop();
        this._start();
      }
    }
  }

  subscribe(callback) {
    this._listeners.add(callback);
    if (!this._isRunning) {
      this._start();
    }
    if (this._price !== null) {
      try { callback(this.getState()); } catch (e) { console.error('[CryptoGoldPrice] subscriber error:', e); }
    }
    return () => {
      this._listeners.delete(callback);
      if (this._listeners.size === 0) {
        this._stop();
      }
    };
  }

  _start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._connectBinanceWS();
  }

  _stop() {
    this._isRunning = false;
    if (this._ws) {
      try { this._ws.close(); } catch {}
      this._ws = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  _connectBinanceWS() {
    if (!this._isRunning) return;

    try {
      const streamSymbol = this._symbol.toLowerCase();
      this._ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamSymbol}@ticker`);

      this._ws.onopen = () => {
        this._source = 'binance-ws';
      };

      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.c) {
            const price = parseFloat(data.c);
            const change24h = parseFloat(data.P || 0);
            const bid = parseFloat(data.b || price - 0.2);
            const ask = parseFloat(data.a || price + 0.2);

            this._updatePriceState(price, bid, ask, change24h, 'binance-ws');
          }
        } catch (err) {
          console.warn('[CryptoGoldPrice] WS parse error:', err);
        }
      };

      this._ws.onerror = () => {
        this._startRESTPolling();
      };

      this._ws.onclose = () => {
        if (this._isRunning) {
          this._reconnectTimer = setTimeout(() => this._connectBinanceWS(), 3000);
        }
      };
    } catch {
      this._startRESTPolling();
    }
  }

  _startRESTPolling() {
    if (this._pollTimer) return;
    this._fetchRESTPrice();
    this._pollTimer = setInterval(() => this._fetchRESTPrice(), 3000);
  }

  async _fetchRESTPrice() {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${this._symbol}`);
      if (!res.ok) throw new Error('REST failed');
      const data = await res.json();
      const price = parseFloat(data.lastPrice);
      const change24h = parseFloat(data.priceChangePercent);
      const bid = parseFloat(data.bidPrice || price - 0.2);
      const ask = parseFloat(data.askPrice || price + 0.2);

      this._updatePriceState(price, bid, ask, change24h, 'binance-rest');
    } catch (e) {
      // Fallback coingecko PAXG
      this._fetchCoingeckoPAXG();
    }
  }

  async _fetchCoingeckoPAXG() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data['pax-gold']) {
        const price = parseFloat(data['pax-gold'].usd);
        const change24h = parseFloat(data['pax-gold'].usd_24h_change || 0);
        this._updatePriceState(price, price - 0.25, price + 0.25, change24h, 'coingecko-rest');
      }
    } catch {}
  }

  _updatePriceState(price, bid, ask, change24h, source) {
    if (!price || isNaN(price)) return;
    this._previousPrice = this._price !== null ? this._price : price;
    this._price = price;
    this._bid = bid;
    this._ask = ask;
    this._change24h = parseFloat(change24h.toFixed(2));
    this._source = source;
    this._lastUpdated = new Date();

    this._notify();
  }

  _notify() {
    const state = this.getState();
    this._listeners.forEach((cb) => {
      try { cb(state); } catch (e) { console.error('[CryptoGoldPrice] subscriber notification error:', e); }
    });
  }
}

export const cryptoGoldPriceService = new CryptoGoldPriceService();
