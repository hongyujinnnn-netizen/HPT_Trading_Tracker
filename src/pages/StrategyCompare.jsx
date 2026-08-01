import React, { useMemo } from 'react';
import { GitCompare, Award, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';

export function StrategyCompare() {
  const { trades } = useTrade();

  const strategies = [
    'Breakout',
    'Pullback',
    'News Trading',
    'Order Block / ICT',
    'Trend Following',
    'Range Scalp',
  ];

  const stratData = useMemo(() => {
    return strategies.map((name) => {
      const filtered = trades.filter((t) => t.strategy === name);
      const totalTrades = filtered.length;
      const wins = filtered.filter((t) => t.pnl > 0).length;
      const losses = filtered.filter((t) => t.pnl < 0).length;
      const pnl = filtered.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
      const avgRR = totalTrades > 0 ? (filtered.reduce((acc, t) => acc + (t.rr || 0), 0) / totalTrades).toFixed(1) : '0.0';
      const grossProfit = filtered.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
      const grossLoss = Math.abs(filtered.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '9.99' : '0.00';
      const expectancy = totalTrades > 0 ? Math.round(pnl / totalTrades) : 0;

      return {
        name,
        totalTrades,
        wins,
        losses,
        pnl,
        winRate,
        avgRR,
        profitFactor,
        expectancy,
      };
    });
  }, [trades]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Strategy Comparison &amp; Edge Breakdown</h1>
        <p className="text-xs text-[#8B8D91]">Compare statistical win rates, profit factor, and net expectancy across your trading setups</p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stratData.map((s) => (
          <div key={s.name} className="terminal-card p-5 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#1E2226] pb-3">
              <span className="font-bold text-base font-display text-[#EDEAE3]">{s.name}</span>
              <Pill tone={s.pnl >= 0 ? 'profit' : 'loss'}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toLocaleString()}
              </Pill>
            </div>

            <div className="space-y-2 text-xs font-body">
              <div className="flex justify-between">
                <span className="text-[#8B8D91]">Total Executions:</span>
                <span className="font-mono-num font-semibold text-[#EDEAE3]">{s.totalTrades} trades</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#8B8D91]">Win Rate:</span>
                <span className="font-mono-num font-semibold" style={{ color: s.winRate >= 50 ? '#3FA88C' : '#C1502E' }}>
                  {s.winRate}% ({s.wins}W / {s.losses}L)
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#8B8D91]">Avg Risk-Reward:</span>
                <span className="font-mono-num font-semibold text-[#C9A227]">1 : {s.avgRR}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#8B8D91]">Profit Factor:</span>
                <span className="font-mono-num font-semibold text-[#EDEAE3]">{s.profitFactor}</span>
              </div>

              <div className="flex justify-between pt-2 border-t border-[#1E2226]">
                <span className="text-[#8B8D91]">Expectancy / Trade:</span>
                <span className={`font-mono-num font-bold ${s.expectancy >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}`}>
                  {s.expectancy >= 0 ? '+' : ''}${s.expectancy}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strategic Recommendation Note */}
      <div className="terminal-card p-5 space-y-2 bg-[#1B1F23]/40 border-l-4 border-l-[#C9A227]">
        <SectionLabel>Strategic Advisory</SectionLabel>
        <p className="text-xs text-[#8B8D91] leading-relaxed">
          Your <strong className="text-[#EDEAE3]">Breakout</strong> strategy delivers a 61% win rate and an average reward ratio of 2.1 — it represents your highest quality edge. Conversely, <strong className="text-[#C1502E]">News Trading</strong> carries a 39% win rate with negative expectancy. Consider pausing news entries to prevent leaking profits gained from technical breakout setups.
        </p>
      </div>
    </div>
  );
}
