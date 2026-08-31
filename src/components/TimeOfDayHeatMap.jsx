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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
        <div>
          <SectionLabel right={
            blockedSlots.length > 0 ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold flex items-center gap-1 bg-rose-500/15 text-rose-700 dark:bg-[#4A2A1E] dark:text-[#C1502E] border border-rose-500/30 dark:border-[#C1502E]/40">
                <Ban size={11} /> {blockedSlots.length} Trading Slot(s) Blocked
              </span>
            ) : null
          }>
            Time-of-Day &amp; Session Heat Map
          </SectionLabel>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Hourly P&amp;L performance across Monday–Friday to pinpoint profitable execution windows.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {matrixData.redSlots.length > 0 && (
            <button
              onClick={autoBlockRedSlots}
              className="px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-700 dark:text-[#C1502E] text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Automatically block hours that generated net losses"
            >
              <Ban size={12} /> Auto-Block {matrixData.redSlots.length} Red Slots
            </button>
          )}
          {blockedSlots.length > 0 && (
            <button
              onClick={clearBlockedSlots}
              className="px-2.5 py-1 rounded border text-[11px] font-semibold hover:opacity-80 transition-colors"
              style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
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
          <div className="grid grid-cols-25 gap-1 text-center text-[9px] font-mono-num pb-1" style={{ color: 'var(--color-text-dim)' }}>
            <div className="w-14 text-left font-bold">Day \ Hr</div>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="truncate">{h}h</div>
            ))}
          </div>

          {/* Weekday rows */}
          {matrixData.days.map((day) => (
            <div key={day} className="grid grid-cols-25 gap-1 items-center">
              <div className="w-14 text-xs font-semibold truncate font-display" style={{ color: 'var(--color-text-muted)' }}>
                {day.slice(0, 3)}
              </div>

              {Array.from({ length: 24 }, (_, hour) => {
                const cell = matrixData.matrix[day][hour];
                const slotKey = `${day}_${hour}`;
                const isBlocked = blockedSlots.includes(slotKey);
                const hasTrades = cell.trades > 0;
                const pnl = cell.pnl;

                // Color calculation
                let bgStyle = 'hover:border-amber-500/40';
                let inlineStyle = {
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border-soft)',
                  color: 'var(--color-text-dim)',
                };

                if (hasTrades) {
                  if (pnl > 0) {
                    bgStyle = `bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-[#3FA88C] hover:border-emerald-500`;
                    inlineStyle = undefined;
                  } else if (pnl < 0) {
                    bgStyle = `bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-[#C1502E] hover:border-rose-500`;
                    inlineStyle = undefined;
                  } else {
                    inlineStyle = {
                      background: 'var(--color-elevated)',
                      borderColor: 'var(--color-border-soft)',
                      color: 'var(--color-text-main)',
                    };
                  }
                }

                if (isBlocked) {
                  bgStyle = 'bg-rose-500/30 border-rose-500 text-rose-600 dark:text-[#C1502E] ring-1 ring-rose-500';
                  inlineStyle = undefined;
                }

                return (
                  <div
                    key={hour}
                    onClick={() => {
                      setSelectedSlot({ day, hour, ...cell, slotKey, isBlocked });
                    }}
                    onDoubleClick={() => toggleBlockSlot(slotKey)}
                    className={`h-7 rounded border cursor-pointer flex items-center justify-center text-[10px] font-mono-num transition-all hover:scale-105 relative group ${bgStyle}`}
                    style={inlineStyle}
                    title={`${day} ${hour}:00 UTC: ${hasTrades ? `${pnl >= 0 ? '+' : ''}$${Math.round(pnl)} (${cell.trades}t)` : 'No trades'}`}
                  >
                    {isBlocked ? (
                      <Ban size={10} className="text-rose-500" />
                    ) : hasTrades ? (
                      <span className="font-bold">
                        {pnl > 0 ? '+' : pnl < 0 ? '-' : '0'}
                      </span>
                    ) : (
                      <span className="opacity-30">·</span>
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
        <div className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-3">
            <Clock size={16} className="text-amber-500" />
            <div>
              <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>{selectedSlot.day} @ {selectedSlot.hour}:00 UTC</span>
              <span className="ml-2" style={{ color: 'var(--color-text-muted)' }}>
                P&amp;L: <strong className={selectedSlot.pnl >= 0 ? 'text-emerald-600 dark:text-[#3FA88C]' : 'text-rose-600 dark:text-[#C1502E]'}>
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
                  ? 'border hover:opacity-80'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
              }`}
              style={blockedSlots.includes(selectedSlot.slotKey) ? { background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' } : undefined}
            >
              <Ban size={13} />
              {blockedSlots.includes(selectedSlot.slotKey) ? 'Unblock Slot' : 'Block Trading in This Slot'}
            </button>
            <button
              onClick={() => setSelectedSlot(null)}
              className="hover:opacity-80 px-2 py-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] pt-2 border-t" style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40" /> Profitable Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/40" /> Loss-Generating Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-500" /> Blocked / Restricted Slot
            </span>
          </div>
          <span style={{ color: 'var(--color-text-dim)' }}>Click any cell for details · Double-click to toggle block</span>
        </div>
      )}
    </div>
  );
}
