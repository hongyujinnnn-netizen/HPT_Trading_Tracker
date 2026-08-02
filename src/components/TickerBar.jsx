import React, { useState, useEffect } from 'react';
import { TrendingUp, Bell, Zap, Cloud, Sparkles, LogOut, Activity, AlertTriangle, Radio, Clock, Menu, X } from 'lucide-react';
import { Pill } from './Pill';
import { useTrade } from '../context/TradeContext';
import { tradeRepository } from '../services/tradeRepository';
import { supabase } from '../services/supabaseClient';
import { getCurrentGoldSession } from '../utils/sessionDetector';

export function TickerBar({ onToggleMobileMenu, mobileMenuOpen }) {
  const { userSession, signOut, isDemoMode } = useTrade();

  const [price, setPrice] = useState(2431.20);
  const [change, setChange] = useState(+0.42);
  const [spread, setSpread] = useState(0.28);
  const [volatility, setVolatility] = useState('Elevated');
  const [source, setSource] = useState('simulated'); // 'goldapi' | 'simulated' | 'unknown'
  const [capturedAt, setCapturedAt] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [staleMinutes, setStaleMinutes] = useState(0);

  const [currentSession, setCurrentSession] = useState(getCurrentGoldSession());
  const [utcTimeStr, setUtcTimeStr] = useState('');

  // Update UTC clock and session every minute
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentSession(getCurrentGoldSession(now));
      setUtcTimeStr(now.toISOString().substring(11, 16) + ' UTC');
    }
    updateClock();
    const clockInterval = setInterval(updateClock, 30000);
    return () => clearInterval(clockInterval);
  }, []);

  // Load initial snapshot or live API price and subscribe to Realtime updates
  useEffect(() => {
    let channel = null;

    async function fetchLiveGoldPrice() {
      try {
        const res = await fetch('https://api.gold-api.com/price/XAU');
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.price === 'number') {
            setPrice(parseFloat(data.price.toFixed(2)));
            setSource('goldapi');
            setIsStale(false);
            setCapturedAt(data.updatedAt || new Date().toISOString());
            return true;
          }
        }
      } catch (err) {
        console.warn('gold-api fetch warning:', err);
      }

      // Fallback to CoinGecko Pax Gold (1:1 fine troy oz of physical gold)
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true');
        if (res.ok) {
          const data = await res.json();
          if (data && data['pax-gold'] && typeof data['pax-gold'].usd === 'number') {
            setPrice(parseFloat(data['pax-gold'].usd.toFixed(2)));
            if (typeof data['pax-gold'].usd_24h_change === 'number') {
              setChange(parseFloat(data['pax-gold'].usd_24h_change.toFixed(2)));
            }
            setSource('goldapi');
            setIsStale(false);
            setCapturedAt(new Date().toISOString());
            return true;
          }
        }
      } catch (err) {
        console.warn('coingecko pax-gold fetch warning:', err);
      }

      return false;
    }

    async function loadSnapshot() {
      const initial = await tradeRepository.getLatestPriceSnapshot();
      if (initial) {
        updateSnapshotState(initial);
      } else {
        // Fetch direct live gold API price
        await fetchLiveGoldPrice();
      }
    }

    function updateSnapshotState(snapshot) {
      if (!snapshot) return;
      if (typeof snapshot.price === 'number') setPrice(snapshot.price);
      if (typeof snapshot.spread === 'number') setSpread(snapshot.spread);
      if (snapshot.volatility_level) setVolatility(snapshot.volatility_level);
      if (snapshot.source) setSource(snapshot.source);
      if (snapshot.captured_at) {
        setCapturedAt(snapshot.captured_at);
        checkStaleness(snapshot.captured_at);
      }
    }

    function checkStaleness(timestamp) {
      if (!timestamp) return;
      const ageMs = Date.now() - new Date(timestamp).getTime();
      const ageMins = Math.floor(ageMs / 60000);
      setStaleMinutes(ageMins);
      setIsStale(ageMs > 10 * 60 * 1000); // Staleness threshold: > 10 minutes
    }

    loadSnapshot();

    // Subscribe to Realtime INSERT events
    channel = tradeRepository.subscribeToGoldPrice((newSnapshot) => {
      updateSnapshotState(newSnapshot);
    });

    // Refresh base live price every 30 seconds
    const apiInterval = setInterval(async () => {
      const liveFetched = await fetchLiveGoldPrice();
      if (!liveFetched && capturedAt) {
        checkStaleness(capturedAt);
      }
    }, 30000);

    return () => {
      clearInterval(apiInterval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [capturedAt]);

  const renderSourceBadge = () => {
    if (isStale) {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#4A3A1E] text-[#E4C468] border border-[#C9A227]/40">
          <AlertTriangle size={12} /> Data Delayed ({staleMinutes}m ago)
        </span>
      );
    }
    if (source === 'goldapi') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#1F4A40]/60 text-[#3FA88C] border border-[#3FA88C]/40">
          <Radio size={12} className="animate-pulse" /> Live GoldAPI
        </span>
      );
    }
    if (source === 'simulated') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/30">
          <Sparkles size={12} /> Simulated Feed
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#1B1F23] text-[#8B8D91] border border-[#262B30]">
        <Activity size={12} /> Unknown Feed
      </span>
    );
  };

  return (
    <header className="flex items-center justify-between px-3 md:px-5 py-2.5 bg-[#1B1F23] border-b border-[#262B30]">
      <div className="flex items-center gap-3 md:gap-5">
        {/* Mobile Menu Toggle Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg bg-[#131619] border border-[#262B30] text-[#C9A227] hover:bg-[#2A2311] transition-colors focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${isStale ? 'bg-[#C9A227]' : 'bg-[#3FA88C] animate-pulse'}`} />
          <span className="text-sm font-bold font-mono-num text-[#EDEAE3]">XAU/USD</span>
          <span className="text-sm font-semibold font-mono-num text-[#EDEAE3]">${price.toFixed(2)}</span>
          <span className="text-xs font-mono-num text-[#3FA88C] flex items-center gap-0.5 bg-[#1F4A40]/40 px-1.5 py-0.5 rounded">
            <TrendingUp size={12} /> +{change}%
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs font-mono-num text-[#5A5D61] border-l border-[#262B30] pl-4">
          <span>Spread: <strong className="text-[#EDEAE3]">{spread}</strong></span>
          <span className="hidden md:inline">Volatility: <strong className="text-[#C9A227]">{volatility}</strong></span>
        </div>

        {/* Active Trading Session Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono-num font-semibold bg-[#131619] border border-[#262B30]">
          <Clock size={13} style={{ color: currentSession.color }} />
          <span className="text-[#EDEAE3]">{currentSession.name}</span>
          <span className="text-[10px] text-[#8B8D91]">({utcTimeStr})</span>
        </div>

        {/* Live / Simulated / Delayed Badge */}
        <div className="hidden md:block">
          {renderSourceBadge()}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* User Session / Cloud Status Badge */}
        {userSession ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-num font-semibold bg-[#1F4A40]/40 text-[#3FA88C] border border-[#265C50]">
              <Cloud size={13} />
              <span className="hidden sm:inline truncate max-w-[140px]">{userSession.user.email}</span>
              <span className="sm:hidden">Synced</span>
            </div>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-1.5 rounded text-[#8B8D91] hover:text-[#C1502E] hover:bg-[#131619] transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : isDemoMode ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-num font-semibold bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40">
            <Sparkles size={13} /> Demo Mode
          </span>
        ) : null}

        <button className="p-1.5 rounded text-[#8B8D91] hover:text-[#C9A227] hover:bg-[#131619] transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
        </button>

        <Pill tone="gold" className="hidden lg:inline-flex">
          <Zap size={11} /> Gold Spot
        </Pill>
      </div>
    </header>
  );
}


