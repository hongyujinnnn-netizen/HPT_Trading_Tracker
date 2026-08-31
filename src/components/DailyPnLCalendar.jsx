import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from './Pill';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function DailyPnLCalendar({ trades = [] }) {
  const { setSelectedTrade } = useTrade();

  // Default to current date or month of latest trade
  const [currentDate, setCurrentDate] = useState(() => {
    if (trades.length > 0) {
      const dates = trades.map((t) => new Date(t.date || t.timestamp)).filter((d) => !isNaN(d));
      if (dates.length > 0) {
        const latest = new Date(Math.max(...dates));
        return new Date(latest.getFullYear(), latest.getMonth(), 1);
      }
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDayRecap, setSelectedDayRecap] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map trades by 'YYYY-MM-DD' => list of trades
  const dailyTradesMap = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      if (!t.date && !t.timestamp) return;
      const dateStr = (t.date || t.timestamp).split('T')[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(t);
    });
    return map;
  }, [trades]);

  // Calculate calendar grid days
  const { daysInMonth, firstDayIndex, calendarDays } = useMemo(() => {
    const daysCount = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun

    const days = [];
    // Padding empty cells before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push({ empty: true, key: `empty-${i}` });
    }

    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrades = dailyTradesMap[dateStr] || [];
      const hasTrade = dayTrades.length > 0;
      const pnl = dayTrades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);

      days.push({
        empty: false,
        dayNumber: d,
        dateStr,
        hasTrade,
        pnl,
        dayTrades,
        key: `day-${d}`,
      });
    }

    return { daysInMonth: daysCount, firstDayIndex: firstDay, calendarDays: days };
  }, [year, month, dailyTradesMap]);

  return (
    <div className="terminal-card p-5 space-y-4 select-none">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
            Daily P&amp;L Calendar
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {MONTH_NAMES[month]} {year} · <span className="text-[#3FA88C] font-semibold">green = profit</span>, <span className="text-[#FB7185] font-semibold">red = loss</span>
          </p>
        </div>

        <div
          className="flex items-center gap-1 p-1 rounded-xl border shadow-inner transition-colors"
          style={{
            background: 'var(--color-elevated)',
            borderColor: 'var(--color-border-soft)',
          }}
        >
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Previous Month"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2.5 text-xs font-mono-num font-bold text-[#E5B83B]">
            {MONTH_SHORT[month]}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Next Month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold" style={{ color: 'var(--color-text-dim)' }}>
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((cell) => {
          if (cell.empty) {
            return <div key={cell.key} className="h-16 rounded-lg bg-transparent" />;
          }

          const { dayNumber, hasTrade, pnl, dayTrades, dateStr } = cell;

          let cellClass = 'calendar-day-slot';
          let pnlText = '—';
          let pnlColor = 'opacity-40';

          if (hasTrade) {
            if (pnl > 0) {
              cellClass = 'calendar-day-profit cursor-pointer hover:scale-[1.02]';
              pnlText = `+$${Math.round(pnl)}`;
              pnlColor = 'font-extrabold';
            } else if (pnl < 0) {
              cellClass = 'calendar-day-loss cursor-pointer hover:scale-[1.02]';
              pnlText = `-$${Math.abs(Math.round(pnl))}`;
              pnlColor = 'font-extrabold';
            } else {
              cellClass = 'calendar-day-breakeven cursor-pointer hover:scale-[1.02]';
              pnlText = '$0';
              pnlColor = 'font-semibold';
            }
          }

          return (
            <div
              key={cell.key}
              onClick={() => {
                if (hasTrade) {
                  setSelectedDayRecap({ dateStr, dayNumber, pnl, dayTrades });
                }
              }}
              className={`h-16 p-2 rounded-lg flex flex-col justify-between transition-all ${cellClass}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-mono-num opacity-70 leading-none">
                  {dayNumber}
                </span>
                {hasTrade && (
                  <span className="text-[9px] px-1 rounded bg-black/30 font-mono-num opacity-80">
                    {dayTrades.length}t
                  </span>
                )}
              </div>
              <span className={`text-xs font-mono-num text-center leading-none ${pnlColor}`}>
                {pnlText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Selected Day Drill-down Modal */}
      {selectedDayRecap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl transition-colors"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border-dark)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-[#C9A227]" />
                <div>
                  <h3 className="text-sm font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
                    {selectedDayRecap.dateStr} Recap
                  </h3>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {selectedDayRecap.dayTrades.length} total trade(s) logged
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Pill tone={selectedDayRecap.pnl >= 0 ? 'profit' : 'loss'}>
                  {selectedDayRecap.pnl >= 0 ? '+' : ''}${selectedDayRecap.pnl.toFixed(2)}
                </Pill>
                <button
                  onClick={() => setSelectedDayRecap(null)}
                  className="p-1 rounded-lg transition-colors hover:opacity-80"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Trades list for the day */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {selectedDayRecap.dayTrades.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTrade(t);
                    setSelectedDayRecap(null);
                  }}
                  className="p-3 rounded-xl border hover:border-[#C9A227] cursor-pointer flex items-center justify-between text-xs transition-all group"
                  style={{
                    background: 'var(--color-elevated)',
                    borderColor: 'var(--color-border-soft)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Pill tone={t.side === 'Buy' ? 'profit' : 'loss'}>{t.side}</Pill>
                    <div>
                      <div className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-text-main)' }}>
                        <span>{t.strategy}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>({t.session})</span>
                      </div>
                      <div className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-muted)' }}>
                        @{t.entryPrice} → @{t.exitPrice} ({t.lotSize} lots)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono-num">
                    <span className={`font-bold ${t.pnl >= 0 ? 'text-[#3FA88C]' : 'text-[#FB7185]'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl}
                    </span>
                    <ArrowRight size={13} className="text-[#5A5D61] group-hover:text-[#C9A227] transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

