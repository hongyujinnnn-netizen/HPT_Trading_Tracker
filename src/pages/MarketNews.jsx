import React from 'react';
import { Newspaper, Flame, Clock, AlertTriangle, ShieldAlert, Zap } from 'lucide-react';
import { ECONOMIC_EVENTS } from '../utils/newsCalendar';
import { Pill } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';

export function MarketNews() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Gold Market &amp; Economic Calendar Tracker</h1>
        <p className="text-xs text-[#8B8D91]">
          High &amp; medium impact USD economic releases directly driving XAU/USD volatility and news gambling alerts
        </p>
      </div>

      {/* Volatility Overview Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="terminal-card p-4 flex items-center justify-between border-l-4 border-l-[#3FA88C]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#8B8D91]">XAU/USD Spot Price</span>
            <div className="text-xl font-bold font-mono-num text-[#EDEAE3]">$2,431.20</div>
          </div>
          <Zap size={20} className="text-[#3FA88C]" />
        </div>

        <div className="terminal-card p-4 flex items-center justify-between border-l-4 border-l-[#C9A227]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#8B8D91]">Live Average Spread</span>
            <div className="text-xl font-bold font-mono-num text-[#C9A227]">0.28 points</div>
          </div>
          <Flame size={20} className="text-[#C9A227]" />
        </div>

        <div className="terminal-card p-4 flex items-center justify-between border-l-4 border-l-[#C1502E]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#8B8D91]">News Volatility Status</span>
            <div className="text-xl font-bold font-display text-[#C1502E]">ELEVATED</div>
          </div>
          <AlertTriangle size={20} className="text-[#C1502E]" />
        </div>
      </div>

      {/* Economic Calendar List */}
      <div className="terminal-card p-5 space-y-4">
        <SectionLabel right={<Pill tone="loss"><ShieldAlert size={11} /> Auto-Audited</Pill>}>
          Seeded High-Impact USD Economic Calendar
        </SectionLabel>

        <div className="divide-y divide-[#1E2226]">
          {ECONOMIC_EVENTS.map((event) => {
            const isHigh = event.impact === 'High';
            return (
              <div key={event.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-mono-num text-[#8B8D91] w-20 pt-0.5">{event.timeLabel}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold font-display text-[#EDEAE3]">{event.title}</span>
                      <Pill tone={isHigh ? 'loss' : 'warning'}>{event.impact}</Pill>
                    </div>
                    <p className="text-xs text-[#8B8D91] font-body max-w-xl">{event.note}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono-num pl-24 sm:pl-0">
                  <div>
                    <span className="text-[#5A5D61] block text-[10px]">FORECAST</span>
                    <span className="text-[#EDEAE3] font-semibold">{event.forecast}</span>
                  </div>
                  <div>
                    <span className="text-[#5A5D61] block text-[10px]">PREVIOUS</span>
                    <span className="text-[#8B8D91]">{event.previous}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
