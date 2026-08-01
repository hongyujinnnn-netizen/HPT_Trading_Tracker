import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  // Default to July 2026 or month of latest trade
  const [currentDate, setCurrentDate] = useState(() => {
    if (trades.length > 0) {
      const dates = trades.map((t) => new Date(t.date || t.timestamp)).filter((d) => !isNaN(d));
      if (dates.length > 0) {
        const latest = new Date(Math.max(...dates));
        return new Date(latest.getFullYear(), latest.getMonth(), 1);
      }
    }
    return new Date(2026, 6, 1); // July 2026
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map trades by 'YYYY-MM-DD' => total daily P&L
  const dailyPnLMap = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      if (!t.date) return;
      const dateStr = t.date.split('T')[0];
      map[dateStr] = (map[dateStr] || 0) + (t.pnl || 0);
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
      const hasTrade = Object.prototype.hasOwnProperty.call(dailyPnLMap, dateStr);
      const pnl = dailyPnLMap[dateStr] || 0;

      days.push({
        empty: false,
        dayNumber: d,
        dateStr,
        hasTrade,
        pnl,
        key: `day-${d}`,
      });
    }

    return { daysInMonth: daysCount, firstDayIndex: firstDay, calendarDays: days };
  }, [year, month, dailyPnLMap]);

  return (
    <div className="terminal-card p-5 space-y-4 select-none">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-display text-[#EDEAE3]">Daily P&amp;L Calendar</h3>
          <p className="text-xs text-[#8B8D91]">
            {MONTH_NAMES[month]} {year} · <span className="text-[#3FA88C]">green = profit day</span>, <span className="text-[#C1502E]">red = loss day</span>
          </p>
        </div>

        <div className="flex items-center gap-1 bg-[#131619] p-1 rounded-lg border border-[#262B30]">
          <button
            onClick={handlePrevMonth}
            className="p-1 text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1B1F23] rounded transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 text-xs font-mono-num font-bold text-[#C9A227]">
            {MONTH_SHORT[month]}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1B1F23] rounded transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-[#5A5D61]">
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

          const { dayNumber, hasTrade, pnl } = cell;

          let bgStyle = 'bg-[#131619] border-[#1E2226] text-[#5A5D61]';
          let pnlText = '—';
          let pnlColor = 'text-[#5A5D61]';

          if (hasTrade) {
            if (pnl > 0) {
              bgStyle = 'bg-[#152E25] border-[#1F4A40] text-[#3FA88C] shadow-inner';
              pnlText = `+${Math.round(pnl)}`;
              pnlColor = 'text-[#3FA88C] font-extrabold';
            } else if (pnl < 0) {
              bgStyle = 'bg-[#2E1815] border-[#4A2A1E] text-[#C1502E] shadow-inner';
              pnlText = `${Math.round(pnl)}`;
              pnlColor = 'text-[#C1502E] font-extrabold';
            } else {
              bgStyle = 'bg-[#1B1F23] border-[#262B30] text-[#8B8D91]';
              pnlText = '$0';
              pnlColor = 'text-[#8B8D91] font-semibold';
            }
          }

          return (
            <div
              key={cell.key}
              className={`h-16 p-2 rounded-lg border flex flex-col justify-between transition-all ${bgStyle}`}
            >
              <span className="text-[11px] font-mono-num text-[#8B8D91] self-start leading-none">
                {dayNumber}
              </span>
              <span className={`text-xs font-mono-num text-center leading-none ${pnlColor}`}>
                {pnlText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
