import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export function WinLossSplit({ trades = [], stats = {} }) {
  const { winsCount, lossesCount, breakevenCount, totalTrades, winRate } = useMemo(() => {
    const wins = trades.filter((t) => (t.pnl || 0) > 0).length;
    const losses = trades.filter((t) => (t.pnl || 0) < 0).length;
    const breakeven = trades.filter((t) => (t.pnl || 0) === 0).length;
    const total = trades.length;
    const wr = total > 0 ? Math.round((wins / total) * 100) : (stats.winRate || 0);

    return {
      winsCount: wins,
      lossesCount: losses,
      breakevenCount: breakeven,
      totalTrades: total,
      winRate: wr,
    };
  }, [trades, stats]);

  const pieData = useMemo(() => {
    return [
      { name: 'Wins', value: winsCount || 1, color: '#3FA88C' },
      { name: 'Losses', value: lossesCount || 0, color: '#C1502E' },
      { name: 'Breakeven', value: breakevenCount || 0, color: '#5A5D61' },
    ].filter((item) => item.value > 0);
  }, [winsCount, lossesCount, breakevenCount]);

  return (
    <div className="terminal-card p-5 space-y-4 flex flex-col justify-between select-none h-full">
      <div>
        <h3 className="text-base font-bold font-display text-[#EDEAE3]">Win / Loss Split</h3>
        <p className="text-xs text-[#8B8D91]">{totalTrades} trades logged</p>
      </div>

      <div className="flex items-center justify-between gap-4 my-auto py-2">
        {/* Donut Chart with Center Text */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={62}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-black font-mono-num text-[#EDEAE3] leading-none">
              {winRate}%
            </span>
            <span className="text-[10px] font-semibold text-[#8B8D91] mt-0.5">
              win rate
            </span>
          </div>
        </div>

        {/* Legend Breakdown */}
        <div className="flex-1 space-y-3 font-mono-num text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#3FA88C]" />
              <span className="text-[#EDEAE3] font-medium">Wins</span>
            </div>
            <span className="font-bold text-[#EDEAE3]">{winsCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#C1502E]" />
              <span className="text-[#EDEAE3] font-medium">Losses</span>
            </div>
            <span className="font-bold text-[#EDEAE3]">{lossesCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#5A5D61]" />
              <span className="text-[#EDEAE3] font-medium">Breakeven</span>
            </div>
            <span className="font-bold text-[#EDEAE3]">{breakevenCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
