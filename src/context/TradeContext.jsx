import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tradeRepository } from '../services/tradeRepository';
import { tradeStore } from '../services/tradeStore';
import { imageStore } from '../services/imageStore';
import { INITIAL_TRADES } from '../utils/mockData';
import { detectMistakes } from '../utils/mistakeDetector';
import { calculatePerformanceStats } from '../utils/calculations';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { goldPriceService } from '../services/goldPriceService';
import { orderEngine } from '../services/orderEngine';

const TradeContext = createContext(null);

export function TradeProvider({ children }) {
  const [trades, setTrades] = useState([]);
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
  const [orderToasts, setOrderToasts] = useState([]);

  // Refresh trades, settings, and DB views from active repository
  const refreshData = useCallback(async () => {
    setLoading(true);

    if (isDemoMode) {
      setUserSession(null);
      setTrades(INITIAL_TRADES);
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
      // Unauthenticated state: strictly clear data and prevent mock data leakage
      setTrades([]);
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

        // Create the trade record automatically
        const tradeData = {
          side,
          entryPrice: triggerPrice,
          exitPrice: closedPrice,
          stopLoss: parseFloat(order.stop_loss),
          takeProfit: parseFloat(order.take_profit),
          lotSize: parseFloat(order.lot_size),
          strategy: order.strategy || 'Breakout',
          session: order.session || 'London',
          emotion: 'Planned',
          notes: `Auto-executed from pending order (TP hit). ${order.notes || ''}`.trim(),
          timestamp: order.triggered_at || new Date().toISOString(),
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
        addToast('closed_tp', `${side} closed at Take Profit — +$${pnl.toFixed(2)}`);

        await refreshOrders();
        await refreshData();
      };

      orderEngine.onOrderClosedSL = async (order, closedPrice) => {
        const isBuy = order.order_type === 'buy_stop' || order.order_type === 'buy_limit';
        const triggerPrice = parseFloat(order.triggered_price) || parseFloat(order.entry_price);
        const side = isBuy ? 'Buy' : 'Sell';

        const tradeData = {
          side,
          entryPrice: triggerPrice,
          exitPrice: closedPrice,
          stopLoss: parseFloat(order.stop_loss),
          takeProfit: parseFloat(order.take_profit),
          lotSize: parseFloat(order.lot_size),
          strategy: order.strategy || 'Breakout',
          session: order.session || 'London',
          emotion: 'Planned',
          notes: `Auto-executed from pending order (SL hit). ${order.notes || ''}`.trim(),
          timestamp: order.triggered_at || new Date().toISOString(),
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

  // Reset data back to sample seed
  const resetAllData = useCallback(async () => {
    await tradeStore.clearAll();
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
    const result = await tradeRepository.createPendingOrder(orderData);
    if (result) {
      await refreshOrders();
    }
    return result;
  }, [refreshOrders]);

  const cancelPendingOrder = useCallback(async (orderId) => {
    await tradeRepository.cancelOrder(orderId);
    await refreshOrders();
  }, [refreshOrders]);

  // Merge client-side calculations with database view stats if present
  const calculatedStats = calculatePerformanceStats(trades, settings.accountBalance);

  const stats = dbViews && dbViews.stats ? {
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
        liveGoldPrice,
        orderToasts,
        createPendingOrder,
        cancelPendingOrder,
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
