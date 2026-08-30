import React, { useState, useEffect, useMemo } from 'react';
import { Newspaper, Flame, Clock, AlertTriangle, ShieldAlert, Zap, Loader2, Calendar, Filter, CheckCircle2 } from 'lucide-react';
import { ECONOMIC_EVENTS } from '../utils/newsCalendar';
import { Pill } from '../components/Pill';
import { SectionLabel } from '../components/SectionLabel';
import { getEconomicEvents } from '../lib/economicEvents';

export function MarketNews() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [filterTab, setFilterTab] = useState('upcoming'); // 'upcoming' | 'today' | 'week' | 'all'

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

  // Fetch only upcoming / today's releases — strictly excluding old/past dates (e.g. 27 Aug when today is 30 Aug)
  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      const now = new Date();
      // Start from beginning of today (00:00:00 local time) so past days (e.g. 27 Aug) are removed
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const to = new Date(now);
      to.setDate(to.getDate() + 21); // Next 3 weeks of economic releases

      const dbRows = await getEconomicEvents({
        from: startOfToday.toISOString(),
        to: to.toISOString(),
      });

      if (!cancelled) {
        if (dbRows && dbRows.length > 0) {
          setEvents(dbRows);
          setIsLive(true);
        } else {
          // If DB is empty, shift seeded events to start from today onwards so they are current
          const shiftedSeeded = ECONOMIC_EVENTS.map((ev, index) => {
            const d = new Date(now);
            d.setDate(d.getDate() + index);
            d.setHours(12 + (index % 6), 30, 0, 0);
            return {
              ...ev,
              id: `seeded_${index}`,
              event_time: d.toISOString(),
              timestamp: d.toISOString(),
            };
          });
          setEvents(shiftedSeeded);
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

  // Filter events based on active tab: strictly removing old news by default
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfTodayMs = startOfTodayMs + 24 * 60 * 60 * 1000;
    const endOfWeekMs = startOfTodayMs + 7 * 24 * 60 * 60 * 1000;

    return events.filter((event) => {
      const raw = event.event_time || event.timestamp;
      if (!raw) return true;
      const eventMs = new Date(raw).getTime();
      if (isNaN(eventMs)) return true;

      if (filterTab === 'upcoming') {
        // Remove old news (any event before today, e.g. 27 Aug when today is 30 Aug)
        return eventMs >= startOfTodayMs;
      }
      if (filterTab === 'today') {
        // Today's releases only
        return eventMs >= startOfTodayMs && eventMs < endOfTodayMs;
      }
      if (filterTab === 'week') {
        // Releases in next 7 days
        return eventMs >= startOfTodayMs && eventMs < endOfWeekMs;
      }
      return true; // 'all'
    });
  }, [events, filterTab]);

  function impactTone(impact) {
    const lower = String(impact).toLowerCase();
    if (lower === 'high') return 'loss';
    if (lower === 'medium') return 'warning';
    return 'neutral';
  }

  function formatTimeLabel(event) {
    const tz = 'Asia/Bangkok'; // UTC+7
    try {
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

  function getEventStatusBadge(event) {
    const raw = event.event_time || event.timestamp;
    if (!raw) return null;
    const eventMs = new Date(raw).getTime();
    if (isNaN(eventMs)) return null;

    const nowMs = Date.now();
    const diffMs = eventMs - nowMs;

    const now = new Date();
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfTodayMs = startOfTodayMs + 24 * 60 * 60 * 1000;

    const isToday = eventMs >= startOfTodayMs && eventMs < endOfTodayMs;

    if (diffMs > 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (isToday) {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 font-bold flex items-center gap-1">
            <Clock size={10} /> Today in {hours}h {mins}m
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#131619] text-[#8B8D91] border border-[#262B30] font-semibold">
          Upcoming
        </span>
      );
    } else {
      if (isToday) {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#152E25] text-[#3FA88C] border border-[#3FA88C]/40 font-bold flex items-center gap-1">
            <CheckCircle2 size={10} /> Released Today
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono-num bg-[#1B1F23] text-[#5A5D61] border border-[#262B30]">
          Passed
        </span>
      );
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">Gold Market &amp; Economic Calendar Tracker</h1>
        <p className="text-xs text-[#8B8D91]">
          Real-time high &amp; medium impact USD economic releases. Filtered to display upcoming releases only (past events removed).
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262B30] pb-3">
          <div>
            <SectionLabel
              right={
                <Pill tone={isLive ? 'profit' : 'loss'}>
                  <ShieldAlert size={11} /> {isLive ? 'Live DB Feed' : 'Seeded Feed'}
                </Pill>
              }
            >
              Economic Calendar Releases (USD)
            </SectionLabel>
            <p className="text-xs text-[#8B8D91] mt-0.5">
              Showing <strong className="text-[#C9A227] font-mono-num">{filteredEvents.length}</strong> active release event(s)
            </p>
          </div>

          {/* Release Filter Tabs */}
          <div className="flex items-center bg-[#131619] p-1 rounded-lg border border-[#262B30] text-xs">
            {[
              { id: 'upcoming', label: 'Upcoming Releases' },
              { id: 'today', label: 'Today Only' },
              { id: 'week', label: 'Next 7 Days' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  filterTab === tab.id
                    ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 shadow-sm'
                    : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#8B8D91]">
            <Loader2 size={14} className="animate-spin text-[#C9A227]" />
            Loading calendar events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Calendar size={28} className="mx-auto text-[#5A5D61]" />
            <p className="text-sm text-[#8B8D91] font-display">
              No upcoming economic releases found for this filter.
            </p>
            <p className="text-xs text-[#5A5D61]">
              Past releases (like earlier dates this week) have been filtered out to keep your execution focus clean.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E2226]">
            {[...filteredEvents].sort((a, b) => {
              const tA = new Date(a.event_time || a.timestamp || 0).getTime();
              const tB = new Date(b.event_time || b.timestamp || 0).getTime();
              return tA - tB;
            }).map((event) => {
              const impact = event.impact || 'low';
              const title = event.title;
              const note = event.note;
              const currency = event.currency;

              return (
                <div key={event.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#1B1F23]/30 px-2 rounded-lg transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-1 w-32 shrink-0 pt-0.5">
                      <span className="text-xs font-mono-num text-[#8B8D91]">
                        {formatTimeLabel(event)}
                      </span>
                      <div>
                        {getEventStatusBadge(event)}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold font-display text-[#EDEAE3]">{title}</span>
                        <Pill tone={impactTone(impact)}>{String(impact).toUpperCase()}</Pill>
                        {currency && <span className="text-[10px] font-mono-num text-[#5A5D61]">{currency}</span>}
                      </div>
                      {note && <p className="text-xs text-[#8B8D91] font-body max-w-xl leading-relaxed">{note}</p>}
                    </div>
                  </div>

                  {(event.forecast || event.previous) && (
                    <div className="flex items-center gap-4 text-xs font-mono-num pl-36 sm:pl-0 shrink-0">
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
