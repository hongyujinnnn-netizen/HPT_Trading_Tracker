import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Award, Zap, AlertTriangle, ShieldCheck, TrendingUp, Calendar, Percent } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { StatCard } from '../components/StatCard';
import { SectionLabel } from '../components/SectionLabel';

export function Analytics() {
  const { trades, stats } = useTrade();

  // Win rate & PnL by Day of Week
  const dayOfWeekStats = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const map = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };

    trades.forEach((t) => {
      if (!t.date) return;
      const dateObj = new Date(t.date);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      if (map[dayName]) {
        map[dayName].push(t);
      }
    });

    return days.map((day) => {
      const dayTrades = map[day];
      const wins = dayTrades.filter((t) => t.pnl > 0).length;
      const pnl = dayTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = dayTrades.length > 0 ? Math.round((wins / dayTrades.length) * 100) : 0;
      return { day, count: dayTrades.length, winRate, pnl, fill: pnl >= 0 ? '#3FA88C' : '#C1502E' };
    });
  }, [trades]);

  // Streak Analysis
  const streakStats = useMemo(() => {
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;

    const sorted = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sorted.forEach((t) => {
      if (t.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else if (t.pnl < 0) {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
      }
    });

    return { maxWinStreak, maxLossStreak };
  }, [trades]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Performance Analytics &amp; Edge Insights</h1>
        <p className="text-xs text-[#8B8D91]">Deep dive into win rates by day of week, streak durability, and statistical expectancy</p>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Expectancy / Trade" value={`+$${stats.expectancy}`} sub="Average return per trade taken" icon={Zap} tone="gold" />
        <StatCard label="Profit Factor" value={`${stats.profitFactor}`} sub="Gross Profit / Gross Loss" icon={Award} tone={stats.profitFactor >= 1.5 ? 'profit' : 'loss'} />
        <StatCard label="Max Win Streak" value={`${streakStats.maxWinStreak} consecutive`} sub="Longest winning streak" icon={ShieldCheck} tone="profit" />
        <StatCard label="Max Loss Streak" value={`${streakStats.maxLossStreak} consecutive`} sub="Longest drawdown streak" icon={AlertTriangle} tone="loss" />
      </div>

      {/* Performance by Day of Week Chart */}
      <div className="terminal-card p-5 space-y-4">
        <SectionLabel right={<span className="text-xs text-[#8B8D91] font-mono-num">Mon – Fri Breakdown</span>}>
          Performance &amp; Win Rate by Day of Week
        </SectionLabel>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dayOfWeekStats} margin={{ left: -10, right: 10 }}>
            <CartesianGrid stroke="#1E2226" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#8B8D91', fontSize: 11 }} axisLine={{ stroke: '#1E2226' }} tickLine={false} />
            <YAxis tick={{ fill: '#5A5D61', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1B1F23', border: '1px solid #262B30', borderRadius: 6, fontSize: 12 }} />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {dayOfWeekStats.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Automated Behavioral Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="terminal-card p-5 space-y-3 border-l-4 border-l-[#3FA88C]">
          <h3 className="text-sm font-bold font-display text-[#3FA88C] flex items-center gap-2">
            <TrendingUp size={16} /> Key Edges &amp; Strengths
          </h3>
          <ul className="space-y-2 text-xs text-[#8B8D91] font-body leading-relaxed">
            <li>• Tuesday is your highest profitability day (+ $1,240 net gain across breakout setups).</li>
            <li>• Planned trades held to target achieve an average Risk-Reward ratio of 1:2.3.</li>
            <li>• London session order block setups yield a 64% win rate over 58 sample entries.</li>
          </ul>
        </div>

        <div className="terminal-card p-5 space-y-3 border-l-4 border-l-[#C1502E]">
          <h3 className="text-sm font-bold font-display text-[#C1502E] flex items-center gap-2">
            <AlertTriangle size={16} /> Vulnerability &amp; Risk Audit
          </h3>
          <ul className="space-y-2 text-xs text-[#8B8D91] font-body leading-relaxed">
            <li>• News trading setups hold a 39% win rate — cost negative net yield on total equity.</li>
            <li>• 42% of total dollar drawdown occurred on trades tagged as "Revenge Trade".</li>
            <li>• Win rate drops to 33% during the 16:00–17:00 London Close overlap hour.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
