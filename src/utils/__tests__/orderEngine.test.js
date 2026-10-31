import { describe, it, expect, beforeEach, vi } from 'vitest';
import { orderEngine } from '../../services/orderEngine';
import { calculateAccountBalances, calculatePerformanceStats } from '../calculations';

describe('OrderEngine & Sub-Account Balance Integrity', () => {
  beforeEach(() => {
    orderEngine.stop();
    orderEngine._orders = [];
    orderEngine._processedIds.clear();
    orderEngine.onOrderTriggered = null;
    orderEngine.onOrderClosedTP = null;
    orderEngine.onOrderClosedSL = null;
    orderEngine.onOrderExpired = null;
  });

  describe('Pending Order Trigger Conditions', () => {
    it('triggers buy_stop when price >= entry_price', () => {
      const triggered = vi.fn();
      orderEngine.onOrderTriggered = triggered;
      orderEngine.updateOrders([
        { id: 'o1', order_type: 'buy_stop', entry_price: 2650, stop_loss: 2640, take_profit: 2670, status: 'pending' },
      ]);

      orderEngine._onPriceTick(2649.5);
      expect(triggered).not.toHaveBeenCalled();

      orderEngine._onPriceTick(2650.0);
      expect(triggered).toHaveBeenCalledTimes(1);
      expect(triggered).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }), 2650.0);
    });

    it('triggers sell_stop when price <= entry_price', () => {
      const triggered = vi.fn();
      orderEngine.onOrderTriggered = triggered;
      orderEngine.updateOrders([
        { id: 'o2', order_type: 'sell_stop', entry_price: 2620, stop_loss: 2630, take_profit: 2600, status: 'pending' },
      ]);

      orderEngine._onPriceTick(2621);
      expect(triggered).not.toHaveBeenCalled();

      orderEngine._onPriceTick(2619.8);
      expect(triggered).toHaveBeenCalledTimes(1);
    });

    it('triggers buy_limit when price <= entry_price and sell_limit when price >= entry_price', () => {
      const triggered = vi.fn();
      orderEngine.onOrderTriggered = triggered;
      orderEngine.updateOrders([
        { id: 'o3', order_type: 'buy_limit', entry_price: 2600, stop_loss: 2590, take_profit: 2625, status: 'pending' },
        { id: 'o4', order_type: 'sell_limit', entry_price: 2680, stop_loss: 2690, take_profit: 2655, status: 'pending' },
      ]);

      orderEngine._onPriceTick(2600);
      expect(triggered).toHaveBeenCalledWith(expect.objectContaining({ id: 'o3' }), 2600);

      orderEngine._onPriceTick(2680.5);
      expect(triggered).toHaveBeenCalledWith(expect.objectContaining({ id: 'o4' }), 2680.5);
    });

    it('prevents duplicate execution across consecutive price ticks', () => {
      const triggered = vi.fn();
      orderEngine.onOrderTriggered = triggered;
      orderEngine.updateOrders([
        { id: 'o5', order_type: 'buy_stop', entry_price: 2650, stop_loss: 2640, take_profit: 2670, status: 'pending' },
      ]);

      orderEngine._onPriceTick(2651);
      orderEngine._onPriceTick(2652);
      orderEngine._onPriceTick(2653);
      expect(triggered).toHaveBeenCalledTimes(1);
    });

    it('expires pending orders whose expires_at is in the past without triggering them', () => {
      const expired = vi.fn();
      const triggered = vi.fn();
      orderEngine.onOrderExpired = expired;
      orderEngine.onOrderTriggered = triggered;

      orderEngine.updateOrders([
        {
          id: 'o6',
          order_type: 'buy_stop',
          entry_price: 2650,
          stop_loss: 2640,
          take_profit: 2670,
          status: 'pending',
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ]);

      orderEngine._onPriceTick(2660);
      expect(expired).toHaveBeenCalledTimes(1);
      expect(triggered).not.toHaveBeenCalled();
    });
  });

  describe('Active Order TP & SL Execution', () => {
    it('closes active buy order at TP or SL accurately', () => {
      const closedTP = vi.fn();
      const closedSL = vi.fn();
      orderEngine.onOrderClosedTP = closedTP;
      orderEngine.onOrderClosedSL = closedSL;

      orderEngine.updateOrders([
        { id: 'b1', order_type: 'buy_limit', entry_price: 2600, stop_loss: 2590, take_profit: 2620, status: 'active' },
        { id: 'b2', order_type: 'buy_stop', entry_price: 2600, stop_loss: 2590, take_profit: 2620, status: 'active' },
      ]);

      orderEngine._onPriceTick(2620.5);
      expect(closedTP).toHaveBeenCalledTimes(2);
      expect(closedSL).not.toHaveBeenCalled();
    });

    it('closes active sell order at TP (price <= TP) or SL (price >= SL)', () => {
      const closedTP = vi.fn();
      const closedSL = vi.fn();
      orderEngine.onOrderClosedTP = closedTP;
      orderEngine.onOrderClosedSL = closedSL;

      orderEngine.updateOrders([
        { id: 's1', order_type: 'sell_limit', entry_price: 2650, stop_loss: 2660, take_profit: 2630, status: 'active' },
      ]);

      orderEngine._onPriceTick(2661);
      expect(closedSL).toHaveBeenCalledTimes(1);
      expect(closedTP).not.toHaveBeenCalled();
    });
  });

  describe('Sub-Account Equity & Planned R:R Calculation', () => {
    it('computes sub-account currentBalance = initialBalance + realizedPnl without mutating initialBalance', () => {
      const accounts = [
        { id: 'acc_1', name: 'FTMO Challenge', initialBalance: 10000 },
        { id: 'acc_2', name: 'Personal Live', initialBalance: 5000 },
      ];
      const trades = [
        { id: 1, accountId: 'acc_1', pnl: 450, status: 'closed' },
        { id: 2, accountId: 'acc_1', pnl: -150, status: 'closed' },
        { id: 3, accountId: 'acc_2', pnl: -200, status: 'closed' },
      ];

      const balances = calculateAccountBalances(accounts, trades);
      expect(balances.acc_1.initialBalance).toBe(10000);
      expect(balances.acc_1.realizedPnl).toBe(300);
      expect(balances.acc_1.currentBalance).toBe(10300);

      expect(balances.acc_2.initialBalance).toBe(5000);
      expect(balances.acc_2.realizedPnl).toBe(-200);
      expect(balances.acc_2.currentBalance).toBe(4800);
    });

    it('keeps avgRR positive for planned setups while tracking signed avgRealizedR', () => {
      const trades = [
        { id: 1, pnl: 200, rr: 2.0 },
        { id: 2, pnl: -100, rr: 2.0 },
      ];
      const stats = calculatePerformanceStats(trades, 10000);
      expect(stats.avgRR).toBe(2.0);
      expect(stats.avgRealizedR).toBe(0.5); // (+2R - 1R) / 2 = +0.5R
    });
  });
});
