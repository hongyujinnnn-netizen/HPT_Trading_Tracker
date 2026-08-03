import React, { useState, useMemo, useEffect } from 'react';
import { Plus, AlertTriangle, ChevronRight, Activity, TrendingUp, Percent, Target, Clock } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTrade } from '../context/TradeContext';
import { StatCard } from '../components/StatCard';
import { SectionLabel } from '../components/SectionLabel';
import { Pill } from '../components/Pill';
import { DailyPnLCalendar } from '../components/DailyPnLCalendar';
import { WinLossSplit } from '../components/WinLossSplit';
import { INITIAL_EQUITY_CURVE } from '../utils/mockData';
import { getCurrentGoldSession } from '../utils/sessionDetector';

export function Dashboard() {
  const { trades, stats, setActivePage, setSelectedTrade, userSession, dbViews, settings, isDemoMode } = useTrade();
  const [timeRange, setTimeRange] = useState('30D');
  const [sessionInfo, setSessionInfo] = useState(getCurrentGoldSession());

  // Dynamic Equity Curve calculation from Supabase dbViews or Trades
  const equityCurveData = useMemo(() => {
    let rawPoints = [];
    const startBalance = parseFloat(settings?.accountBalance) || 10000;

    // 1. If Supabase DB views has equity curve data
    if (dbViews?.equityCurve && dbViews.equityCurve.length > 0) {
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
    } else if (trades && trades.length > 0) {
      // 2. Compute from trades list
      const sortedTrades = [...trades]
        .filter((t) => t.status === 'closed' || t.pnl !== undefined)
        .sort((a, b) => new Date(a.exitTime || a.timestamp || a.date) - new Date(b.exitTime || b.timestamp || b.date));

      if (sortedTrades.length > 0) {
        let running = startBalance;
        const points = [{ d: 'Start', v: startBalance, timestamp: 0 }];

        sortedTrades.forEach((t) => {
          running += parseFloat(t.pnl) || 0;
          const dateObj = new Date(t.exitTime || t.timestamp || t.date || Date.now());
          const formattedDate = isNaN(dateObj.getTime())
            ? 'Trade'
            : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          points.push({
            d: formattedDate,
            v: Math.round(running * 100) / 100,
            timestamp: dateObj.getTime() || Date.now(),
          });
        });

        rawPoints = points;
      }
    }

    // If no points from database or trades:
    if (rawPoints.length === 0) {
      // Only show mock sample curve if in demo mode and not logged in
      if (isDemoMode && !userSession) {
        return INITIAL_EQUITY_CURVE;
      }

      // If user has 0 trades in database, show a clean flat line at account balance
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return [
        { d: 'Start', v: startBalance, timestamp: 0 },
        { d: todayStr, v: startBalance, timestamp: Date.now() },
      ];
    }

    // Apply timeRange filtering (7D, 30D, ALL)
    if (timeRange === 'ALL' || rawPoints.length <= 1) {
      return rawPoints;
    }

    const days = timeRange === '7D' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = rawPoints.filter((p) => p.timestamp >= cutoff || p.timestamp === 0);
    return filtered.length > 0 ? filtered : rawPoints;
  }, [dbViews, trades, settings, isDemoMode, userSession, timeRange]);

  // Greeting based on current local hour
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
      setSessionInfo(getCurrentGoldSession());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute session performance stats
  const sessionStats = useMemo(() => {
    const sessions = [
      { name: 'Asian', hours: '00:00–08:00 GMT' },
      { name: 'London', hours: '08:00–16:00 GMT' },
      { name: 'New York', hours: '13:00–21:00 GMT' },
      { name: 'London Close', hours: '16:00–17:00 GMT' },
    ];

    return sessions.map((s) => {
      const sessionTrades = trades.filter((t) => t.session === s.name);
      const wins = sessionTrades.filter((t) => t.pnl > 0).length;
      const pnl = sessionTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = sessionTrades.length > 0 ? Math.round((wins / sessionTrades.length) * 100) : 0;
      return { ...s, tradesCount: sessionTrades.length, winRate, pnl };
    });
  }, [trades]);

  // Compute strategy performance stats
  const strategyStats = useMemo(() => {
    const strategies = ['Breakout', 'Pullback', 'News Trading', 'Order Block / ICT'];
    return strategies.map((name) => {
      const stratTrades = trades.filter((t) => t.strategy === name);
      const wins = stratTrades.filter((t) => t.pnl > 0).length;
      const pnl = stratTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = stratTrades.length > 0 ? Math.round((wins / stratTrades.length) * 100) : 0;
      return { name, pnl, winRate, count: stratTrades.length, fill: pnl >= 0 ? '#3FA88C' : '#C1502E' };
    });
  }, [trades]);

  const maxSessionAbs = Math.max(...sessionStats.map((s) => Math.abs(s.pnl)), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header matching screenshot */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[#EDEAE3] flex items-center gap-2">
            {greeting}, {userName} <span className="inline-block animate-bounce">👋</span>
          </h1>
          <p className="text-xs text-[#8B8D91] mt-0.5">
            Here&apos;s how your XAU/USD edge performed this month.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Session pill: e.g. London session · 3h 12m left */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131619] border border-[#262B30] text-xs font-mono-num">
            <span className="w-2 h-2 rounded-full bg-[#3FA88C] animate-pulse" />
            <span className="text-[#8B8D91]">
              <strong className="text-[#EDEAE3] font-medium">{sessionInfo.name}</strong> · {sessionInfo.timeLeft}
            </span>
          </div>

          {/* + New Trade Button */}
          <button
            onClick={() => setActivePage('add')}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#E5B82C] hover:bg-[#F2C93B] text-[#0A0C0E] font-bold text-xs shadow-md transition-colors"
          >
            <Plus size={15} /> New Trade
          </button>
        </div>
      </div>

      {/* 5 KPI Stat Cards Grid matching screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          label="Net P&L (30d)"
          value={`+$${stats.totalPnl.toLocaleString()}`}
          valueColor="#3FA88C"
          delta="12.4% vs last month"
          deltaType="up"
          sparklineData={[3200, 3500, 3300, 3900, 4200, 4100, 4500, 4812]}
          sparklineColor="#3FA88C"
        />

        <StatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          valueColor="#E4C468"
          delta="3.1 pts"
          deltaType="up"
          sparklineData={[58, 60, 59, 62, 61, 63, 64.3]}
          sparklineColor="#E4C468"
        />

        <StatCard
          label="Profit Factor"
          value={`${stats.profitFactor}`}
          valueColor="#EDEAE3"
          delta="0.08"
          deltaType="down"
          sparklineData={[2.22, 2.20, 2.18, 2.15, 2.17, 2.14]}
          sparklineColor="#8B8D91"
        />

        <StatCard
          label="Avg R : R"
          value={`1 : ${stats.avgRR}`}
          valueColor="#EDEAE3"
          delta="0.2"
          deltaType="up"
          sparklineData={[1.9, 2.0, 2.1, 2.0, 2.2, 2.3]}
          sparklineColor="#3FA88C"
        />

        <StatCard
          label="Max Drawdown"
          value={`-${stats.maxDrawdownPct}%`}
          valueColor="#C1502E"
          delta="within 10% limit"
          deltaType="neutral"
          sparklineData={[-2, -4, -3, -5, -8, -6.8]}
          sparklineColor="#C1502E"
        />
      </div>

      {/* Row 1: Equity Trajectory ($USD) (2 cols) & Session Performance (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity Trajectory ($USD) */}
        <div className="lg:col-span-2 terminal-card p-5 space-y-4">
          <SectionLabel
            right={
              <div className="flex gap-1 bg-[#1B1F23] p-0.5 rounded border border-[#262B30]">
                {['7D', '30D', 'ALL'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono-num font-semibold ${timeRange === r ? 'bg-[#C9A227] text-[#0A0C0E]' : 'text-[#8B8D91] hover:text-[#EDEAE3]'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            }
          >
            Equity Trajectory ($USD)
          </SectionLabel>

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

      {/* Row 2: Daily P&L Calendar (2 cols) & Win/Loss Split Donut Chart (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DailyPnLCalendar trades={trades} />
        </div>
        <div>
          <WinLossSplit trades={trades} stats={stats} />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Strategy Breakdown */}
        <div className="terminal-card p-5">
          <SectionLabel right={<button onClick={() => setActivePage('strategy')} className="text-xs text-[#C9A227] hover:underline flex items-center gap-1">Compare <ChevronRight size={12} /></button>}>
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

        {/* Recent Trades & Mistake Feed */}
        <div className="lg:col-span-2 terminal-card p-5">
          <SectionLabel
            right={
              <button onClick={() => setActivePage('history')} className="text-xs text-[#C9A227] hover:underline flex items-center gap-1">
                View Journal <ChevronRight size={12} />
              </button>
            }
          >
            Recent Logged Trades &amp; Discipline Alerts
          </SectionLabel>

          <div className="space-y-2.5 mt-2">
            {trades.slice(0, 5).map((t) => (
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
                  <span className="text-[#8B8D91] hidden sm:inline">1:{t.rr.toFixed(1)} RR</span>
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
  );
}
