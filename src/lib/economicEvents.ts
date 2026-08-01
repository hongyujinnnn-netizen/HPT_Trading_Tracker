/**
 * Data-access layer for the `public.economic_events` Supabase table.
 *
 * DB schema (verified live 2026-08-01):
 *   id          uuid
 *   event_time  timestamptz
 *   title       text
 *   currency    text  (default 'USD')
 *   impact      news_impact enum — lowercase values: 'high' | 'medium' | 'low'
 *   note        text | null
 *   created_at  timestamptz
 */

import { supabase } from '../services/supabaseClient';

// ── Types ────────────────────────────────────────────────────────────

/** Mirrors the exact column names in public.economic_events. */
export interface DbEconomicEvent {
  id: string;
  event_time: string;
  title: string;
  currency: string;
  impact: string;   // 'high' | 'medium' | 'low' (lowercase in DB)
  note: string | null;
}

// ── Queries ──────────────────────────────────────────────────────────

/**
 * Fetch economic events whose event_time falls between `from` and `to`.
 * Results are ordered by event_time ascending.
 */
export async function getEconomicEvents({
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<DbEconomicEvent[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('economic_events')
    .select('id, event_time, title, currency, impact, note')
    .gte('event_time', from)
    .lte('event_time', to)
    .order('event_time', { ascending: true });

  if (error) {
    console.error('[economicEvents] query error:', error);
    return [];
  }

  return (data ?? []) as DbEconomicEvent[];
}

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Determines whether a trade's entry time falls within ±windowMinutes
 * of any high-impact economic event.
 *
 * @param tradeEntryTime  ISO-8601 string or Date
 * @param events          Array of DbEconomicEvent rows
 * @param windowMinutes   Half-window size in minutes (default 30)
 * @returns               `{ isNear, event? }` — the first matching event, if any
 */
export function isNearHighImpactEvent(
  tradeEntryTime: string | Date,
  events: DbEconomicEvent[],
  windowMinutes: number = 30,
): { isNear: boolean; event?: DbEconomicEvent } {
  if (!tradeEntryTime || !events || events.length === 0) {
    return { isNear: false };
  }

  const tradeMs = new Date(tradeEntryTime).getTime();
  if (Number.isNaN(tradeMs)) return { isNear: false };

  const windowMs = windowMinutes * 60 * 1000;

  for (const ev of events) {
    // Case-insensitive comparison — DB stores 'high' but guard against 'High' too
    if (String(ev.impact).toLowerCase() !== 'high') continue;

    const eventMs = new Date(ev.event_time).getTime();
    if (Number.isNaN(eventMs)) continue;

    if (Math.abs(tradeMs - eventMs) <= windowMs) {
      return { isNear: true, event: ev };
    }
  }

  return { isNear: false };
}
