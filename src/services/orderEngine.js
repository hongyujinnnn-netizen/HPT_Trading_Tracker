/**
 * Order Monitoring & Execution Engine
 *
 * Watches live gold price from goldPriceService and automatically:
 * - Triggers pending orders when entry price is hit
 * - Closes active orders when TP or SL is hit
 * - Expires pending orders past their expiry time
 *
 * Trigger Logic:
 *   Buy Stop:   triggers when price >= entry_price
 *   Sell Stop:  triggers when price <= entry_price
 *   Buy Limit:  triggers when price <= entry_price
 *   Sell Limit: triggers when price >= entry_price
 *
 *   Active Buy:  TP when price >= take_profit, SL when price <= stop_loss
 *   Active Sell: TP when price <= take_profit, SL when price >= stop_loss
 */

import { goldPriceService } from './goldPriceService';

class OrderEngine {
  constructor() {
    this._orders = [];           // Current orders (pending + active)
    this._unsubPrice = null;
    this._isRunning = false;
    this._processedIds = new Set(); // Prevent double-processing

    // Callbacks — set by the consumer (TradeContext)
    this.onOrderTriggered = null;  // (order, triggeredPrice) => void
    this.onOrderClosedTP = null;   // (order, closedPrice) => void
    this.onOrderClosedSL = null;   // (order, closedPrice) => void
    this.onOrderExpired = null;    // (order) => void
  }

  /**
   * Start the engine with initial orders.
   * Subscribes to goldPriceService for price updates.
   */
  start(orders = []) {
    if (this._isRunning) return;
    this._isRunning = true;
    this._orders = [...orders];
    this._processedIds.clear();

    // Tell goldPriceService to poll faster if there are active orders
    const hasActive = orders.some(o => o.status === 'pending' || o.status === 'active');
    goldPriceService.setHasActiveOrders(hasActive);

    // Subscribe to price updates
    this._unsubPrice = goldPriceService.subscribe((state) => {
      if (state.price !== null) {
        this._onPriceTick(state.price);
      }
    });
  }

  /**
   * Stop the engine and unsubscribe from price updates.
   */
  stop() {
    this._isRunning = false;
    if (this._unsubPrice) {
      this._unsubPrice();
      this._unsubPrice = null;
    }
    goldPriceService.setHasActiveOrders(false);
  }

  /**
   * Update the orders list (called when orders change in DB).
   */
  updateOrders(orders) {
    this._orders = [...orders];
    const hasActive = orders.some(o => o.status === 'pending' || o.status === 'active');
    goldPriceService.setHasActiveOrders(hasActive);
  }

  /**
   * Internal: Process a price tick against all orders.
   */
  _onPriceTick(currentPrice) {
    const now = new Date();

    for (const order of this._orders) {
      // Skip already-processed orders (prevents double execution)
      const processKey = `${order.id}_${order.status}`;
      if (this._processedIds.has(processKey)) continue;

      if (order.status === 'pending') {
        // Check expiry first
        if (order.expires_at && new Date(order.expires_at) <= now) {
          this._processedIds.add(processKey);
          if (this.onOrderExpired) this.onOrderExpired(order);
          continue;
        }

        // Check if entry price is hit
        if (this._shouldTrigger(order, currentPrice)) {
          this._processedIds.add(processKey);
          if (this.onOrderTriggered) this.onOrderTriggered(order, currentPrice);
        }
      } else if (order.status === 'active') {
        // Determine side from order_type
        const isBuy = order.order_type === 'buy_stop' || order.order_type === 'buy_limit';
        const tp = parseFloat(order.take_profit);
        const sl = parseFloat(order.stop_loss);

        if (isBuy) {
          // Buy: TP when price >= TP, SL when price <= SL
          if (currentPrice >= tp) {
            this._processedIds.add(processKey);
            if (this.onOrderClosedTP) this.onOrderClosedTP(order, currentPrice);
          } else if (currentPrice <= sl) {
            this._processedIds.add(processKey);
            if (this.onOrderClosedSL) this.onOrderClosedSL(order, currentPrice);
          }
        } else {
          // Sell: TP when price <= TP, SL when price >= SL
          if (currentPrice <= tp) {
            this._processedIds.add(processKey);
            if (this.onOrderClosedTP) this.onOrderClosedTP(order, currentPrice);
          } else if (currentPrice >= sl) {
            this._processedIds.add(processKey);
            if (this.onOrderClosedSL) this.onOrderClosedSL(order, currentPrice);
          }
        }
      }
    }
  }

  /**
   * Internal: Check if a pending order should trigger based on current price.
   */
  _shouldTrigger(order, currentPrice) {
    const entryPrice = parseFloat(order.entry_price);

    switch (order.order_type) {
      case 'buy_stop':   return currentPrice >= entryPrice;
      case 'sell_stop':  return currentPrice <= entryPrice;
      case 'buy_limit':  return currentPrice <= entryPrice;
      case 'sell_limit': return currentPrice >= entryPrice;
      default: return false;
    }
  }
}

// Export a singleton instance
export const orderEngine = new OrderEngine();
