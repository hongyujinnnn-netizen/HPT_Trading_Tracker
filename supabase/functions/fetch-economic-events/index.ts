/**
 * Supabase Edge Function: fetch-economic-events
 *
 * Fetches real-time USD economic calendar releases from FairEconomy (Forex Factory)
 * and upserts them into the `public.economic_events` table.
 *
 * Live DB schema (verified 2026-08-01):
 *   id          uuid          (auto — gen_random_uuid())
 *   event_time  timestamptz   (required)
 *   title       text          (required)
 *   currency    text          (default 'USD')
 *   impact      news_impact   ('low' | 'medium' | 'high')
 *   note        text          (nullable)
 *   created_at  timestamptz   (auto — now())
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface FairEconomyEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast?: string;
  previous?: string;
}

function mapImpact(raw: string): 'high' | 'medium' | 'low' {
  const lower = (raw || '').toLowerCase().trim();
  if (lower === 'high') return 'high';
  if (lower === 'medium') return 'medium';
  return 'low';
}

function buildNote(ev: FairEconomyEvent): string | null {
  const parts: string[] = [];
  if (ev.forecast) parts.push(`Forecast: ${ev.forecast}`);
  if (ev.previous) parts.push(`Previous: ${ev.previous}`);
  return parts.length > 0 ? parts.join(' | ') : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let rawEvents: FairEconomyEvent[] = [];
  let fetchError: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      fetchError = `FairEconomy API returned HTTP ${res.status}`;
    } else {
      const data = await res.json();
      if (Array.isArray(data)) {
        rawEvents = data;
      } else {
        fetchError = 'FairEconomy returned non-array payload';
      }
    }
  } catch (err: any) {
    fetchError = `Fetch failed: ${err.message}`;
  }

  if (fetchError) {
    console.error(`[fetch-economic-events] ${fetchError}`);
    return new Response(JSON.stringify({ ok: false, error: fetchError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 502,
    });
  }

  // Filter for USD events only
  const usdEvents = rawEvents.filter(
    (ev) => (ev.country || '').toUpperCase() === 'USD',
  );

  const dbRows = usdEvents.map((ev) => ({
    event_time: ev.date,
    title: ev.title || 'Economic Release',
    currency: 'USD',
    impact: mapImpact(ev.impact),
    note: buildNote(ev),
  }));

  if (dbRows.length > 0) {
    // Refresh current week's events
    const dates = dbRows
      .map((r) => new Date(r.event_time).getTime())
      .filter((t) => !isNaN(t));

    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates)).toISOString();
      const maxDate = new Date(Math.max(...dates)).toISOString();

      await supabase
        .from('economic_events')
        .delete()
        .gte('event_time', minDate)
        .lte('event_time', maxDate);
    }

    const BATCH_SIZE = 50;
    let inserted = 0;
    for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
      const batch = dbRows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('economic_events')
        .insert(batch)
        .select('id');

      if (!error && data) {
        inserted += data.length;
      }
    }

    const responsePayload = {
      ok: true,
      source: 'FairEconomy (Forex Factory)',
      fetched: rawEvents.length,
      usd_filtered: usdEvents.length,
      inserted,
      captured_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  return new Response(
    JSON.stringify({ ok: true, message: 'No USD events found in feed.' }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    },
  );
});
