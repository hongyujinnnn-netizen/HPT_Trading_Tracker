import React, { useState, useMemo, useEffect } from 'react';
import { Clock, ShieldAlert, CheckCircle2, Flame, Ban, Info } from 'lucide-react';
import { calculateTimeOfDayMatrix } from '../utils/edgeAnalytics';
import { SectionLabel } from './SectionLabel';

export function TimeOfDayHeatMap({ trades = [], onBlockSlotChange }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('tradepulse_blocked_slots');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const matrixData = useMemo(() => {
    return calculateTimeOfDayMatrix(trades);
  }, [trades]);

  const toggleBlockSlot = (slotKey) => {
    setBlockedSlots((prev) => {
      const next = prev.includes(slotKey) ? prev.filter((k) => k !== slotKey) : [...prev, slotKey];
      localStorage.setItem('tradepulse_blocked_slots', JSON.stringify(next));
      if (onBlockSlotChange) onBlockSlotChange(next);
      return next;
    });
  };

  const autoBlockRedSlots = () => {
    const redSlotKeys = matrixData.redSlots.map((s) => `${s.day}_${s.hour}`);
    setBlockedSlots((prev) => {
      const combined = Array.from(new Set([...prev, ...redSlotKeys]));
      localStorage.setItem('tradepulse_blocked_slots', JSON.stringify(combined));
      if (onBlockSlotChange) onBlockSlotChange(combined);
      return combined;
    });
  };

  const clearBlockedSlots = () => {
    setBlockedSlots([]);
    localStorage.removeItem('tradepulse_blocked_slots');
    if (onBlockSlotChange) onBlockSlotChange([]);
  };

  // Find max absolute PnL for dynamic heatmap color opacity
  const maxAbsPnl = useMemo(() => {
    const pnls = matrixData.slotsList.map((s) => Math.abs(s.pnl));
    return Math.max(...pnls, 100);
  }, [matrixData]);

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262B30] pb-3">
        <div>
          <SectionLabel right={
            blockedSlots.length > 0 ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#4A2A1E] text-[#C1502E] border border-[#C1502E]/40 font-bold flex items-center gap-1">
                <Ban size={11} /> {blockedSlots.length} Trading Slot(s) Blocked
              </span>
            ) : null
          }>
            Time-of-Day &amp; Session Heat Map
          </SectionLabel>
          <p className="text-xs text-[#8B8D91] mt-0.5">
            Hourly P&amp;L performance across Monday–Friday to pinpoint profitable execution windows.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {matrixData.redSlots.length > 0 && (
            <button
              onClick={autoBlockRedSlots}
              className="px-2.5 py-1 rounded bg-[#4A2A1E]/60 hover:bg-[#4A2A1E] border border-[#C1502E]/40 text-[#C1502E] text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Automatically block hours that generated net losses"
            >
              <Ban size={12} /> Auto-Block {matrixData.redSlots.length} Red Slots
            </button>
          )}
          {blockedSlots.length > 0 && (
            <button
              onClick={clearBlockedSlots}
              className="px-2 py-1 rounded bg-[#1B1F23] hover:bg-[#262B30] text-[#8B8D91] text-[11px] transition-colors"
            >
              Clear Blocks
            </button>
          )}
        </div>
      </div>

      {/* Heat Map Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[650px] space-y-1 select-none">
          {/* Hour headers */}
          <div className="grid grid-cols-25 gap-1 text-center text-[9px] font-mono-num text-[#5A5D61] pb-1">
            <div className="w-14 text-left">Day \ Hr</div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="truncate">{h}h</div>
            ))}
          </div>

          {/* Weekday rows */}
          {matrixData.days.map((day) => (
            <div key={day} className="grid grid-cols-25 gap-1 items-center">
              <div className="w-14 text-xs font-semibold text-[#8B8D91] truncate font-display">
                {day.slice(0, 3)}
              </div>

              {Array.from({ length: 24 }, (_, hour) => {
                const cell = matrixData.matrix[day][hour];
                const slotKey = `${day}_${hour}`;
                const isBlocked = blockedSlots.includes(slotKey);
                const hasTrades = cell.trades > 0;
                const pnl = cell.pnl;

                // Color calculation
                let bgStyle = 'bg-[#131619]/60 border-[#1E2226] text-[#5A5D61]';
                if (hasTrades) {
                  const intensity = Math.min(1, Math.max(0.2, Math.abs(pnl) / maxAbsPnl));
                  if (pnl > 0) {
                    bgStyle = `bg-[#152E25] border-[#1F4A40] text-[#3FA88C] hover:border-[#3FA88C]`;
                  } else if (pnl < 0) {
                    bgStyle = `bg-[#2E1815] border-[#4A2A1E] text-[#C1502E] hover:border-[#C1502E]`;
                  } else {
                    bgStyle = 'bg-[#1B1F23] border-[#262B30] text-[#EDEAE3]';
                  }
                }

                if (isBlocked) {
                  bgStyle = 'bg-[#4A2A1E]/80 border-[#C1502E] text-[#C1502E] ring-1 ring-[#C1502E]';
                }

                return (
                  <div
                    key={hour}
                    onClick={() => {
                      setSelectedSlot({ day, hour, ...cell, slotKey, isBlocked });
                    }}
                    onDoubleClick={() => toggleBlockSlot(slotKey)}
                    className={`h-7 rounded border cursor-pointer flex items-center justify-center text-[10px] font-mono-num transition-all hover:scale-105 relative group ${bgStyle}`}
                    title={`${day} ${hour}:00 UTC: ${hasTrades ? `${pnl >= 0 ? '+' : ''}$${Math.round(pnl)} (${cell.trades}t)` : 'No trades'}`}
                  >
                    {isBlocked ? (
                      <Ban size={10} className="text-[#C1502E]" />
                    ) : hasTrades ? (
                      <span className="font-bold">
                        {pnl > 0 ? '+' : pnl < 0 ? '-' : '0'}
                      </span>
                    ) : (
                      <span className="text-[#262B30]">·</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Slot Drill-Down & Rule Enforcer */}
      {selectedSlot ? (
        <div className="p-3 rounded-xl bg-[#131619] border border-[#262B30] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-[#C9A227]" />
            <div>
              <span className="font-bold text-[#EDEAE3]">{selectedSlot.day} @ {selectedSlot.hour}:00 UTC</span>
              <span className="text-[#8B8D91] ml-2">
                P&amp;L: <strong className={selectedSlot.pnl >= 0 ? 'text-[#3FA88C]' : 'text-[#C1502E]'}>
                  {selectedSlot.pnl >= 0 ? '+' : ''}${selectedSlot.pnl}
                </strong> ({selectedSlot.trades} trades, {selectedSlot.trades > 0 ? Math.round((selectedSlot.wins / selectedSlot.trades) * 100) : 0}% win rate)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleBlockSlot(selectedSlot.slotKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                blockedSlots.includes(selectedSlot.slotKey)
                  ? 'bg-[#1B1F23] hover:bg-[#262B30] text-[#EDEAE3]'
                  : 'bg-[#C1502E] hover:bg-[#E46868] text-white'
              }`}
            >
              <Ban size={13} />
              {blockedSlots.includes(selectedSlot.slotKey) ? 'Unblock Slot' : 'Block Trading in This Slot'}
            </button>
            <button
              onClick={() => setSelectedSlot(null)}
              className="text-[#8B8D91] hover:text-[#EDEAE3] px-2 py-1"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-[#8B8D91] pt-2 border-t border-[#1E2226]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#152E25] border border-[#1F4A40]" /> Profitable Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#2E1815] border border-[#4A2A1E]" /> Loss-Generating Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#4A2A1E] border border-[#C1502E]" /> Blocked / Restricted Slot
            </span>
          </div>
          <span className="text-[#5A5D61]">Click any cell for details · Double-click to toggle block</span>
        </div>
      )}
    </div>
  );
}
