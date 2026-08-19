import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tradeRepository } from '../services/tradeRepository';
import { tradeStore } from '../services/tradeStore';
import { imageStore } from '../services/imageStore';
import { INITIAL_TRADES, INITIAL_PENDING_ORDERS, INITIAL_ACCOUNTS } from '../utils/mockData';
import { createTradingAccount } from '../types/accountSchema';
import { detectMistakes } from '../utils/mistakeDetector';
import { calculatePerformanceStats } from '../utils/calculations';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { goldPriceService } from '../services/goldPriceService';
import { orderEngine } from '../services/orderEngine';
import { isTradeableSymbol } from '../utils/symbolGuard';

const TradeContext = createContext(null);

export function TradeProvider({ children }) {
  const [trades, setTrades] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [activeAccountId, setActiveAccountIdState] = useState(() => tradeRepository.getActiveAccountId() || 'all');
  const [settings, setSettings] = useState(tradeStore.getSettings());
  const [dbViews, setDbViews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [unmigratedTrades, setUnmigratedTrades] = useState([]);

  const [activePage, setActivePage] = useState('dashboard');
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userSession, setUserSession] = useState(null);

  // Pending Orders state
  const [pendingOrders, setPendingOrders] = useState([]);
  const [liveGoldPrice, setLiveGoldPrice] = useState(null);
  const [goldConnectionState, setGoldConnectionState] = useState('offline');
  const [orderToasts, setOrderToasts] = useState([]);

  const setActiveAccountId = (id) => {
    setActiveAccountIdState(id);
    tradeRepository.setActiveAccountId(id);
  };

  // Refresh trades, accounts, settings, and DB views from active repository
  const refreshData = useCallback(async () => {
    setLoading(true);

    if (isDemoMode) {
      setUserSession(null);
      setTradingAccounts(INITIAL_ACCOUNTS);
      setTrades(INITIAL_TRADES);
      setPendingOrders(INITIAL_PENDING_ORDERS);
      setDbViews(null);
      setLoading(false);
      setAuthLoading(false);
      return;
    }

    const activeSession = supabase ? (await supabase.auth.getSession()).data.session : null;
    setUserSession(activeSession);

    if (activeSession) {
      const loadedSettings = await tradeRepository.getSettings();
      setSettings(loadedSettings);

      const accounts = await tradeRepository.getAccounts();
      setTradingAccounts(accounts || []);

      const storedTrades = await tradeRepository.getAllTrades();
      setTrades(storedTrades || []);

      // Check for unmigrated local storage trades
      const localTrades = await tradeStore.getAllTrades();
      if (localTrades.length > 0) {
        setUnmigratedTrades(localTrades);
      } else {
        setUnmigratedTrades([]);
      }

      // Fetch database views if connected to Supabase
      if (isSupabaseConfigured) {
        const views = await tradeRepository.getDashboardViews();
        setDbViews(views);
      } else {
        setDbViews(null);
      }
    } else {
      // Unauthenticated state fallback to local stored accounts
      const accounts = await tradeStore.getAccounts();
      setTradingAccounts(accounts || []);
      const storedTrades = await tradeStore.getAllTrades();
      setTrades(storedTrades || []);
      setDbViews(null);
      setUnmigratedTrades([]);
    }

    setLoading(false);
    setAuthLoading(false);
  }, [isDemoMode]);

  // Refresh pending orders from Supabase
  const refreshOrders = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const orders = await tradeRepository.getAllOrders();
      setPendingOrders(orders);
      // Update order engine with latest active orders
      const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'active');
      orderEngine.updateOrders(activeOrders);
    } catch (e) {
      console.error('Failed to refresh orders:', e);
    }
  }, []);

  useEffect(() => {
    refreshData();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        setUserSession(session);

        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setUserSession(null);
          setTrades([]);
          setDbViews(null);
          setIsDemoMode(false);
          setIsPasswordRecovery(false);
          setPendingOrders([]);
          orderEngine.stop();
        }

        await refreshData();
      });

      return () => subscription.unsubscribe();
    }
  }, [refreshData]);

  // Gold price subscription — runs independently of auth
  useEffect(() => {
    const unsubPrice = goldPriceService.subscribe((state) => {
      if (state.price !== null) {
        setLiveGoldPrice(state.price);
      }
      if (state.connectionState) {
        setGoldConnectionState(state.connectionState);
      }
    });

    return () => unsubPrice();
  }, []);

  // Order engine lifecycle — start/stop based on auth session
  useEffect(() => {
    if (!userSession || isDemoMode) {
      orderEngine.stop();
      return;
    }

    async function initEngine() {
      const orders = await tradeRepository.getAllOrders();
      setPendingOrders(orders);
      const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'active');

      // ── Callbacks ──────────────────────────────────────
      orderEngine.onOrderTriggered = async (order, triggeredPrice) => {
        await tradeRepository.updateOrderStatus(order.id, {
          status: 'active',
          triggered_at: new Date().toISOString(),
          triggered_price: triggeredPrice,
        });
        addToast('triggered', `${order.order_type.replace(/_/g, ' ').toUpperCase()} @ $${parseFloat(order.entry_price).toFixed(2)} triggered at $${triggeredPrice.toFixed(2)}`);
        await refreshOrders();
      };

      orderEngine.onOrderClosedTP = async (order, closedPrice) => {
        const isBuy = order.order_type === 'buy_stop' || order.order_type === 'buy_limit';
        const triggerPrice = parseFloat(order.triggered_price) || parseFloat(order.entry_price);
        const side = isBuy ? 'Buy' : 'Sell';
        const orderAccountId = order.account_id || order.accountId || null;

        // Create the trade record automatically (linked to sub-account)
        const tradeData = {
          side,
          entryPrice: triggerPrice,
          exitPrice: closedPrice,
          stopLoss: parseFloat(order.stop_loss),
          takeProfit: parseFloat(order.take_profit),
          lotSize: parseFloat(order.lot_size),
          strategy: order.strategy || null,
          session: order.session || null,
          emotion: 'Planned',
          notes: `Auto-executed from pending order (TP hit). ${order.notes || ''}`.trim(),
          timestamp: order.triggered_at || new Date().toISOString(),
          accountId: orderAccountId,
        };

        const savedTrade = await tradeRepository.addTrade(tradeData);

        await tradeRepository.updateOrderStatus(order.id, {
          status: 'closed_tp',
          closed_at: new Date().toISOString(),
          closed_price: closedPrice,
          resulting_trade_id: savedTrade?.id || null,
        });

        const cs = settings?.contractSize || 100;
        const pnl = isBuy
          ? (closedPrice - triggerPrice) * parseFloat(order.lot_size) * cs
          : (triggerPrice - closedPrice) * parseFloat(order.lot_size) * cs;

        // Update sub-account balance with realized P&L (broker-style)
        if (orderAccountId) {
          const acc = tradingAccounts.find(a => a.id === orderAccountId);
          if (acc) {
            const newBalance = Math.max(0, (parseFloat(acc.initialBalance) || 0) + pnl);
            await tradeRepository.updateAccount(orderAccountId, { initialBalance: newBalance });
            setTradingAccounts(prev => prev.map(a =>
              a.id === orderAccountId ? { ...a, initialBalance: newBalance } : a
            ));
          }
        }

        addToast('closed_tp', `${side} closed at Take Profit — +$${pnl.toFixed(2)}`);

        await refreshOrders();
        await refreshData();
      };

      orderEngine.onOrderClosedSL = async (order, closedPrice) => {
        const isBuy = order.order_type === 'buy_stop' || order.order_type === 'buy_limit';
        const triggerPrice = parseFloat(order.triggered_price) || parseFloat(order.entry_price);
        const side = isBuy ? 'Buy' : 'Sell';
        const orderAccountId = order.account_id || order.accountId || null;

        const tradeData = {
          side,
          entryPrice: triggerPrice,
          exitPrice: closedPrice,
          stopLoss: parseFloat(order.stop_loss),
          takeProfit: parseFloat(order.take_profit),
          lotSize: parseFloat(order.lot_size),
          strategy: order.strategy || null,
          session: order.session || null,
          emotion: 'Planned',
          notes: `Auto-executed from pending order (SL hit). ${order.notes || ''}`.trim(),
          timestamp: order.triggered_at || new Date().toISOString(),
          accountId: orderAccountId,
        };

        const savedTrade = await tradeRepository.addTrade(tradeData);

        await tradeRepository.updateOrderStatus(order.id, {
          status: 'closed_sl',
          closed_at: new Date().toISOString(),
          closed_price: closedPrice,
          resulting_trade_id: savedTrade?.id || null,
        });

        const cs = settings?.contractSize || 100;
        const pnl = isBuy
          ? (closedPrice - triggerPrice) * parseFloat(order.lot_size) * cs
          : (triggerPrice - closedPrice) * parseFloat(order.lot_size) * cs;

        // Update sub-account balance with realized P&L (broker-style)
        if (orderAccountId) {
          const acc = tradingAccounts.find(a => a.id === orderAccountId);
          if (acc) {
            const newBalance = Math.max(0, (parseFloat(acc.initialBalance) || 0) + pnl);
            await tradeRepository.updateAccount(orderAccountId, { initialBalance: newBalance });
            setTradingAccounts(prev => prev.map(a =>
              a.id === orderAccountId ? { ...a, initialBalance: newBalance } : a
            ));
          }
        }

        addToast('closed_sl', `${side} closed at Stop Loss — -$${Math.abs(pnl).toFixed(2)}`);

        await refreshOrders();
        await refreshData();
      };

      orderEngine.onOrderExpired = async (order) => {
        await tradeRepository.updateOrderStatus(order.id, {
          status: 'expired',
          closed_at: new Date().toISOString(),
        });
        addToast('expired', `${order.order_type.replace(/_/g, ' ').toUpperCase()} @ $${parseFloat(order.entry_price).toFixed(2)} expired`);
        await refreshOrders();
      };

      orderEngine.start(activeOrders);
    }

    initEngine();

    return () => {
      orderEngine.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSession, isDemoMode]);

  // Migrate local storage trades to Supabase cloud atomically
  const migrateLocalTrades = useCallback(async () => {
    if (!userSession) return;
    setLoading(true);
    const success = await tradeRepository.migrateLocalTradesToCloud(userSession.user.id);
    if (success) {
      setUnmigratedTrades([]);
      await refreshData();
    }
    setLoading(false);
  }, [userSession, refreshData]);

  const dismissLocalTrades = useCallback(() => {
    setUnmigratedTrades([]);
  }, []);

  // Toggle Demo Mode (signs out active session if present to keep data isolated)
  const toggleDemoMode = useCallback(async () => {
    if (userSession && supabase) {
      await supabase.auth.signOut();
    }
    setIsDemoMode((prev) => !prev);
  }, [userSession]);

  // Sign out cleanly
  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserSession(null);
    setTrades([]);
    setDbViews(null);
    setIsDemoMode(false);
    setIsPasswordRecovery(false);
    setPendingOrders([]);
    orderEngine.stop();
  }, []);

  // Save new trade
  const addTrade = useCallback(async (tradeInput, screenshotDataUrl = null) => {
    if (tradeInput && tradeInput.symbol && !isTradeableSymbol(tradeInput.symbol)) {
      throw new Error(`Symbol '${tradeInput.symbol}' is a 24/7 chart-only proxy. Trade execution & journaling are restricted to Spot Gold (XAUUSD).`);
    }

    if (isDemoMode) {
      const newTrade = {
        ...tradeInput,
        id: `demo_${Date.now()}`,
        ticket: `DEMO${Math.floor(Math.random() * 1000)}`,
        mistakes: [],
      };
      setTrades((prev) => [newTrade, ...prev]);
      return newTrade;
    }

    let imageId = null;
    if (screenshotDataUrl) {
      imageId = `img_${Date.now()}`;
      await imageStore.saveImage(imageId, screenshotDataUrl);
    }

    const mistakes = detectMistakes({ ...tradeInput, imageId }, trades);
    const newTradeData = {
      ...tradeInput,
      imageId,
      mistakes,
    };

    const savedTrade = await tradeRepository.addTrade(newTradeData);
    await refreshData();
    return savedTrade;
  }, [trades, isDemoMode, refreshData]);

  // Delete trade permanently
  const deleteTrade = useCallback(async (id) => {
    if (isDemoMode) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
      return;
    }

    const target = trades.find((t) => t.id === id);
    if (target && target.imageId) {
      await imageStore.deleteImage(target.imageId);
    }
    await tradeRepository.deleteTrade(id);
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, [trades, isDemoMode]);

  // Batch import trades from CSV
  const importTrades = useCallback(async (parsedBatch) => {
    const audited = parsedBatch.map((t) => ({
      ...t,
      mistakes: t.mistakes.length ? t.mistakes : detectMistakes(t, trades),
    }));
    await tradeRepository.importBatch(audited);
    await refreshData();
  }, [trades, refreshData]);

  // Reset data (clear all trades from database and local storage)
  const resetAllData = useCallback(async () => {
    await tradeRepository.clearAllTrades();
    await refreshData();
  }, [refreshData]);

  // Update settings
  const updateSettings = useCallback(async (newSettings) => {
    const updated = await tradeRepository.saveSettings(newSettings);
    setSettings(updated);
    await refreshData();
  }, [refreshData]);

  // ── Pending Order management ─────────────────────────

  const addToast = useCallback((type, message) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setOrderToasts((prev) => [...prev, { id, type, message, timestamp: new Date() }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setOrderToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const createPendingOrder = useCallback(async (orderData) => {
    const targetAccountId = orderData.accountId || (activeAccountId !== 'all' ? activeAccountId : null);
    const result = await tradeRepository.createPendingOrder({
      ...orderData,
      accountId: targetAccountId,
    });
    if (result) {
      await refreshOrders();
      return result;
    }
    // Demo / fallback local creation
    const newOrder = {
      id: `ord_${Date.now()}`,
      account_id: targetAccountId,
      accountId: targetAccountId,
      symbol: 'XAUUSD',
      order_type: orderData.orderType,
      status: 'pending',
      entry_price: parseFloat(orderData.entryPrice),
      stop_loss: parseFloat(orderData.stopLoss),
      take_profit: parseFloat(orderData.takeProfit),
      lot_size: parseFloat(orderData.lotSize) || 0.1,
      strategy: orderData.strategy || null,
      session: orderData.session || null,
      notes: orderData.notes || null,
      created_at: new Date().toISOString(),
      triggered_at: null,
      closed_at: null,
      expires_at: orderData.expiresAt || null,
    };
    setPendingOrders((prev) => [newOrder, ...prev]);
    return newOrder;
  }, [refreshOrders, activeAccountId]);

  const cancelPendingOrder = useCallback(async (orderId) => {
    const res = await tradeRepository.cancelOrder(orderId);
    if (res) {
      await refreshOrders();
      return;
    }
    setPendingOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled', closed_at: new Date().toISOString() }
          : o
      )
    );
  }, [refreshOrders]);

  const deletePendingOrder = useCallback(async (orderId) => {
    const res = await tradeRepository.deletePendingOrder(orderId);
    if (res) {
      await refreshOrders();
      return;
    }
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
  }, [refreshOrders]);

  const clearOrderHistory = useCallback(async () => {
    const res = await tradeRepository.clearOrderHistory();
    if (res) {
      await refreshOrders();
      return;
    }
    setPendingOrders((prev) =>
      prev.filter((o) => ['pending', 'active'].includes(o.status))
    );
  }, [refreshOrders]);

  // Automatic Stop-Out Guard: If a sub-account balance reaches $0, liquidate all pending orders for that account
  useEffect(() => {
    if (!tradingAccounts || tradingAccounts.length === 0) return;

    tradingAccounts.forEach((acc) => {
      const accTrades = trades.filter((t) => t.accountId === acc.id || t.account_id === acc.id);
      const realizedPnlSum = accTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);
      const effectiveBalance = (parseFloat(acc.initialBalance) || 0) + realizedPnlSum;

      if (effectiveBalance <= 0 || acc.initialBalance <= 0) {
        const stoppedOutOrders = pendingOrders.filter(
          (o) => (o.accountId === acc.id || o.account_id === acc.id) && (o.status === 'pending' || o.status === 'active')
        );

        if (stoppedOutOrders.length > 0) {
          console.warn(`🚨 Stop-Out Triggered for sub-account "${acc.name}". Liquidating ${stoppedOutOrders.length} orders.`);
          stoppedOutOrders.forEach((o) => cancelPendingOrder(o.id));
          addToast('sl', `🚨 Stop-Out Triggered: Liquidated ${stoppedOutOrders.length} orders for ${acc.name} (Balance reached $0.00).`);
        }
      }
    });
  }, [tradingAccounts, trades, pendingOrders, cancelPendingOrder, addToast]);

  // Sub-Account CRUD Operations
  const addTradingAccount = async (accountData) => {
    const newAcc = await tradeRepository.addAccount(accountData);
    if (newAcc) {
      setTradingAccounts((prev) => [...prev, newAcc]);
    }
    return newAcc;
  };

  const updateTradingAccount = async (id, updates) => {
    const updated = await tradeRepository.updateAccount(id, updates);
    if (updated) {
      setTradingAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
    return updated;
  };

  const archiveTradingAccount = async (id) => {
    const archived = await tradeRepository.archiveAccount(id);
    if (archived) {
      setTradingAccounts((prev) => prev.map((a) => (a.id === id ? archived : a)));
    }
    return archived;
  };

  // Determine active account object
  const activeAccount = tradingAccounts.find((a) => a.id === activeAccountId) || null;

  // Filter trades and pending orders by active sub-account
  const filteredTrades = activeAccountId === 'all'
    ? trades
    : trades.filter((t) => !t.accountId || t.accountId === activeAccountId);

  const filteredPendingOrders = activeAccountId === 'all'
    ? pendingOrders
    : pendingOrders.filter((o) => !o.accountId || o.accountId === activeAccountId);

  // Compute total base capital
  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);
  const accountBaseBalance = activeAccountId === 'all'
    ? visibleAccounts.reduce((sum, a) => sum + (parseFloat(a.initialBalance) || 0), 0) || settings.accountBalance
    : activeAccount ? (parseFloat(activeAccount.initialBalance) || 10000) : settings.accountBalance;

  // Merge client-side calculations over filtered trades with accurate base balance
  const calculatedStats = calculatePerformanceStats(filteredTrades, accountBaseBalance);

  const stats = (activeAccountId === 'all' && dbViews && dbViews.stats) ? {
    ...calculatedStats,
    totalPnl: parseFloat(dbViews.stats.total_pnl) || calculatedStats.totalPnl,
    winRate: parseFloat(dbViews.stats.win_rate_pct) || calculatedStats.winRate,
    avgRR: parseFloat(dbViews.stats.avg_rr_ratio) || calculatedStats.avgRR,
    closedTrades: dbViews.stats.closed_trades || calculatedStats.totalTrades,
  } : calculatedStats;

  return (
    <TradeContext.Provider
      value={{
        trades,
        filteredTrades,
        tradingAccounts,
        activeAccountId,
        setActiveAccountId,
        activeAccount,
        addTradingAccount,
        updateTradingAccount,
        archiveTradingAccount,
        settings,
        stats,
        dbViews,
        loading,
        authLoading,
        isPasswordRecovery,
        setIsPasswordRecovery,
        isDemoMode,
        toggleDemoMode,
        unmigratedTrades,
        migrateLocalTrades,
        dismissLocalTrades,
        activePage,
        setActivePage,
        selectedTrade,
        setSelectedTrade,
        isImportModalOpen,
        setIsImportModalOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        userSession,
        isCloudActive: isSupabaseConfigured && Boolean(userSession),
        signOut,
        addTrade,
        deleteTrade,
        importTrades,
        resetAllData,
        updateSettings,
        refreshData,
        // Pending Orders
        pendingOrders,
        filteredPendingOrders,
        liveGoldPrice,
        goldConnectionState,
        orderToasts,
        createPendingOrder,
        cancelPendingOrder,
        deletePendingOrder,
        clearOrderHistory,
        dismissToast,
        refreshOrders,
      }}
    >
      {children}
    </TradeContext.Provider>
  );
}

export function useTrade() {
  const context = useContext(TradeContext);
  if (!context) {
    throw new Error('useTrade must be used within a TradeProvider');
  }
  return context;
}
