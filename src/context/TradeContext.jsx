import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { tradeRepository } from '../services/tradeRepository';
import { tradeStore } from '../services/tradeStore';
import { imageStore } from '../services/imageStore';
import { INITIAL_TRADES } from '../utils/mockData';
import { detectMistakes } from '../utils/mistakeDetector';
import { calculatePerformanceStats } from '../utils/calculations';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

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
        }

        await refreshData();
      });

      return () => subscription.unsubscribe();
    }
  }, [refreshData]);

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
