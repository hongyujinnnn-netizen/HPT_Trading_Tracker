import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { playNotificationSound } from '../utils/audioAlert';
import { getPushPermission, requestPushPermission, sendPushNotification } from '../utils/pushNotification';
import { calculateRollingWinRate, calculateUnderwaterDrawdown } from '../utils/edgeAnalytics';
import {
  calculatePlanProgress,
  generateMilestones,
  calculateNextTradeSize,
  simulatePlanProjection,
  calculateDailyRiskStatus,
} from '../utils/planCalculations';
import { createTargetPlan, PLAN_PRESETS } from '../types/planSchema';

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

  // Pending Orders & Live Market state
  const [pendingOrders, setPendingOrders] = useState([]);
  const [liveGoldPrice, setLiveGoldPrice] = useState(null);
  const [goldConnectionState, setGoldConnectionState] = useState('offline');
  const [orderToasts, setOrderToasts] = useState([]);

  // Target Plans state
  const [targetPlans, setTargetPlans] = useState([]);
  const [activePlanId, setActivePlanIdState] = useState(() => tradeStore.getActivePlanId());

  // Persistent Notification System State
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('tradepulse_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('tradepulse_notification_sound');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [pushPermission, setPushPermission] = useState(() => getPushPermission());

  // ─── Theme Engine (Dark / Light / System) ───────────────────────────────────
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('tradepulse_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const applyTheme = useCallback((resolvedTheme) => {
    if (resolvedTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, []);

  useEffect(() => {
    let mediaQuery = null;
    let handler = null;

    if (theme === 'system') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      handler = (e) => applyTheme(e.matches ? 'dark' : 'light');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handler);
    } else {
      applyTheme(theme);
    }

    return () => {
      if (mediaQuery && handler) {
        mediaQuery.removeEventListener('change', handler);
      }
    };
  }, [theme, applyTheme]);

  const setTheme = useCallback((value) => {
    setThemeState(value);
    try {
      localStorage.setItem('tradepulse_theme', value);
    } catch (e) {
      console.warn('Failed to persist theme', e);
    }
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem('tradepulse_notifications', JSON.stringify(notifications.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save notifications to localStorage', e);
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem('tradepulse_notification_sound', JSON.stringify(isSoundEnabled));
    } catch (e) {
      console.warn('Failed to save notification sound setting', e);
    }
  }, [isSoundEnabled]);

  const addToast = useCallback((type, message, title = '') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setOrderToasts((prev) => [...prev, { id, type, message, title, timestamp: new Date() }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setOrderToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const sendNotification = useCallback(({ type = 'default', title, message, priority = 'normal' }) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newNotif = {
      id,
      type,
      title: title || 'Notification',
      message: message || '',
      timestamp: new Date().toISOString(),
      isRead: false,
      priority,
    };

    setNotifications((prev) => [newNotif, ...prev]);

    // Show visual toast notification
    addToast(type, message, title);

    // Audio chime
    if (isSoundEnabled) {
      playNotificationSound(type);
    }

    // Native browser desktop push notification
    if (pushPermission === 'granted') {
      sendPushNotification(title || 'TradePulse Alert', {
        body: message,
        tag: `notif_${type}`,
      });
    }
  }, [isSoundEnabled, pushPermission, addToast]);

  const markNotificationAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem('tradepulse_notifications');
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toggleNotificationSound = useCallback(() => {
    setIsSoundEnabled((prev) => !prev);
  }, []);

  const enablePushNotifications = useCallback(async () => {
    const permission = await requestPushPermission();
    setPushPermission(permission);
    if (permission === 'granted') {
      sendNotification({
        type: 'alert',
        title: 'Push Notifications Enabled',
        message: 'You will now receive desktop notifications for price alerts, risk limits, and circuit breaker trips.',
      });
    }
    return permission;
  }, [sendNotification]);

  // Trade Entry Draft (allows RiskCalculator, Chart, etc. to pre-fill AddTrade)
  const [tradeDraft, setTradeDraft] = useState(null);

  // Price Alerts state
  const [priceAlerts, setPriceAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('tradepulse_price_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync price alerts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tradepulse_price_alerts', JSON.stringify(priceAlerts));
    } catch (e) {
      console.warn('Failed to save price alerts to localStorage', e);
    }
  }, [priceAlerts]);

  const addPriceAlert = useCallback((targetPrice, direction = 'above', label = '') => {
    const newAlert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      price: parseFloat(targetPrice),
      direction, // 'above' | 'below'
      label: label || `XAU/USD ${direction === 'above' ? '≥' : '≤'} $${parseFloat(targetPrice).toFixed(2)}`,
      isTriggered: false,
      createdAt: new Date().toISOString(),
    };
    setPriceAlerts((prev) => [newAlert, ...prev]);
    return newAlert;
  }, []);

  const deletePriceAlert = useCallback((id) => {
    setPriceAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const togglePriceAlert = useCallback((id) => {
    setPriceAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isTriggered: !a.isTriggered } : a))
    );
  }, []);

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

    // Load Target Plans (from Supabase if authenticated, else local fallback)
    try {
      const loadedPlans = await tradeRepository.getTargetPlans();
      setTargetPlans(loadedPlans || []);
      const savedPlanId = tradeStore.getActivePlanId();
      if (savedPlanId && loadedPlans && loadedPlans.some((p) => p.id === savedPlanId)) {
        setActivePlanIdState(savedPlanId);
      } else if (loadedPlans && loadedPlans.length > 0) {
        setActivePlanIdState(loadedPlans[0].id);
        tradeStore.setActivePlanId(loadedPlans[0].id);
      }
    } catch (e) {
      console.error('Failed to load target plans:', e);
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

        // Check active price alerts against current tick
        setPriceAlerts((prevAlerts) => {
          let updated = false;
          const nextAlerts = prevAlerts.map((alert) => {
            if (alert.isTriggered) return alert;

            const isHit =
              (alert.direction === 'above' && state.price >= alert.price) ||
              (alert.direction === 'below' && state.price <= alert.price);

            if (isHit) {
              updated = true;
              sendNotification({
                type: 'alert',
                title: 'Price Alert Triggered',
                message: `XAU/USD ${alert.direction === 'above' ? 'hit/surpassed' : 'dropped to'} $${state.price.toFixed(2)} (Target: $${alert.price.toFixed(2)})`,
              });
              return { ...alert, isTriggered: true, triggeredAt: new Date().toISOString() };
            }
            return alert;
          });

          return updated ? nextAlerts : prevAlerts;
        });
      }
      if (state.connectionState) {
        setGoldConnectionState(state.connectionState);
      }
    });

    return () => unsubPrice();
  }, [sendNotification]);

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
        sendNotification({
          type: 'triggered',
          title: 'Order Triggered',
          message: `${order.order_type.replace(/_/g, ' ').toUpperCase()} @ $${parseFloat(order.entry_price).toFixed(2)} triggered at $${triggeredPrice.toFixed(2)}`,
        });
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

        sendNotification({
          type: 'closed_tp',
          title: 'Take Profit Hit',
          message: `${side} closed at Take Profit — +$${pnl.toFixed(2)}`,
        });

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

        sendNotification({
          type: 'closed_sl',
          title: 'Stop Loss Hit',
          message: `${side} closed at Stop Loss — -$${Math.abs(pnl).toFixed(2)}`,
        });

        await refreshOrders();
        await refreshData();
      };

      orderEngine.onOrderExpired = async (order) => {
        await tradeRepository.updateOrderStatus(order.id, {
          status: 'expired',
          closed_at: new Date().toISOString(),
        });
        sendNotification({
          type: 'expired',
          title: 'Order Expired',
          message: `${order.order_type.replace(/_/g, ' ').toUpperCase()} @ $${parseFloat(order.entry_price).toFixed(2)} expired`,
        });
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
          sendNotification({
            type: 'circuit_breaker',
            title: '🚨 Stop-Out Liquidated',
            message: `Liquidated ${stoppedOutOrders.length} orders for ${acc.name} (Balance reached $0.00).`,
          });
        }
      }
    });
  }, [tradingAccounts, trades, pendingOrders, cancelPendingOrder, sendNotification]);

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

  // Automated Institutional Risk & Edge Degradation Monitoring
  const lastAlertsRef = useRef({ drawdownTripped: false, rollingAlertTripped: false });
  useEffect(() => {
    if (!trades || trades.length < 5) return;
    const initialBal = accountBaseBalance || 10000;
    const dd = calculateUnderwaterDrawdown(trades, initialBal, 10);
    if (dd.circuitBreakerHit && !lastAlertsRef.current.drawdownTripped) {
      lastAlertsRef.current.drawdownTripped = true;
      sendNotification({
        type: 'circuit_breaker',
        title: '🚨 Drawdown Circuit Breaker Hit',
        message: `Drawdown has reached -${dd.currentDrawdownPct}%, breaching your hard -10% preservation limit.`,
      });
    } else if (!dd.circuitBreakerHit) {
      lastAlertsRef.current.drawdownTripped = false;
    }

    const rolling = calculateRollingWinRate(trades, 20, 50);
    if (rolling.hasAlert && !lastAlertsRef.current.rollingAlertTripped) {
      lastAlertsRef.current.rollingAlertTripped = true;
      sendNotification({
        type: 'edge_alert',
        title: '📉 Edge Degradation Alert',
        message: `Rolling 20-trade win rate has dropped to ${rolling.currentRollingWinRate}%, falling below your 50% baseline. Review recent trade management.`,
      });
    } else if (!rolling.hasAlert) {
      lastAlertsRef.current.rollingAlertTripped = false;
    }
  }, [trades, accountBaseBalance, sendNotification]);

  // Target Plan CRUD operations
  const createPlan = useCallback(async (planData) => {
    const newPlan = await tradeRepository.addTargetPlan(planData);
    setTargetPlans((prev) => [newPlan, ...prev.filter((p) => p.id !== newPlan.id)]);
    setActivePlanIdState(newPlan.id);
    tradeStore.setActivePlanId(newPlan.id);
    addToast('success', `Created target plan "${newPlan.name}"`, 'Plan Created');
    return newPlan;
  }, [addToast]);

  const updatePlan = useCallback(async (id, updates) => {
    const updated = await tradeRepository.updateTargetPlan(id, updates);
    if (updated) {
      setTargetPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      addToast('success', `Updated target plan "${updated.name}"`, 'Plan Updated');
    }
    return updated;
  }, [addToast]);

  const deletePlan = useCallback(async (id) => {
    const remaining = await tradeRepository.deleteTargetPlan(id);
    setTargetPlans(remaining);
    if (activePlanId === id) {
      const nextId = remaining[0]?.id || null;
      setActivePlanIdState(nextId);
      tradeStore.setActivePlanId(nextId);
    }
    addToast('neutral', 'Target plan removed', 'Plan Deleted');
    return remaining;
  }, [activePlanId, addToast]);

  const setActivePlanId = useCallback((id) => {
    setActivePlanIdState(id);
    tradeStore.setActivePlanId(id);
  }, []);

  const resetPlan = useCallback(async (id) => {
    const plan = targetPlans.find((p) => p.id === id);
    if (plan) {
      const updated = await updatePlan(id, { status: 'active' });
      addToast('info', `Reset plan "${plan.name}" to Active`, 'Plan Reset');
      return updated;
    }
  }, [targetPlans, updatePlan, addToast]);

  // Active Target Plan and live progress calculation
  const activePlan = useMemo(() => {
    if (!targetPlans || targetPlans.length === 0) return null;
    return targetPlans.find((p) => p.id === activePlanId) || targetPlans[0];
  }, [targetPlans, activePlanId]);

  const activePlanMetrics = useMemo(() => {
    if (!activePlan) return null;

    // Filter trades relevant to this plan's account
    const relevantTrades = (activePlan.accountId === 'all' || !activePlan.accountId)
      ? trades
      : trades.filter((t) => !t.accountId || t.accountId === activePlan.accountId);

    // Calculate realized PnL of these trades
    const realizedPnl = Math.round(relevantTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0) * 100) / 100;
    const currentEquity = Math.round((activePlan.startingBalance + realizedPnl) * 100) / 100;

    const progress = calculatePlanProgress(activePlan, currentEquity);
    const milestones = generateMilestones(activePlan, currentEquity, settings.contractSize || 100);
    const nextTradeSize = calculateNextTradeSize(activePlan, currentEquity, 2.0, settings.contractSize || 100);
    const dailyRisk = calculateDailyRiskStatus(relevantTrades, activePlan);
    const projection = simulatePlanProjection(activePlan, relevantTrades, 25, stats.winRate || 50);

    return {
      ...progress,
      realizedPnl,
      currentEquity,
      milestones,
      nextTradeSize,
      dailyRisk,
      projection,
      relevantTrades,
    };
  }, [activePlan, trades, settings.contractSize, stats.winRate]);

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
        // Trade Draft & Bridge
        tradeDraft,
        setTradeDraft,
        // Notification Center & Alerts
        notifications,
        sendNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        removeNotification,
        isSoundEnabled,
        toggleNotificationSound,
        pushPermission,
        enablePushNotifications,
        // Theme
        theme,
        setTheme,
        // Price Alerts
        priceAlerts,
        addPriceAlert,
        deletePriceAlert,
        togglePriceAlert,
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
        // Target Plans & Account Growth Planner
        targetPlans,
        activePlan,
        activePlanId,
        activePlanMetrics,
        setActivePlanId,
        createTargetPlan: createPlan,
        updateTargetPlan: updatePlan,
        deleteTargetPlan: deletePlan,
        resetTargetPlan: resetPlan,
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
