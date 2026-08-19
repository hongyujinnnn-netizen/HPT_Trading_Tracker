import React, { useState, useEffect } from 'react';
import { Newspaper, Flame, Clock, AlertTriangle, ShieldAlert, Zap, Loader2 } from 'lucide-react';
import { ECONOMIC_EVENTS } from '../utils/newsCalendar';
import { Pill } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';
import { getEconomicEvents } from '../lib/economicEvents';

export function MarketNews() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const [goldPrice, setGoldPrice] = useState(4043.70);
  const [spread, setSpread] = useState(0.28);
  const [volatility, setVolatility] = useState('Elevated');

  // Fetch live XAU/USD spot price from gold-api / CoinGecko
  useEffect(() => {
    async function fetchLiveGold() {
      try {
        const res = await fetch('https://api.gold-api.com/price/XAU');
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.price === 'number') {
            setGoldPrice(parseFloat(data.price.toFixed(2)));
            setSpread(parseFloat((data.price * 0.0001).toFixed(2)));
            return;
          }
        }
      } catch (_e) {}

      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true',
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data['pax-gold'] && typeof data['pax-gold'].usd === 'number') {
            setGoldPrice(parseFloat(data['pax-gold'].usd.toFixed(2)));
            const change = data['pax-gold'].usd_24h_change || 0;
            if (Math.abs(change) > 1.0) setVolatility('HIGH');
            return;
          }
        }
      } catch (_e) {}
    }

    fetchLiveGold();
    const interval = setInterval(fetchLiveGold, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      const to = new Date(now);
      to.setDate(to.getDate() + 14);

      const dbRows = await getEconomicEvents({
        from: from.toISOString(),
        to: to.toISOString(),
      });

      if (!cancelled) {
        if (dbRows && dbRows.length > 0) {
          setEvents(dbRows);
          setIsLive(true);
        } else {
          // Fallback to seeded static calendar if DB is not populated yet
          setEvents(ECONOMIC_EVENTS);
          setIsLive(false);
        }
        setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  function impactTone(impact) {
    const lower = String(impact).toLowerCase();
    if (lower === 'high') return 'loss';
    if (lower === 'medium') return 'warning';
    return 'neutral';
  }

  function formatTimeLabel(event) {
    const tz = 'Asia/Bangkok'; // UTC+7
    try {
      // Prefer event_time (ISO from DB), fall back to timestamp (seeded data)
      const raw = event.event_time || event.timestamp;
      if (!raw) return event.timeLabel || '';
      const d = new Date(raw);
      if (isNaN(d.getTime())) return event.timeLabel || '';
      const month = d.toLocaleString('en-US', { month: 'short', timeZone: tz });
      const day = String(d.toLocaleString('en-US', { day: '2-digit', timeZone: tz })).padStart(2, '0');
      const hh = String(d.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: tz })).padStart(2, '0');
      const mm = String(d.toLocaleString('en-US', { minute: '2-digit', timeZone: tz })).padStart(2, '0');
      return `${month} ${day} · ${hh}:${mm} UTC+7`;
    } catch {
      return event.timeLabel || '';
    }
  }

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
            <div className="text-xl font-bold font-mono-num text-[#EDEAE3]">
              ${goldPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <Zap size={20} className="text-[#3FA88C] animate-pulse" />
        </div>

        <div className="terminal-card p-4 flex items-center justify-between border-l-4 border-l-[#C9A227]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#8B8D91]">Live Average Spread</span>
            <div className="text-xl font-bold font-mono-num text-[#C9A227]">{spread} points</div>
          </div>
          <Flame size={20} className="text-[#C9A227]" />
        </div>

        <div className="terminal-card p-4 flex items-center justify-between border-l-4 border-l-[#C1502E]">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#8B8D91]">News Volatility Status</span>
            <div className="text-xl font-bold font-display text-[#C1502E]">{volatility.toUpperCase()}</div>
          </div>
          <AlertTriangle size={20} className="text-[#C1502E]" />
        </div>
      </div>

      {/* Economic Calendar List */}
      <div className="terminal-card p-5 space-y-4">
        <SectionLabel
          right={
            <Pill tone={isLive ? 'profit' : 'loss'}>
              <ShieldAlert size={11} /> {isLive ? 'Live DB Feed' : 'Seeded Static Data'}
            </Pill>
          }
        >
          {isLive ? 'High-Impact USD Economic Releases (Supabase)' : 'Seeded High-Impact USD Economic Calendar'}
        </SectionLabel>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#8B8D91]">
            <Loader2 size={14} className="animate-spin text-[#C9A227]" />
            Loading calendar events...
          </div>
        ) : (
          <div className="divide-y divide-[#1E2226]">
            {[...events].sort((a, b) => {
              const tA = new Date(a.event_time || a.timestamp || 0).getTime();
              const tB = new Date(b.event_time || b.timestamp || 0).getTime();
              return tA - tB;
            }).map((event) => {
              const impact = event.impact || 'low';
              const title = event.title;
              const note = event.note;
              const currency = event.currency;

              return (
                <div key={event.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <span className="text-xs font-mono-num text-[#8B8D91] w-28 shrink-0 pt-0.5">
                      {formatTimeLabel(event)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold font-display text-[#EDEAE3]">{title}</span>
                        <Pill tone={impactTone(impact)}>{String(impact).toUpperCase()}</Pill>
                        {currency && <span className="text-[10px] font-mono-num text-[#5A5D61]">{currency}</span>}
                      </div>
                      {note && <p className="text-xs text-[#8B8D91] font-body max-w-xl">{note}</p>}
                    </div>
                  </div>

                  {(event.forecast || event.previous) && (
                    <div className="flex items-center gap-4 text-xs font-mono-num pl-28 sm:pl-0">
                      {event.forecast && (
                        <div>
                          <span className="text-[#5A5D61] block text-[10px]">FORECAST</span>
                          <span className="text-[#EDEAE3] font-semibold">{event.forecast}</span>
                        </div>
                      )}
                      {event.previous && (
                        <div>
                          <span className="text-[#5A5D61] block text-[10px]">PREVIOUS</span>
                          <span className="text-[#8B8D91]">{event.previous}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
