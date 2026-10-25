import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  AlertTriangle,
  ChevronRight,
  Activity,
  CandlestickChart,
  LayoutDashboard,
  Coffee,
  Upload,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useTrade } from '../context/TradeContext';
import { StatCard } from '../components/StatCard';
import { SectionLabel } from '../components/SectionLabel';
import { Pill } from '../components/Pill';
import { DailyPnLCalendar } from '../components/DailyPnLCalendar';
import { WinLossSplit } from '../components/WinLossSplit';
import { RollingWinRateChart } from '../components/RollingWinRateChart';
import { RMultipleHistogram } from '../components/RMultipleHistogram';
import { UnderwaterDrawdownChart } from '../components/UnderwaterDrawdownChart';
import { EdgeAlertBanner } from '../components/EdgeAlertBanner';
import { PlanTargetWidget } from '../components/PlanTargetWidget';
import { INITIAL_EQUITY_CURVE } from '../utils/mockData';
import { getCurrentGoldSession } from '../utils/sessionDetector';
import { calculateExpectancy } from '../utils/edgeAnalytics';
import { STANDARD_STRATEGIES, TRADING_SESSIONS } from '../utils/tradingConstants';

export function Dashboard() {
  const {
    trades,
    filteredTrades,
    stats,
    setActivePage,
    setSelectedTrade,
    setIsImportModalOpen,
    userSession,
    dbViews,
    settings,
    isDemoMode,
    activeAccountId,
    activeAccount,
    tradingAccounts,
  } = useTrade();

  const [timeRange, setTimeRange] = useState('30D');
  const [chartMode, setChartMode] = useState('equity'); // 'equity' | 'underwater'
  const [layoutMode, setLayoutMode] = useState(() => {
    return localStorage.getItem('tradepulse_dashboard_layout') || 'overview';
  });

  const [sessionInfo, setSessionInfo] = useState(() => {
    const savedMode = localStorage.getItem('tradepulse_gold_chart_mode') || 'oanda';
    return getCurrentGoldSession(new Date(), savedMode);
  });

  const handleLayoutChange = (mode) => {
    setLayoutMode(mode);
    localStorage.setItem('tradepulse_dashboard_layout', mode);
  };

  const displayTrades = filteredTrades || trades;

  // Expectancy calculation
  const expectancyData = useMemo(() => {
    return calculateExpectancy(displayTrades);
  }, [displayTrades]);

  // Current session slot key for blocked-slot alert check
  const currentSlotKey = useMemo(() => {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const utcHour = now.getUTCHours();
    return `${dayName}_${utcHour}`;
  }, []);

  // Dynamic Equity Curve & Underwater calculation
  const { equityCurveData, underwaterCurveData } = useMemo(() => {
    let rawPoints = [];
    const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);
    const startBalance =
      activeAccountId === 'all'
        ? visibleAccounts.reduce((sum, a) => sum + (parseFloat(a.initialBalance) || 0), 0) || settings?.accountBalance || 10000
        : activeAccount ? (parseFloat(activeAccount.initialBalance) || 10000) : (settings?.accountBalance || 10000);

    if (activeAccountId === 'all' && dbViews?.equityCurve && dbViews.equityCurve.length > 0) {
      let peak = startBalance;
      rawPoints = dbViews.equityCurve.map((item) => {
        const dateObj = new Date(item.exit_time || item.timestamp);
        const formattedDate = isNaN(dateObj.getTime())
          ? (item.exit_time || '')
          : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const val = Math.round(parseFloat(item.running_balance) || 0);
        if (val > peak) peak = val;
        const ddPct = peak > 0 ? ((peak - val) / peak) * 100 : 0;
        return {
          d: formattedDate,
          v: val,
          peak,
          drawdownPct: -Math.round(ddPct * 10) / 10,
          timestamp: dateObj.getTime() || 0,
        };
      });
    } else if (displayTrades && displayTrades.length > 0) {
      const sortedTrades = [...displayTrades]
        .filter((t) => t.status === 'closed' || t.pnl !== undefined)
        .sort((a, b) => new Date(a.exitTime || a.timestamp || a.date) - new Date(b.exitTime || b.timestamp || b.date));

      if (sortedTrades.length > 0) {
        let running = startBalance;
        let peak = startBalance;
        const points = [{ d: 'Start', v: startBalance, timestamp: 0, peak: startBalance, drawdownPct: 0 }];

        sortedTrades.forEach((t) => {
          running += parseFloat(t.pnl) || 0;
          if (running > peak) peak = running;
          const ddPct = peak > 0 ? ((peak - running) / peak) * 100 : 0;

          const dateObj = new Date(t.exitTime || t.timestamp || t.date || Date.now());
          const formattedDate = isNaN(dateObj.getTime())
            ? 'Trade'
            : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          points.push({
            d: formattedDate,
            v: Math.round(running * 100) / 100,
            peak: Math.round(peak * 100) / 100,
            drawdownPct: -Math.round(ddPct * 10) / 10,
            timestamp: dateObj.getTime() || Date.now(),
          });
        });

        rawPoints = points;
      }
    }

    if (rawPoints.length === 0) {
      if (isDemoMode && !userSession) {
        return { equityCurveData: INITIAL_EQUITY_CURVE, underwaterCurveData: [] };
      }

      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fallback = [
        { d: 'Start', v: startBalance, timestamp: 0, peak: startBalance, drawdownPct: 0 },
        { d: todayStr, v: startBalance, timestamp: Date.now(), peak: startBalance, drawdownPct: 0 },
      ];
      return { equityCurveData: fallback, underwaterCurveData: fallback };
    }

    let filtered = rawPoints;
    if (timeRange !== 'ALL' && rawPoints.length > 1) {
      const days = timeRange === '7D' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const f = rawPoints.filter((p) => p.timestamp >= cutoff || p.timestamp === 0);
      filtered = f.length > 0 ? f : rawPoints;
    }

    return { equityCurveData: filtered, underwaterCurveData: filtered };
  }, [dbViews, displayTrades, settings, isDemoMode, userSession, timeRange, activeAccountId, activeAccount, tradingAccounts]);

  // Real KPI sparklines derived from the user's actual trade history (not hardcoded)
  const kpiSparklines = useMemo(() => {
    const sorted = [...displayTrades]
      .filter((t) => t.pnl !== undefined && t.pnl !== null)
      .sort((a, b) => new Date(a.exitTime || a.timestamp || a.date) - new Date(b.exitTime || b.timestamp || b.date));

    if (sorted.length < 2) {
      return { pnl: null, winRate: null, expectancy: null, rr: null, drawdown: null };
    }

    const tail = sorted.slice(-12);
    let cumPnl = 0;
    let wins = 0;
    const pnlSeries = [];
    const wrSeries = [];
    const expSeries = [];
    const rrSeries = [];

    tail.forEach((t, idx) => {
      const p = Number(t.pnl) || 0;
      cumPnl += p;
      if (p > 0) wins++;
      const count = idx + 1;
      pnlSeries.push(Math.round(cumPnl));
      wrSeries.push(Math.round((wins / count) * 1000) / 10);
      expSeries.push(Math.round((cumPnl / count) * 10) / 10);
      if (t.rr != null && Number.isFinite(Number(t.rr))) {
        rrSeries.push(Number(t.rr));
      }
    });

    const ddSeries = underwaterCurveData.slice(-12).map((p) => p.drawdownPct ?? 0);

    return {
      pnl: pnlSeries,
      winRate: wrSeries,
      expectancy: expSeries,
      rr: rrSeries.length >= 2 ? rrSeries : null,
      drawdown: ddSeries.length >= 2 ? ddSeries : null,
    };
  }, [displayTrades, underwaterCurveData]);

  // Dynamic underwater Y-axis floor so deep drawdowns (> 15%) are never clipped
  const underwaterMinY = useMemo(() => {
    const minVal = underwaterCurveData.reduce((min, p) => Math.min(min, p.drawdownPct || 0), 0);
    return Math.min(-15, Math.floor(minVal - 2));
  }, [underwaterCurveData]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = useMemo(() => {
    if (userSession?.user?.email) {
      return userSession.user.email.split('@')[0];
    }
    return 'Trader';
  }, [userSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      const savedMode = localStorage.getItem('tradepulse_gold_chart_mode') || 'oanda';
      setSessionInfo(getCurrentGoldSession(new Date(), savedMode));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Session breakdown
  const sessionStats = useMemo(() => {
    return TRADING_SESSIONS.map((s) => {
      const sessionTrades = displayTrades.filter((t) => t.session === s.name);
      const wins = sessionTrades.filter((t) => t.pnl > 0).length;
      const pnl = Math.round(sessionTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0) * 100) / 100;
      const winRate = sessionTrades.length > 0 ? Math.round((wins / sessionTrades.length) * 100) : 0;
      return { ...s, tradesCount: sessionTrades.length, winRate, pnl };
    });
  }, [displayTrades]);

  // Dynamic session insight generated from actual sessionStats
  const sessionInsightText = useMemo(() => {
    const active = sessionStats.filter((s) => s.tradesCount > 0);
    if (active.length === 0) {
      return 'Log trades across Asian, London, and New York sessions to unlock your personal session win-rate insight.';
    }
    const best = [...active].sort((a, b) => b.winRate - a.winRate || b.pnl - a.pnl)[0];
    const worst = [...active].sort((a, b) => a.pnl - b.pnl)[0];
    if (worst && worst.name !== best.name && worst.pnl < 0) {
      return `${best.name} session yields your highest win rate (${best.winRate}% over ${best.tradesCount} trades). Tighten risk during ${worst.name} ($${worst.pnl}).`;
    }
    return `${best.name} session leads with a ${best.winRate}% win rate (${best.pnl >= 0 ? '+' : ''}$${best.pnl} across ${best.tradesCount} trades).`;
  }, [sessionStats]);

  // Strategy stats (includes custom strategies logged by the user)
  const strategyStats = useMemo(() => {
    const custom = displayTrades.map((t) => t.strategy).filter(Boolean);
    const allNames = Array.from(new Set([...STANDARD_STRATEGIES.slice(0, 4), ...custom]));
    return allNames.map((name) => {
      const stratTrades = displayTrades.filter((t) => t.strategy === name);
      const wins = stratTrades.filter((t) => t.pnl > 0).length;
      const pnl = Math.round(stratTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0) * 100) / 100;
      const winRate = stratTrades.length > 0 ? Math.round((wins / stratTrades.length) * 100) : 0;
      return { name, pnl, winRate, count: stratTrades.length, fill: pnl >= 0 ? '#3FA88C' : '#C1502E' };
    });
  }, [displayTrades]);

  const maxSessionAbs = Math.max(...sessionStats.map((s) => Math.abs(s.pnl)), 1);

  const renderRecentTradeRow = (t) => {
    const pnlNum = Number(t.pnl) || 0;
    const rrNum = t.rr != null && Number.isFinite(Number(t.rr)) ? Number(t.rr) : null;
    return (
      <div
        key={t.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTrade(t)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedTrade(t);
          }
        }}
        className="flex items-center justify-between gap-2 p-3 rounded-xl border cursor-pointer transition-all hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-[#C9A227] shadow-sm"
        style={{
          background: 'var(--color-elevated)',
          borderColor: 'var(--color-border-soft)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono-num w-20 shrink-0" style={{ color: 'var(--color-text-muted)' }}>{t.date}</span>
          <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'} className="shrink-0">{t.side}</Pill>
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>{t.strategy}</span>
          {t.mistakes && t.mistakes.length > 0 && (
            <span className="text-[11px] hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 truncate max-w-[180px]">
              <AlertTriangle size={11} className="shrink-0" />
              <span className="truncate">{t.mistakes[0]}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono-num text-xs shrink-0">
          <span className="hidden sm:inline" style={{ color: 'var(--color-text-dim)' }}>
            {rrNum !== null ? `1:${rrNum.toFixed(1)} RR` : '—'}
          </span>
          <span
            className="font-bold"
            style={{ color: pnlNum >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}
          >
            {pnlNum >= 0 ? '+' : ''}${pnlNum.toLocaleString()}
          </span>
        </div>
      </div>
    );
  };

  const renderEmptyRecentTrades = () => (
    <div
      className="p-6 rounded-xl border border-dashed text-center space-y-2.5"
      style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-main)' }}>
        No trades logged yet
      </p>
      <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
        Add your first XAU/USD trade or import an MT5 statement to populate your equity curve and mistake detector.
      </p>
      <div className="flex items-center justify-center gap-2 pt-1">
        <button
          onClick={() => setActivePage('add')}
          className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] text-[#080A0D] text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Plus size={13} /> Log First Trade
        </button>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5"
          style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
        >
          <Upload size={13} /> Import MT5
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header with Layout Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold font-display tracking-tight flex items-center gap-2"
            style={{ color: 'var(--color-text-main, #FFFFFF)' }}
          >
            <span className="text-slate-900 dark:text-white" style={{ color: 'var(--color-text-main, #FFFFFF)' }}>
              {greeting},
            </span>
            <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 dark:from-[#EDEAE3] dark:via-[#F3D371] dark:to-[#C9A227] bg-clip-text text-transparent">
              {userName}
            </span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Institutional edge analytics, discipline metrics, and real-time execution tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Saved Layout Mode Selector */}
          <div
            className="flex items-center p-1 rounded-xl border text-xs shadow-inner"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            {[
              { id: 'overview', label: 'Default Overview', icon: LayoutDashboard },
              { id: 'morning', label: 'Morning Review', icon: Coffee },
              { id: 'quant', label: 'Quant Edge', icon: Activity },
            ].map((layout) => {
              const Icon = layout.icon;
              const isSelected = layoutMode === layout.id;
              return (
                <button
                  key={layout.id}
                  onClick={() => handleLayoutChange(layout.id)}
                  aria-label={`Switch to ${layout.label} layout`}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] font-bold shadow-md shadow-[#C9A227]/25'
                      : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F1F3F5]'
                  }`}
                  title={`Switch to ${layout.label} layout`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{layout.label}</span>
                </button>
              );
            })}
          </div>

          {/* Session pill */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono-num shadow-sm"
            style={{
              background: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#3FA88C] animate-pulse" />
            <span style={{ color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text-main)' }}>{sessionInfo.name}</strong> · {sessionInfo.timeLeft}
            </span>
          </div>

          {/* View Live Gold Chart */}
          <button
            onClick={() => setActivePage('chart')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-amber-600 dark:text-[#E5B83B] font-semibold text-xs border border-amber-500/40 transition-colors shadow-sm"
            style={{
              background: 'var(--color-elevated)',
            }}
          >
            <CandlestickChart size={15} /> Gold Chart
          </button>

          {/* + New Trade Button */}
          <button
            onClick={() => setActivePage('add')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-110 text-[#080A0D] font-bold text-xs shadow-lg shadow-[#C9A227]/25 active:scale-95 transition-all"
          >
            <Plus size={15} /> New Trade
          </button>
        </div>
      </div>

      {/* Real-Time Edge & Circuit Breaker Alerts */}
      <EdgeAlertBanner
        trades={displayTrades}
        initialBalance={settings?.accountBalance || 10000}
        circuitBreakerPct={10}
        currentSlotKey={currentSlotKey}
      />

      {/* 5 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <StatCard
          label="Net P&L"
          value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toLocaleString()}`}
          valueColor={stats.totalPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
          delta="Realized balance return"
          deltaType={stats.totalPnl >= 0 ? 'up' : 'down'}
          tone={stats.totalPnl >= 0 ? 'profit' : 'loss'}
          sparklineData={kpiSparklines.pnl}
          sparklineColor={stats.totalPnl >= 0 ? '#3FA88C' : '#C1502E'}
        />

        <StatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          valueColor="#E5B83B"
          delta="Cumulative win rate"
          deltaType="up"
          tone="gold"
          sparklineData={kpiSparklines.winRate}
          sparklineColor="#E5B83B"
        />

        <StatCard
          label="Dollar Expectancy"
          value={`${expectancyData.expectancy >= 0 ? '+' : ''}$${expectancyData.expectancy}`}
          valueColor={expectancyData.expectancy >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'}
          delta={expectancyData.sizingAdvice}
          deltaType={expectancyData.expectancy >= 0 ? 'up' : 'down'}
          tone={expectancyData.expectancy >= 0 ? 'profit' : 'loss'}
          sparklineData={kpiSparklines.expectancy}
          sparklineColor={expectancyData.expectancy >= 0 ? '#3FA88C' : '#C1502E'}
        />

        <StatCard
          label="Avg R : R"
          value={`1 : ${stats.avgRR}`}
          delta="Risk:Reward Ratio"
          deltaType="up"
          tone="profit"
          sparklineData={kpiSparklines.rr}
          sparklineColor="#3FA88C"
        />

        <StatCard
          label="Max Drawdown"
          value={`-${stats.maxDrawdownPct}%`}
          valueColor={stats.maxDrawdownPct > 10 ? 'var(--color-loss)' : undefined}
          delta={stats.maxDrawdownPct > 10 ? 'Circuit Breaker Hit' : 'within 10% limit'}
          deltaType={stats.maxDrawdownPct > 10 ? 'down' : 'neutral'}
          tone={stats.maxDrawdownPct > 10 ? 'loss' : 'neutral'}
          sparklineData={kpiSparklines.drawdown}
          sparklineColor="#C1502E"
        />
      </div>

      {/* =========================================================
          LAYOUT 1: QUANT EDGE (Rolling Win Rate + Drawdown + R-Histogram)
         ========================================================= */}
      {layoutMode === 'quant' && (
        <div className="space-y-6 animate-fade-in">
          <RollingWinRateChart trades={displayTrades} defaultBaseline={50} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UnderwaterDrawdownChart
              trades={displayTrades}
              initialBalance={settings?.accountBalance || 10000}
              circuitBreakerPct={10}
            />
            <RMultipleHistogram trades={displayTrades} />
          </div>
        </div>
      )}

      {/* =========================================================
          LAYOUT 2: MORNING REVIEW (Calendar + Session + Discipline)
         ========================================================= */}
      {layoutMode === 'morning' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DailyPnLCalendar trades={displayTrades} />
            </div>
            {/* Session Timeline */}
            <div className="terminal-card p-5 flex flex-col justify-between">
              <div>
                <SectionLabel right={<span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>24H CYCLE</span>}>
                  Session Performance
                </SectionLabel>

                <div className="space-y-4 mt-3">
                  {sessionStats.map((s) => {
                    const isProf = s.pnl >= 0;
                    const widthPct = Math.max(10, (Math.abs(s.pnl) / maxSessionAbs) * 100);
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold font-display" style={{ color: 'var(--color-text-main)' }}>{s.name}</span>
                            <span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>{s.hours}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono-num">
                            <span style={{ color: 'var(--color-text-muted)' }}>{s.winRate}% win</span>
                            <span style={{ color: isProf ? 'var(--color-profit)' : 'var(--color-loss)' }} className="font-bold min-w-16 text-right">
                              {s.pnl >= 0 ? '+' : ''}${s.pnl}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded overflow-hidden" style={{ background: 'var(--color-elevated)' }}>
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${widthPct}%`, background: isProf ? 'var(--color-profit)' : 'var(--color-loss)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs pt-3 mt-4 border-t leading-relaxed" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}>
                <strong className="text-amber-600 dark:text-[#C9A227]">Preparation Rule:</strong> Verify upcoming high-impact economic news 15 minutes prior to session opens.
              </p>
            </div>
          </div>

          {/* Recent Trades & Discipline Alerts */}
          <div className="terminal-card p-5">
            <SectionLabel right={
              <button onClick={() => setActivePage('mistakes')} className="text-xs text-amber-600 dark:text-[#C9A227] hover:underline flex items-center gap-1">
                Discipline Center <ChevronRight size={12} />
              </button>
            }>
              Recent Trades &amp; Behavioral Audits
            </SectionLabel>

            <div className="space-y-2.5 mt-3">
              {displayTrades.length === 0
                ? renderEmptyRecentTrades()
                : displayTrades.slice(0, 6).map(renderRecentTradeRow)}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          LAYOUT 3: DEFAULT OVERVIEW (Classic with Drawdown Overlay)
         ========================================================= */}
      {layoutMode === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Row 1: Equity Curve / Underwater Overlay (2 cols) & Session (1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Primary Chart with Equity vs Underwater Drawdown Toggle */}
            <div className="lg:col-span-2 terminal-card p-5 space-y-4">
              <SectionLabel
                right={
                  <div className="flex items-center gap-2">
                    {/* Equity vs Underwater Toggle */}
                    <div
                      className="flex gap-1 p-0.5 rounded-lg border transition-colors shadow-inner"
                      style={{
                        background: 'var(--color-elevated)',
                        borderColor: 'var(--color-border-soft)',
                      }}
                    >
                      <button
                        onClick={() => setChartMode('equity')}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-mono-num font-semibold transition-all ${
                          chartMode === 'equity'
                            ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] shadow-sm font-bold'
                            : 'hover:opacity-80'
                        }`}
                        style={chartMode !== 'equity' ? { color: 'var(--color-text-muted)' } : undefined}
                      >
                        $ Equity
                      </button>
                      <button
                        onClick={() => setChartMode('underwater')}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-mono-num font-semibold transition-all ${
                          chartMode === 'underwater'
                            ? 'bg-[#C1502E] text-white shadow-sm font-bold'
                            : 'hover:opacity-80'
                        }`}
                        style={chartMode !== 'underwater' ? { color: 'var(--color-text-muted)' } : undefined}
                      >
                        % Drawdown
                      </button>
                    </div>

                    {/* Time Range Filter */}
                    <div
                      className="flex gap-1 p-0.5 rounded-lg border transition-colors shadow-inner"
                      style={{
                        background: 'var(--color-elevated)',
                        borderColor: 'var(--color-border-soft)',
                      }}
                    >
                      {['7D', '30D', 'ALL'].map((r) => (
                        <button
                          key={r}
                          onClick={() => setTimeRange(r)}
                          className={`text-[11px] px-2.5 py-1 rounded-md font-mono-num font-semibold transition-all ${
                            timeRange === r
                              ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] shadow-sm font-bold'
                              : 'hover:opacity-80'
                          }`}
                          style={timeRange !== r ? { color: 'var(--color-text-muted)' } : undefined}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                {chartMode === 'equity' ? 'Equity Trajectory ($USD)' : 'Underwater Drawdown Curve (% from Peak)'}
              </SectionLabel>

              {chartMode === 'equity' ? (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={equityCurveData} margin={{ left: -15, right: 10 }}>
                    <defs>
                      <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C9A227" stopOpacity={0.45} />
                        <stop offset="50%" stopColor="#C9A227" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#C9A227" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border-soft)" vertical={false} />
                    <XAxis dataKey="d" tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border-soft)' }} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 300', 'dataMax + 300']} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-dark)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--color-text-main)',
                        boxShadow: 'var(--card-shadow)',
                      }}
                      itemStyle={{ color: '#E5B83B' }}
                    />
                    <Area type="monotone" dataKey="v" stroke="#E5B83B" strokeWidth={2.5} fill="url(#eqGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={underwaterCurveData} margin={{ left: -15, right: 10 }}>
                    <defs>
                      <linearGradient id="underwaterGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C1502E" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#C1502E" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-border-soft)" vertical={false} />
                    <XAxis dataKey="d" tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} axisLine={{ stroke: 'var(--color-border-soft)' }} tickLine={false} />
                    <YAxis domain={[underwaterMinY, 0]} tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-surface)',
                        border: '1px solid rgba(193, 80, 46, 0.4)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--color-text-main)',
                        boxShadow: 'var(--card-shadow)',
                      }}
                      itemStyle={{ color: '#C1502E' }}
                    />
                    <ReferenceLine y={0} stroke="#3FA88C" />
                    <ReferenceLine y={-10} stroke="#C1502E" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Circuit Breaker -10%', fill: '#C1502E', fontSize: 10 }} />
                    <Area type="monotone" dataKey="drawdownPct" stroke="#C1502E" strokeWidth={2} fill="url(#underwaterGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Session Timeline */}
            <div className="terminal-card p-5 flex flex-col justify-between">
              <div>
                <SectionLabel right={<span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>24H CYCLE</span>}>
                  Session Performance
                </SectionLabel>

                <div className="space-y-4 mt-3">
                  {sessionStats.map((s) => {
                    const isProf = s.pnl >= 0;
                    const widthPct = Math.max(10, (Math.abs(s.pnl) / maxSessionAbs) * 100);
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold font-display" style={{ color: 'var(--color-text-main)' }}>{s.name}</span>
                            <span className="text-[11px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>{s.hours}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono-num">
                            <span style={{ color: 'var(--color-text-muted)' }}>{s.winRate}% win</span>
                            <span style={{ color: isProf ? 'var(--color-profit)' : 'var(--color-loss)' }} className="font-bold min-w-16 text-right">
                              {s.pnl >= 0 ? '+' : ''}${s.pnl}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded overflow-hidden" style={{ background: 'var(--color-elevated)' }}>
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${widthPct}%`, background: isProf ? 'var(--color-profit)' : 'var(--color-loss)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p
                className="text-xs pt-3 mt-4 border-t leading-relaxed"
                style={{
                  color: 'var(--color-text-muted)',
                  borderColor: 'var(--color-border-soft)',
                }}
              >
                <strong className="text-amber-500 dark:text-[#C9A227]">Insight:</strong> {sessionInsightText}
              </p>
            </div>
          </div>

          {/* Row 2: Daily P&L Calendar & Win/Loss Split (account-filtered) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DailyPnLCalendar trades={displayTrades} />
            </div>
            <div>
              <WinLossSplit trades={displayTrades} stats={stats} />
            </div>
          </div>

          {/* Row 3: Strategy Breakdown & Recent Trades */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Strategy Breakdown */}
            <div className="terminal-card p-5">
              <SectionLabel right={
                <button onClick={() => setActivePage('strategy')} className="text-xs text-[#C9A227] hover:underline flex items-center gap-1">
                  Compare <ChevronRight size={12} />
                </button>
              }>
                Strategy Comparison
              </SectionLabel>

              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={strategyStats} layout="vertical" margin={{ left: -10 }}>
                  <XAxis type="number" tick={{ fill: 'var(--color-text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--color-text-main)', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-soft)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-main)' }} />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {strategyStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent Trades */}
            <div className="lg:col-span-2 terminal-card p-5">
              <SectionLabel right={
                <button onClick={() => setActivePage('history')} className="text-xs text-[#C9A227] hover:underline flex items-center gap-1">
                  View Journal <ChevronRight size={12} />
                </button>
              }>
                Recent Logged Trades &amp; Discipline Alerts
              </SectionLabel>

              <div className="space-y-2 mt-2">
                {displayTrades.length === 0
                  ? renderEmptyRecentTrades()
                  : displayTrades.slice(0, 5).map(renderRecentTradeRow)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Micro Account Doubler / Plan Target Section */}
      <PlanTargetWidget />
    </div>
  );
}
