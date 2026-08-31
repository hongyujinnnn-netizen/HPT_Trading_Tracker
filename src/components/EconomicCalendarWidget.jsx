import React, { useState, useEffect } from 'react';
import { ShieldAlert, Calendar, Loader2 } from 'lucide-react';
import { Pill } from './Pill';
import { SectionLabel } from './SectionLabel';
import { getEconomicEvents } from '../lib/economicEvents';

/**
 * Compact widget listing upcoming/recent economic events from Supabase
 * (today ±3 days). Reuses Pill + SectionLabel and matches MarketNews.jsx palette.
 *
 * When the economic_events table is empty (Edge Function not yet deployed),
 * renders an empty state instead of crashing.
 */
export function EconomicCalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      // Start from beginning of today to exclude past days (e.g. 27 Aug)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = new Date(now);
      to.setDate(to.getDate() + 7);

      const rows = await getEconomicEvents({
        from: startOfToday.toISOString(),
        to: to.toISOString(),
      });

      if (!cancelled) {
        setEvents(rows || []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /** Map impact string → Pill tone (case-insensitive). */
  function impactTone(impact) {
    const lower = String(impact).toLowerCase();
    if (lower === 'high') return 'loss';     // red
    if (lower === 'medium') return 'warning'; // orange/gold
    return 'neutral';                         // gray
  }

  /** Readable short label from impact value. */
  function impactLabel(impact) {
    const lower = String(impact).toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1); // 'high' → 'High'
  }

  /** Format event_time → e.g. "Aug 05 · 12:30 UTC" */
  function formatTime(isoStr) {
    try {
      const d = new Date(isoStr);
      const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${month} ${day} · ${hh}:${mm} UTC`;
    } catch {
      return isoStr;
    }
  }

  return (
    <div className="terminal-card p-5 space-y-4">
      <SectionLabel right={<Pill tone="neutral"><ShieldAlert size={11} /> Live DB</Pill>}>
        Upcoming Economic Releases
      </SectionLabel>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#8B8D91]">
          <Loader2 size={14} className="animate-spin" />
          Loading economic events…
        </div>
      ) : events.length === 0 ? (
        /* ── Empty state ─────────────────────────────────── */
        <div className="py-8 text-center space-y-2">
          <Calendar size={28} className="mx-auto text-[#5A5D61]" />
          <p className="text-sm text-[#8B8D91] font-display">
            No high-impact events in range
          </p>
          <p className="text-xs text-[#5A5D61]">
            The <code className="text-[#C9A227]">economic_events</code> table
            is empty — the Edge Function hasn't populated it yet.
          </p>
        </div>
      ) : (
        /* ── Event list ──────────────────────────────────── */
        <div className="divide-y divide-slate-200 dark:divide-[#262B30]">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-start gap-4">
                <span className="text-xs font-mono-num text-slate-500 dark:text-[#8B8D91] w-[130px] shrink-0 pt-0.5">
                  {formatTime(ev.event_time)}
                </span>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold font-display" style={{ color: 'var(--color-text-main)' }}>
                      {ev.title}
                    </span>
                    <Pill tone={impactTone(ev.impact)}>
                      {impactLabel(ev.impact)}
                    </Pill>
                    {ev.currency && (
                      <span className="text-[10px] font-mono-num" style={{ color: 'var(--color-text-dim)' }}>
                        {ev.currency}
                      </span>
                    )}
                  </div>
                  {ev.note && (
                    <p className="text-xs font-body max-w-xl" style={{ color: 'var(--color-text-muted)' }}>
                      {ev.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
