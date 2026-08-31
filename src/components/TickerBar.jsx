import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Bell, Zap, Cloud, Sparkles, LogOut, Activity, AlertTriangle, Radio, Clock, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { Pill } from './Pill';
import { AccountSelector } from './AccountSelector';
import { PriceAlertModal } from './PriceAlertModal';
import { NotificationCenterModal } from './NotificationCenterModal';
import { useTrade } from '../context/TradeContext';
import { supabase } from '../services/supabaseClient';
import { goldPriceService, ConnectionState } from '../services/goldPriceService';
import { getCurrentGoldSession } from '../utils/sessionDetector';

export function TickerBar({ onToggleMobileMenu, mobileMenuOpen, onOpenAccountManager }) {
  const { userSession, signOut, isDemoMode, setActivePage, priceAlerts, notifications = [] } = useTrade();

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [price, setPrice] = useState(null);
  const [previousPrice, setPreviousPrice] = useState(null);
  const [change, setChange] = useState(0);
  const [bid, setBid] = useState(null);
  const [ask, setAsk] = useState(null);
  const [spread, setSpread] = useState(0);
  const [source, setSource] = useState('unknown');
  const [connectionState, setConnectionState] = useState(ConnectionState.OFFLINE);
  const [ticksPerSecond, setTicksPerSecond] = useState(0);
  const [isLeader, setIsLeader] = useState(false);

  // Price flash animation state
  const [flashClass, setFlashClass] = useState('');
  const flashTimerRef = useRef(null);

  const [currentSession, setCurrentSession] = useState(() => {
    const savedMode = localStorage.getItem('tradepulse_gold_chart_mode') || 'oanda';
    return getCurrentGoldSession(new Date(), savedMode);
  });
  const [utcTimeStr, setUtcTimeStr] = useState('');

  // Update UTC clock and session every 30s
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const savedMode = localStorage.getItem('tradepulse_gold_chart_mode') || 'oanda';
      setCurrentSession(getCurrentGoldSession(now, savedMode));
      setUtcTimeStr(now.toISOString().substring(11, 16) + ' UTC');
    }
    updateClock();
    const clockInterval = setInterval(updateClock, 10000);
    return () => clearInterval(clockInterval);
  }, []);

  // Subscribe to goldPriceService for all price data
  useEffect(() => {
    const unsub = goldPriceService.subscribe((state) => {
      if (state.price !== null) {
        setPreviousPrice((prev) => prev);
        setPrice((prev) => {
          // Trigger flash animation on price change
          if (prev !== null && state.price !== prev) {
            const direction = state.price > prev ? 'flash-green' : 'flash-red';
            setFlashClass(direction);
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
            flashTimerRef.current = setTimeout(() => setFlashClass(''), 400);
          }
          return state.price;
        });
        setPreviousPrice(state.previousPrice);
      }
      if (typeof state.change24h === 'number') setChange(state.change24h);
      if (state.bid !== null && state.ask !== null) {
        setBid(state.bid);
        setAsk(state.ask);
        setSpread(parseFloat((state.ask - state.bid).toFixed(2)));
      }
      if (state.source) setSource(state.source);
      if (state.connectionState) setConnectionState(state.connectionState);
      if (typeof state.ticksPerSecond === 'number') setTicksPerSecond(state.ticksPerSecond);
      if (typeof state.isLeader === 'boolean') setIsLeader(state.isLeader);
    });

    return () => {
      unsub();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const isPositive = change >= 0;

  const renderConnectionBadge = () => {
    switch (connectionState) {
      case ConnectionState.LIVE:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 dark:bg-[#1F4A40]/60 dark:text-[#3FA88C] dark:border-[#3FA88C]/40">
            <Wifi size={12} className="animate-pulse" />
            <span className="hidden sm:inline">Live</span>
            {source === 'finnhub' && <span className="hidden md:inline ml-0.5 opacity-75">WS</span>}
            {source === 'broadcast' && <span className="hidden md:inline ml-0.5 opacity-75">Relay</span>}
            {ticksPerSecond > 0 && (
              <span className="hidden lg:inline ml-1 text-[10px] opacity-75">{ticksPerSecond}/s</span>
            )}
          </span>
        );
      case ConnectionState.CONNECTING:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-sky-500/10 text-sky-700 border border-sky-500/30 dark:bg-[#2A3540] dark:text-[#6BA3D6] dark:border-[#4A7BA7]/40">
            <Wifi size={12} className="animate-pulse" /> Connecting…
          </span>
        );
      case ConnectionState.RECONNECTING:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-[#4A3A1E] dark:text-[#E4C468] dark:border-[#C9A227]/40">
            <Activity size={12} className="animate-spin" /> Reconnecting…
          </span>
        );
      case ConnectionState.FALLBACK:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30 dark:bg-[#2A2311] dark:text-[#C9A227] dark:border-[#C9A227]/30">
            <Radio size={12} /> REST Fallback
          </span>
        );
      case ConnectionState.OFFLINE:
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-rose-500/10 text-rose-700 border border-rose-500/30 dark:bg-[#3A1E1E] dark:text-[#E46868] dark:border-[#C12E2E]/40">
            <WifiOff size={12} /> Offline
          </span>
        );
    }
  };

  return (
    <header
      className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b backdrop-blur-md sticky top-0 z-30 shadow-sm transition-colors duration-200"
      style={{
        backgroundColor: 'var(--color-header)',
        borderColor: 'var(--color-border-soft)',
      }}
    >
      <div className="flex items-center gap-3 md:gap-5">
        {/* Mobile Menu Toggle Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg border text-[#D97706] dark:text-[#E5B83B] transition-colors focus:outline-none"
            style={{
              backgroundColor: 'var(--color-elevated)',
              borderColor: 'var(--color-border-soft)',
            }}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
        <button
          onClick={() => setActivePage && setActivePage('chart')}
          title="Open TradingView Gold Chart (XAU/USD)"
          className="flex items-center gap-2.5 p-1 -m-1 rounded-lg hover:bg-white/[0.04] transition-colors group cursor-pointer text-left"
        >
          {/* Connection dot indicator with radiating pulse */}
          <div className="relative flex items-center justify-center">
            <span className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              connectionState === ConnectionState.LIVE ? 'bg-[#34D399]' :
              connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING ? 'bg-[#E5B83B]' :
              connectionState === ConnectionState.FALLBACK ? 'bg-[#E5B83B]' :
              'bg-[#FB7185]'
            }`} />
            {connectionState === ConnectionState.LIVE && (
              <span className="absolute w-3.5 h-3.5 rounded-full bg-[#34D399]/40 animate-ping" />
            )}
          </div>
          <span
            className="text-sm font-bold font-mono-num group-hover:text-amber-500 transition-colors"
            style={{ color: 'var(--color-text-main)' }}
          >
            XAU/USD
          </span>

          {/* Price with flash animation */}
          <span
            className={`text-sm font-semibold font-mono-num rounded px-1.5 -mx-1 transition-colors duration-300 ${
              flashClass === 'flash-green'
                ? 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 font-bold'
                : flashClass === 'flash-red'
                ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 font-bold'
                : ''
            }`}
            style={{ color: !flashClass ? 'var(--color-text-main)' : undefined }}
          >
            {price !== null ? `$${price.toFixed(2)}` : '—'}
          </span>

          {/* Daily change badge */}
          <span
            className={`text-xs font-mono-num font-semibold flex items-center gap-0.5 px-2 py-0.5 rounded-md border shadow-sm transition-all ${
              isPositive
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-[#34D399]'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-[#FB7185]'
            }`}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? '+' : ''}{change}%
          </span>
        </button>

        {/* Bid / Ask / Spread */}
        <div
          className="hidden sm:flex items-center gap-4 text-xs font-mono-num border-l pl-4"
          style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-dim)' }}
        >
          {bid !== null && ask !== null ? (
            <>
              <span>Bid: <strong style={{ color: 'var(--color-text-main)' }}>{bid.toFixed(2)}</strong></span>
              <span>Ask: <strong style={{ color: 'var(--color-text-main)' }}>{ask.toFixed(2)}</strong></span>
              <span className="hidden md:inline">Spread: <strong className="text-amber-600 dark:text-[#E5B83B] font-bold">{spread.toFixed(2)}</strong></span>
            </>
          ) : (
            <span>Spread: <strong className="text-amber-600 dark:text-[#E5B83B] font-bold">{spread.toFixed(2)}</strong></span>
          )}
        </div>

        {/* Active Trading Session Badge */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono-num font-semibold border"
          style={{
            background: 'var(--color-elevated)',
            borderColor: 'var(--color-border-soft)',
          }}
        >
          <Clock size={13} style={{ color: currentSession.color }} />
          <span style={{ color: 'var(--color-text-main)' }}>{currentSession.name}</span>
          <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>({utcTimeStr})</span>
        </div>

        {/* Connection Status Badge */}
        <div className="hidden md:block">
          {renderConnectionBadge()}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Trading Sub-Account Selector */}
        <AccountSelector onOpenManager={onOpenAccountManager} />

        {/* User Session / Cloud Status Badge — click to open Profile */}
        {userSession ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePage('profile')}
              title="View Profile"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-num font-semibold border transition-all"
              style={{
                background: 'var(--color-elevated)',
                borderColor: 'var(--color-border-soft)',
                color: 'var(--color-text-main)',
              }}
            >
              {/* Avatar circle with initial */}
              <span className="w-5 h-5 rounded-full bg-[#10B981] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {userSession.user.email?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline truncate max-w-[140px]">{userSession.user.email}</span>
              <span className="sm:hidden">Profile</span>
            </button>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-1.5 rounded hover:text-[#F43F5E] transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : isDemoMode ? (
          <button
            onClick={() => setActivePage('profile')}
            title="View Profile"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-num font-semibold bg-amber-500/10 text-amber-600 dark:text-[#E5B83B] border border-amber-500/30 transition-all"
          >
            <Sparkles size={13} /> Demo Mode
          </button>
        ) : null}

        {/* Notifications & Alerts Bell with Anchored Dropdown Flyout */}
        {(() => {
          const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
          const activeAlertCount = (priceAlerts || []).filter((a) => !a.isTriggered).length;
          const totalBadge = unreadNotifCount > 0 ? unreadNotifCount : activeAlertCount > 0 ? activeAlertCount : 0;

          return (
            <div className="relative">
              <button
                onClick={() => setIsNotificationCenterOpen((prev) => !prev)}
                title="Notifications &amp; Alerts Center"
                className="p-1.5 rounded text-slate-500 hover:text-amber-500 hover:bg-black/[0.04] dark:text-[#94A3B8] dark:hover:text-[#E5B83B] dark:hover:bg-white/[0.05] transition-colors relative"
                aria-label="Open Notifications Center"
              >
                <Bell size={16} />
                {totalBadge > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center font-mono-num ${
                    unreadNotifCount > 0
                      ? 'bg-[#F43F5E] text-white animate-pulse'
                      : 'bg-[#C9A227] text-[#0A0C0E]'
                  }`}>
                    {totalBadge}
                  </span>
                )}
              </button>

              {/* Anchored Notification Center Dropdown */}
              <NotificationCenterModal
                isOpen={isNotificationCenterOpen}
                onClose={() => setIsNotificationCenterOpen(false)}
                onOpenPriceAlerts={() => setIsAlertModalOpen(true)}
              />
            </div>
          );
        })()}

        <Pill tone="gold" className="hidden lg:inline-flex">
          <Zap size={11} /> Gold Spot
        </Pill>
      </div>

      {/* Price Alert Modal */}
      <PriceAlertModal isOpen={isAlertModalOpen} onClose={() => setIsAlertModalOpen(false)} />
    </header>
  );
}
