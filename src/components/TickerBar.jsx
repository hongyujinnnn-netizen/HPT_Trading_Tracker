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
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#1F4A40]/60 text-[#3FA88C] border border-[#3FA88C]/40">
            <Wifi size={12} className="animate-pulse" />
            <span className="hidden sm:inline">Live</span>
            {source === 'finnhub' && <span className="hidden md:inline ml-0.5 opacity-70">WS</span>}
            {source === 'broadcast' && <span className="hidden md:inline ml-0.5 opacity-70">Relay</span>}
            {ticksPerSecond > 0 && (
              <span className="hidden lg:inline ml-1 text-[10px] opacity-60">{ticksPerSecond}/s</span>
            )}
          </span>
        );
      case ConnectionState.CONNECTING:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#2A3540] text-[#6BA3D6] border border-[#4A7BA7]/40">
            <Wifi size={12} className="animate-pulse" /> Connecting…
          </span>
        );
      case ConnectionState.RECONNECTING:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#4A3A1E] text-[#E4C468] border border-[#C9A227]/40">
            <Activity size={12} className="animate-spin" /> Reconnecting…
          </span>
        );
      case ConnectionState.FALLBACK:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/30">
            <Radio size={12} /> REST Fallback
          </span>
        );
      case ConnectionState.OFFLINE:
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold bg-[#3A1E1E] text-[#E46868] border border-[#C12E2E]/40">
            <WifiOff size={12} /> Offline
          </span>
        );
    }
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
        <button
          onClick={() => setActivePage && setActivePage('chart')}
          title="Open TradingView Gold Chart (XAU/USD)"
          className="flex items-center gap-2.5 p-1 -m-1 rounded-lg hover:bg-[#262B30]/50 transition-colors group cursor-pointer text-left"
        >
          {/* Connection dot indicator */}
          <span className={`w-2 h-2 rounded-full transition-colors duration-300 ${
            connectionState === ConnectionState.LIVE ? 'bg-[#3FA88C] animate-pulse' :
            connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING ? 'bg-[#C9A227] animate-pulse' :
            connectionState === ConnectionState.FALLBACK ? 'bg-[#C9A227]' :
            'bg-[#C1502E]'
          }`} />
          <span className="text-sm font-bold font-mono-num text-[#EDEAE3] group-hover:text-[#C9A227] transition-colors">XAU/USD</span>

          {/* Price with flash animation */}
          <span
            className={`text-sm font-semibold font-mono-num text-[#EDEAE3] transition-colors duration-400 rounded px-1 -mx-1 ${
              flashClass === 'flash-green' ? 'bg-[#3FA88C]/30 text-[#3FA88C]' :
              flashClass === 'flash-red' ? 'bg-[#C1502E]/30 text-[#E46868]' : ''
            }`}
          >
            {price !== null ? `$${price.toFixed(2)}` : '—'}
          </span>

          {/* Daily change badge */}
          <span className={`text-xs font-mono-num flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
            isPositive
              ? 'text-[#3FA88C] bg-[#1F4A40]/40'
              : 'text-[#E46868] bg-[#4A1E1E]/40'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? '+' : ''}{change}%
          </span>
        </button>

        {/* Bid / Ask / Spread */}
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono-num text-[#5A5D61] border-l border-[#262B30] pl-4">
          {bid !== null && ask !== null ? (
            <>
              <span>Bid: <strong className="text-[#EDEAE3]">{bid.toFixed(2)}</strong></span>
              <span>Ask: <strong className="text-[#EDEAE3]">{ask.toFixed(2)}</strong></span>
              <span className="hidden md:inline">Spread: <strong className="text-[#C9A227]">{spread.toFixed(2)}</strong></span>
            </>
          ) : (
            <span>Spread: <strong className="text-[#EDEAE3]">{spread.toFixed(2)}</strong></span>
          )}
        </div>

        {/* Active Trading Session Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono-num font-semibold bg-[#131619] border border-[#262B30]">
          <Clock size={13} style={{ color: currentSession.color }} />
          <span className="text-[#EDEAE3]">{currentSession.name}</span>
          <span className="text-[10px] text-[#8B8D91]">({utcTimeStr})</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-num font-semibold bg-[#1F4A40]/40 text-[#3FA88C] border border-[#265C50] hover:bg-[#1F4A40]/70 hover:border-[#3FA88C]/60 transition-all"
            >
              {/* Avatar circle with initial */}
              <span className="w-5 h-5 rounded-full bg-[#3FA88C] text-[#0A0C0E] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                {userSession.user.email?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline truncate max-w-[140px]">{userSession.user.email}</span>
              <span className="sm:hidden">Profile</span>
            </button>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-1.5 rounded text-[#8B8D91] hover:text-[#C1502E] hover:bg-[#131619] transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : isDemoMode ? (
          <button
            onClick={() => setActivePage('profile')}
            title="View Profile"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono-num font-semibold bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40 hover:bg-[#3A2F11] transition-all"
          >
            <Sparkles size={13} /> Demo Mode
          </button>
        ) : null}

        {/* Notifications & Alerts Bell */}
        {(() => {
          const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
          const activeAlertCount = (priceAlerts || []).filter((a) => !a.isTriggered).length;
          const totalBadge = unreadNotifCount > 0 ? unreadNotifCount : activeAlertCount > 0 ? activeAlertCount : 0;

          return (
            <button
              onClick={() => setIsNotificationCenterOpen(true)}
              title="Notifications & Alerts Center"
              className="p-1.5 rounded text-[#8B8D91] hover:text-[#C9A227] hover:bg-[#131619] transition-colors relative"
              aria-label="Open Notifications Center"
            >
              <Bell size={16} />
              {totalBadge > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center font-mono-num ${
                  unreadNotifCount > 0
                    ? 'bg-[#C1502E] text-[#EDEAE3] animate-pulse'
                    : 'bg-[#C9A227] text-[#0A0C0E]'
                }`}>
                  {totalBadge}
                </span>
              )}
            </button>
          );
        })()}

        <Pill tone="gold" className="hidden lg:inline-flex">
          <Zap size={11} /> Gold Spot
        </Pill>
      </div>

      {/* Notifications Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onOpenPriceAlerts={() => setIsAlertModalOpen(true)}
      />

      {/* Price Alert Modal */}
      <PriceAlertModal isOpen={isAlertModalOpen} onClose={() => setIsAlertModalOpen(false)} />
    </header>
  );
}
