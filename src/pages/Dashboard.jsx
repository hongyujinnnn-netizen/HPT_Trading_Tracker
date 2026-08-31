import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  AlertTriangle,
  ChevronRight,
  Activity,
  TrendingUp,
  Percent,
  Target,
  Clock,
  CandlestickChart,
  LayoutDashboard,
  Coffee,
  Sliders,
  Zap,
  TrendingDown,
  Layers,
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
import { calculateExpectancy, calculateSharpeRatio, calculateUnderwaterDrawdown } from '../utils/edgeAnalytics';

export function Dashboard() {
  const {
    trades,
    filteredTrades,
    stats,
    setActivePage,
    setSelectedTrade,
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

  // Sharpe Ratio calculation
  const sharpeData = useMemo(() => {
    return calculateSharpeRatio(displayTrades, 0.02, 30);
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
      rawPoints = dbViews.equityCurve.map((item) => {
        const dateObj = new Date(item.exit_time || item.timestamp);
        const formattedDate = isNaN(dateObj.getTime())
          ? (item.exit_time || '')
          : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return {
          d: formattedDate,
          v: Math.round(parseFloat(item.running_balance) || 0),
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
    return 'Bun';
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
    const sessions = [
      { name: 'Asian', hours: '00:00–08:00 GMT' },
      { name: 'London', hours: '08:00–16:00 GMT' },
      { name: 'New York', hours: '13:00–21:00 GMT' },
      { name: 'London Close', hours: '16:00–17:00 GMT' },
    ];

    return sessions.map((s) => {
      const sessionTrades = displayTrades.filter((t) => t.session === s.name);
      const wins = sessionTrades.filter((t) => t.pnl > 0).length;
      const pnl = sessionTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = sessionTrades.length > 0 ? Math.round((wins / sessionTrades.length) * 100) : 0;
      return { ...s, tradesCount: sessionTrades.length, winRate, pnl };
    });
  }, [displayTrades]);

  // Strategy stats
  const strategyStats = useMemo(() => {
    const strategies = ['Breakout', 'Pullback', 'News Trading', 'Order Block / ICT'];
    return strategies.map((name) => {
      const stratTrades = displayTrades.filter((t) => t.strategy === name);
      const wins = stratTrades.filter((t) => t.pnl > 0).length;
      const pnl = stratTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = stratTrades.length > 0 ? Math.round((wins / stratTrades.length) * 100) : 0;
      return { name, pnl, winRate, count: stratTrades.length, fill: pnl >= 0 ? '#3FA88C' : '#C1502E' };
    });
  }, [displayTrades]);

  const maxSessionAbs = Math.max(...sessionStats.map((s) => Math.abs(s.pnl)), 1);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header with Layout Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#EDEAE3] flex items-center gap-2">
            {greeting}, {userName} <span className="inline-block animate-bounce">👋</span>
          </h1>
          <p className="text-xs text-[#8B8D91] mt-0.5">
            Institutional edge analytics, discipline metrics, and real-time execution tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Saved Layout Mode Selector */}
          <div className="flex items-center bg-[#131619] p-1 rounded-lg border border-[#262B30] text-xs">
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
                  className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-colors ${
                    isSelected
                      ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 shadow-sm'
                      : 'text-[#8B8D91] hover:text-[#EDEAE3]'
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
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131619] border border-[#262B30] text-xs font-mono-num">
            <span className="w-2 h-2 rounded-full bg-[#3FA88C] animate-pulse" />
            <span className="text-[#8B8D91]">
              <strong className="text-[#EDEAE3] font-medium">{sessionInfo.name}</strong> · {sessionInfo.timeLeft}
            </span>
          </div>

          {/* View Live Gold Chart */}
          <button
            onClick={() => setActivePage('chart')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#131619] hover:bg-[#262B30] text-[#C9A227] font-semibold text-xs border border-[#C9A227]/40 transition-colors"
          >
            <CandlestickChart size={15} /> Gold Chart
          </button>

          {/* + New Trade Button */}
          <button
            onClick={() => setActivePage('add')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#E5B82C] hover:bg-[#F2C93B] text-[#0A0C0E] font-bold text-xs shadow-md transition-colors"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Net P&L"
          value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toLocaleString()}`}
          valueColor={stats.totalPnl >= 0 ? '#3FA88C' : '#C1502E'}
          delta="Realized balance return"
          deltaType={stats.totalPnl >= 0 ? 'up' : 'down'}
          sparklineData={[3200, 3500, 3300, 3900, 4200, 4100, 4500, 4812]}
          sparklineColor="#3FA88C"
        />

        <StatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          valueColor="#E4C468"
          delta="Cumulative win rate"
          deltaType="up"
          sparklineData={[58, 60, 59, 62, 61, 63, 64.3]}
          sparklineColor="#E4C468"
        />

        <StatCard
          label="Dollar Expectancy"
          value={`${expectancyData.expectancy >= 0 ? '+' : ''}$${expectancyData.expectancy}`}
          valueColor={expectancyData.expectancy >= 0 ? '#3FA88C' : '#C1502E'}
          delta={expectancyData.sizingAdvice}
          deltaType={expectancyData.expectancy >= 0 ? 'up' : 'down'}
          sparklineData={[50, 60, 40, 80, 75, 90]}
          sparklineColor="#C9A227"
        />

        <StatCard
          label="Avg R : R"
          value={`1 : ${stats.avgRR}`}
          valueColor="#EDEAE3"
          delta="Risk:Reward Ratio"
          deltaType="up"
          sparklineData={[1.9, 2.0, 2.1, 2.0, 2.2, 2.3]}
          sparklineColor="#3FA88C"
        />

        <StatCard
          label="Max Drawdown"
          value={`-${stats.maxDrawdownPct}%`}
          valueColor={stats.maxDrawdownPct > 10 ? '#C1502E' : '#EDEAE3'}
          delta={stats.maxDrawdownPct > 10 ? 'Circuit Breaker Hit' : 'within 10% limit'}
          deltaType={stats.maxDrawdownPct > 10 ? 'down' : 'neutral'}
          sparklineData={[-2, -4, -3, -5, -8, -6.8]}
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
              <DailyPnLCalendar trades={trades} />
            </div>
            {/* Session Timeline */}
            <div className="terminal-card p-5 flex flex-col justify-between">
              <div>
                <SectionLabel right={<span className="text-[10px] font-mono-num text-[#5A5D61]">24H CYCLE</span>}>
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
                            <span className="font-semibold text-[#EDEAE3] font-display">{s.name}</span>
                            <span className="text-[10px] text-[#5A5D61] font-mono-num">{s.hours}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono-num">
                            <span className="text-[#8B8D91]">{s.winRate}% win</span>
                            <span style={{ color: isProf ? '#3FA88C' : '#C1502E' }} className="font-bold min-w-16 text-right">
                              {s.pnl >= 0 ? '+' : ''}${s.pnl}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded bg-[#1B1F23] overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${widthPct}%`, background: isProf ? '#3FA88C' : '#C1502E' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-[#8B8D91] pt-3 mt-4 border-t border-[#1E2226] leading-relaxed">
                <strong className="text-[#C9A227]">Preparation Rule:</strong> Verify upcoming high-impact economic news 15 minutes prior to session opens.
              </p>
            </div>
          </div>

          {/* Recent Trades & Discipline Alerts */}
          <div className="terminal-card p-5">
            <SectionLabel right={
              <button onClick={() => setActivePage('mistakes')} className="text-xs text-[#C9A227] hover:underline flex items-center gap-1">
                Discipline Center <ChevronRight size={12} />
              </button>
            }>
              Recent Trades &amp; Behavioral Audits
            </SectionLabel>

            <div className="space-y-2.5 mt-3">
              {displayTrades.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTrade(t)}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#1B1F23]/60 hover:bg-[#1B1F23] border border-[#1E2226] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#5A5D61] font-mono-num w-16">{t.date}</span>
                    <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                    <span className="text-xs text-[#EDEAE3] font-medium">{t.strategy}</span>
                    {t.mistakes && t.mistakes.length > 0 && (
                      <span className="text-[11px] text-[#C1502E] flex items-center gap-1 bg-[#4A2A1E]/30 px-2 py-0.5 rounded border border-[#5C3426]">
                        <AlertTriangle size={11} /> {t.mistakes[0]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono-num text-xs">
                    <span className="text-[#8B8D91] hidden sm:inline">1:{t.rr ? Number(t.rr).toFixed(1) : '1.0'} RR</span>
                    <span className={`font-bold ${t.pnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl}
                    </span>
                  </div>
                </div>
              ))}
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
                    <div className="flex gap-1 bg-[#131619] p-0.5 rounded border border-[#262B30]">
                      <button
                        onClick={() => setChartMode('equity')}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono-num font-semibold transition-colors ${
                          chartMode === 'equity' ? 'bg-[#C9A227] text-[#0A0C0E]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                        }`}
                      >
                        $ Equity
                      </button>
                      <button
                        onClick={() => setChartMode('underwater')}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono-num font-semibold transition-colors ${
                          chartMode === 'underwater' ? 'bg-[#C1502E] text-white' : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                        }`}
                      >
                        % Drawdown
                      </button>
                    </div>

                    {/* Time Range Filter */}
                    <div className="flex gap-1 bg-[#1B1F23] p-0.5 rounded border border-[#262B30]">
                      {['7D', '30D', 'ALL'].map((r) => (
                        <button
                          key={r}
                          onClick={() => setTimeRange(r)}
                          className={`text-[10px] px-2 py-0.5 rounded font-mono-num font-semibold ${
                            timeRange === r ? 'bg-[#C9A227] text-[#0A0C0E]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                          }`}
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
                        <stop offset="0%" stopColor="#C9A227" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#C9A227" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1E2226" vertical={false} />
                    <XAxis dataKey="d" tick={{ fill: '#5A5D61', fontSize: 11 }} axisLine={{ stroke: '#1E2226' }} tickLine={false} />
                    <YAxis tick={{ fill: '#5A5D61', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin - 300', 'dataMax + 300']} />
                    <Tooltip
                      contentStyle={{ background: '#1B1F23', border: '1px solid #262B30', borderRadius: 6, fontSize: 12, color: '#EDEAE3' }}
                      itemStyle={{ color: '#C9A227' }}
                    />
                    <Area type="monotone" dataKey="v" stroke="#C9A227" strokeWidth={2.5} fill="url(#eqGradient)" />
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
                    <CartesianGrid stroke="#1E2226" vertical={false} />
                    <XAxis dataKey="d" tick={{ fill: '#5A5D61', fontSize: 11 }} axisLine={{ stroke: '#1E2226' }} tickLine={false} />
                    <YAxis domain={[-15, 0]} tick={{ fill: '#5A5D61', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{ background: '#1B1F23', border: '1px solid #262B30', borderRadius: 6, fontSize: 12, color: '#EDEAE3' }}
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
                <SectionLabel right={<span className="text-[10px] font-mono-num text-[#5A5D61]">24H CYCLE</span>}>
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
                            <span className="font-semibold text-[#EDEAE3] font-display">{s.name}</span>
                            <span className="text-[10px] text-[#5A5D61] font-mono-num">{s.hours}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono-num">
                            <span className="text-[#8B8D91]">{s.winRate}% win</span>
                            <span style={{ color: isProf ? '#3FA88C' : '#C1502E' }} className="font-bold min-w-16 text-right">
                              {s.pnl >= 0 ? '+' : ''}${s.pnl}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded bg-[#1B1F23] overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${widthPct}%`, background: isProf ? '#3FA88C' : '#C1502E' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-[#8B8D91] pt-3 mt-4 border-t border-[#1E2226] leading-relaxed">
                <strong className="text-[#C9A227]">Insight:</strong> London session yields your highest win rate (64%). Avoid trading late in London Close.
              </p>
            </div>
          </div>

          {/* Row 2: Daily P&L Calendar & Win/Loss Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DailyPnLCalendar trades={trades} />
            </div>
            <div>
              <WinLossSplit trades={trades} stats={stats} />
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
                  <XAxis type="number" tick={{ fill: '#5A5D61', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8B8D91', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ background: '#1B1F23', border: '1px solid #262B30', borderRadius: 6, fontSize: 12 }} />
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

              <div className="space-y-2.5 mt-2">
                {displayTrades.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrade(t)}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#1B1F23]/60 hover:bg-[#1B1F23] border border-[#1E2226] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#5A5D61] font-mono-num w-14">{t.date}</span>
                      <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                      <span className="text-xs text-[#EDEAE3] font-medium">{t.strategy}</span>
                      {t.mistakes && t.mistakes.length > 0 && (
                        <span className="text-[11px] text-[#C1502E] flex items-center gap-1 bg-[#4A2A1E]/30 px-2 py-0.5 rounded border border-[#5C3426]">
                          <AlertTriangle size={11} /> {t.mistakes[0]}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 font-mono-num text-xs">
                      <span className="text-[#8B8D91] hidden sm:inline">1:{t.rr ? Number(t.rr).toFixed(1) : '1.0'} RR</span>
                      <span className={`font-bold ${t.pnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl}
                      </span>
                    </div>
                  </div>
                ))}
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
