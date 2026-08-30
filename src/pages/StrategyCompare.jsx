import React, { useMemo } from 'react';
import { GitCompare, Award, TrendingUp, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';

const DEFAULT_STRATEGIES = [
  'Breakout',
  'Pullback',
  'News Trading',
  'Order Block / ICT',
  'Trend Following',
  'Range Scalp',
];

export function StrategyCompare() {
  const { trades, filteredTrades: contextFilteredTrades } = useTrade();
  const activeTrades = contextFilteredTrades || trades;

  // Extract all unique strategies dynamically from actual trades + default list
  const strategyList = useMemo(() => {
    const fromTrades = activeTrades.map((t) => t.strategy).filter(Boolean);
    const combined = Array.from(new Set([...DEFAULT_STRATEGIES, ...fromTrades]));
    return combined;
  }, [activeTrades]);

  const stratData = useMemo(() => {
    return strategyList.map((name) => {
      const filtered = activeTrades.filter((t) => (t.strategy || '').toLowerCase() === name.toLowerCase());
      const totalTrades = filtered.length;
      const wins = filtered.filter((t) => (t.pnl || 0) > 0).length;
      const losses = filtered.filter((t) => (t.pnl || 0) < 0).length;
      const pnl = filtered.reduce((acc, t) => acc + (t.pnl || 0), 0);
      const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
      const avgRR = totalTrades > 0 ? (filtered.reduce((acc, t) => acc + (t.rr || 0), 0) / totalTrades).toFixed(1) : '0.0';
      const grossProfit = filtered.filter((t) => (t.pnl || 0) > 0).reduce((acc, t) => acc + t.pnl, 0);
      const grossLoss = Math.abs(filtered.filter((t) => (t.pnl || 0) < 0).reduce((acc, t) => acc + t.pnl, 0));
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
  }, [strategyList, activeTrades]);

  // Dynamic Strategic Advisory based on real user edge
  const advisory = useMemo(() => {
    const withTrades = stratData.filter((s) => s.totalTrades > 0);
    if (withTrades.length === 0) {
      return 'Log trades with strategy tags (Breakout, Pullback, Order Block, etc.) to generate personalized edge comparisons and mathematical expectancy analytics.';
    }

    const sortedByPnl = [...withTrades].sort((a, b) => b.pnl - a.pnl);
    const bestStrat = sortedByPnl[0];
    const worstStrat = sortedByPnl[sortedByPnl.length - 1];

    let advice = '';
    if (bestStrat && bestStrat.pnl > 0) {
      advice += `Your highest quality edge is "${bestStrat.name}" with a ${bestStrat.winRate}% win rate, average 1:${bestStrat.avgRR} R:R, and +$${bestStrat.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })} net profit across ${bestStrat.totalTrades} executions. `;
    } else if (bestStrat) {
      advice += `Your top performing strategy currently is "${bestStrat.name}" (${bestStrat.winRate}% win rate across ${bestStrat.totalTrades} trades). `;
    }

    if (worstStrat && worstStrat.pnl < 0 && worstStrat.name !== bestStrat.name) {
      advice += `Conversely, "${worstStrat.name}" has generated -$${Math.abs(worstStrat.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })} in drawdowns (${worstStrat.winRate}% win rate). Consider reviewing or tightening your rules for ${worstStrat.name} entries to avoid leaking profits.`;
    } else if (withTrades.length === 1) {
      advice += 'Record setups across multiple strategies to compare side-by-side performance.';
    }

    return advice;
  }, [stratData]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Strategy Comparison &amp; Edge Breakdown</h1>
        <p className="text-xs text-[#8B8D91]">Compare statistical win rates, profit factor, and net expectancy across your trading setups</p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stratData.map((s) => (
          <div key={s.name} className="terminal-card p-5 space-y-4 relative overflow-hidden group">
            <div className="flex items-center justify-between border-b border-[#1E2226] pb-3">
              <span className="font-bold text-base font-display text-[#EDEAE3]">{s.name}</span>
              <Pill tone={s.pnl >= 0 ? 'profit' : 'loss'}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Pill>
            </div>

            {/* Win Rate Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono-num">
                <span className="text-[#8B8D91]">Win Rate</span>
                <span className="font-bold" style={{ color: s.winRate >= 50 ? '#3FA88C' : '#C1502E' }}>
                  {s.winRate}% ({s.wins}W / {s.losses}L)
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#1B1F23] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${s.winRate}%`,
                    backgroundColor: s.winRate >= 50 ? '#3FA88C' : '#C1502E',
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs font-body pt-1">
              <div className="flex justify-between">
                <span className="text-[#8B8D91]">Total Executions:</span>
                <span className="font-mono-num font-semibold text-[#EDEAE3]">{s.totalTrades} trades</span>
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
      <div className="terminal-card p-5 space-y-2 bg-[#1B1F23]/60 border-l-4 border-l-[#C9A227]">
        <SectionLabel right={<Sparkles size={13} className="text-[#C9A227]" />}>
          Quantitative Strategic Advisory
        </SectionLabel>
        <p className="text-xs text-[#8B8D91] leading-relaxed">
          {advisory}
        </p>
      </div>
    </div>
  );
}
