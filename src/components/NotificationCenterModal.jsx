import React, { useState, useMemo } from 'react';
import {
  X,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  AlertOctagon,
  TrendingDown,
  AlertTriangle,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Flame,
  ExternalLink,
  ShieldCheck,
  Radio,
  Sliders,
  Check,
  ArrowUpRight,
  Eye,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';

const ICON_MAP = {
  circuit_breaker: AlertOctagon,
  edge_alert: TrendingDown,
  expectancy: AlertTriangle,
  alert: Bell,
  triggered: Zap,
  closed_tp: CheckCircle,
  closed_sl: XCircle,
  expired: Clock,
  news: Flame,
  default: Bell,
};

const CATEGORY_STYLES = {
  circuit_breaker: {
    accent: '#FB7185',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.3)',
    pill: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    tag: 'RISK VIOLATION',
  },
  edge_alert: {
    accent: '#F3D371',
    bg: 'rgba(201, 162, 39, 0.12)',
    border: 'rgba(201, 162, 39, 0.3)',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    tag: 'EDGE ALERT',
  },
  expectancy: {
    accent: '#FB7185',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.3)',
    pill: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    tag: 'EXPECTANCY',
  },
  alert: {
    accent: '#F3D371',
    bg: 'rgba(201, 162, 39, 0.12)',
    border: 'rgba(201, 162, 39, 0.3)',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    tag: 'PRICE LEVEL',
  },
  triggered: {
    accent: '#34D399',
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.3)',
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    tag: 'TRIGGERED',
  },
  closed_tp: {
    accent: '#34D399',
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.3)',
    pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    tag: 'TAKE PROFIT',
  },
  closed_sl: {
    accent: '#FB7185',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.3)',
    pill: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    tag: 'STOP LOSS',
  },
  expired: {
    accent: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.25)',
    pill: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    tag: 'EXPIRED',
  },
  news: {
    accent: '#F3D371',
    bg: 'rgba(201, 162, 39, 0.12)',
    border: 'rgba(201, 162, 39, 0.3)',
    pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    tag: 'MACRO NEWS',
  },
  default: {
    accent: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.2)',
    pill: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    tag: 'SYSTEM',
  },
};

export function NotificationCenterModal({ isOpen, onClose, onOpenPriceAlerts }) {
  const {
    notifications = [],
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
    removeNotification,
    isSoundEnabled,
    toggleNotificationSound,
    pushPermission,
    enablePushNotifications,
    theme,
  } = useTrade();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'risk' | 'orders'

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'unread') return !n.isRead;
      if (activeTab === 'risk') {
        return ['circuit_breaker', 'edge_alert', 'expectancy', 'news'].includes(n.type);
      }
      if (activeTab === 'orders') {
        return ['triggered', 'closed_tp', 'closed_sl', 'expired', 'alert'].includes(n.type);
      }
      return true;
    });
  }, [notifications, activeTab]);

  if (!isOpen) return null;

  function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  return (
    <>
      {/* Soft Dimming Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
      />

      {/* Modern Trading Telemetry Flyout */}
      <div className="absolute right-0 top-full mt-2.5 w-[440px] max-w-[calc(100vw-1.5rem)] z-50 rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),0_0_25px_rgba(201,162,39,0.08)] border animate-fade-in flex flex-col max-h-[85vh] bg-[#0A0D12]/95 dark:bg-[#0A0D12]/95 light:bg-white/95 backdrop-blur-2xl transition-all"
        style={{
          borderColor: 'var(--color-border-soft)',
        }}
      >
        {/* Subtle Top Gold Highlight Glow Line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#F3D371]/60 to-transparent" />

        {/* Header Bar */}
        <div className="p-4 border-b flex items-center justify-between bg-black/20 dark:bg-black/30 light:bg-slate-50/50"
          style={{ borderColor: 'var(--color-border-soft)' }}
        >
          <div className="flex items-center gap-3">
            {/* Luminous Logo Badge with Pulse */}
            <div className="relative flex items-center justify-center">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2A210F] to-[#120F07] border border-[#C9A227]/40 flex items-center justify-center text-[#F3D371] shadow-inner">
                <Bell size={17} />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-display tracking-tight text-slate-900 dark:text-[#EDEAE3]">
                  Telemetry Alerts
                </h3>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-mono-num font-extrabold bg-gradient-to-r from-[#C9A227] to-[#E4C468] text-[#080A0D] shadow-sm">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono-num text-slate-500 dark:text-[#94A3B8] mt-0.5">
                XAU/USD Sentinel • Risk &amp; Trigger Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sound Chime Toggle */}
            <button
              onClick={toggleNotificationSound}
              className={`p-1.5 rounded-lg border transition-all ${
                isSoundEnabled
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 border-transparent hover:bg-white/[0.06]'
              }`}
              title={isSoundEnabled ? 'Audio Alert Enabled' : 'Audio Alert Muted'}
            >
              {isSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            {/* Dismiss Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Close Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Push Notification Permission Toast */}
        {pushPermission !== 'granted' && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-[#2A210F]/80 to-[#120F07]/90 border-b border-[#C9A227]/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#EDEAE3] text-[11px]">
              <BellRing size={14} className="text-[#F3D371] shrink-0 animate-bounce" />
              <span>Enable OS browser push for background price hits.</span>
            </div>
            <button
              onClick={enablePushNotifications}
              className="px-2.5 py-1 rounded bg-[#C9A227] hover:bg-[#E4C468] text-[#080A0D] font-bold text-[10px] shrink-0 transition-colors shadow-sm"
            >
              Turn On
            </button>
          </div>
        )}

        {/* Tab Strip & Actions */}
        <div className="px-4 py-2 border-b flex items-center justify-between gap-2 text-xs bg-black/10 dark:bg-black/20"
          style={{ borderColor: 'var(--color-border-soft)' }}
        >
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl border bg-black/20 dark:bg-white/[0.03]"
            style={{ borderColor: 'var(--color-border-soft)' }}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'risk', label: 'Risk' },
              { id: 'orders', label: 'Orders' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                    active
                      ? 'bg-gradient-to-b from-[#C9A227] to-[#B38E1B] text-[#080A0D] font-bold shadow-md shadow-[#C9A227]/20 scale-[1.02]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="text-slate-400 hover:text-[#34D399] flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={13} />
                <span className="hidden sm:inline">Mark Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                title="Clear all alerts"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Notification Feed or Executive Empty State */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[52vh]">
          {filteredNotifications.length === 0 ? (
            /* Institutional Empty State: Telemetry Radar Deck */
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              {/* Radar Rings Graphic */}
              <div className="relative flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/25 flex items-center justify-center text-[#F3D371] shadow-[0_0_25px_rgba(201,162,39,0.18)]">
                  <ShieldCheck size={28} className="text-[#F3D371]" />
                </div>
                <div className="absolute w-22 h-22 rounded-full border border-[#C9A227]/15 animate-ping opacity-30" />
                <div className="absolute w-28 h-28 rounded-full border border-emerald-500/10 pointer-events-none" />
              </div>

              <h4 className="text-sm font-bold font-display text-slate-900 dark:text-[#EDEAE3] tracking-tight">
                All Systems Operational
              </h4>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-xs mt-1 leading-relaxed">
                Zero discipline breaches or triggered risk alarms. Sentinel is actively monitoring spot gold price velocity.
              </p>

              {/* 3 Telemetry Health Chips */}
              <div className="w-full grid grid-cols-3 gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--color-border-soft)' }}>
                <div className="p-2 rounded-xl border text-left" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                  <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Safe
                  </div>
                  <span className="text-[10px] font-mono-num block mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Drawdown</span>
                </div>

                <div className="p-2 rounded-xl border text-left" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                  <div className="flex items-center gap-1 text-amber-500 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Armed
                  </div>
                  <span className="text-[10px] font-mono-num block mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Breaker 50%</span>
                </div>

                <div className="p-2 rounded-xl border text-left" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                  <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </div>
                  <span className="text-[10px] font-mono-num block mt-0.5" style={{ color: 'var(--color-text-dim)' }}>OANDA / OKX</span>
                </div>
              </div>
            </div>
          ) : (
            /* Notification Cards */
            filteredNotifications.map((notif) => {
              const Icon = ICON_MAP[notif.type] || ICON_MAP.default;
              const cat = CATEGORY_STYLES[notif.type] || CATEGORY_STYLES.default;

              return (
                <div
                  key={notif.id}
                  onClick={() => markNotificationAsRead(notif.id)}
                  className={`group relative p-3.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all duration-200 hover:opacity-90 ${
                    notif.isRead ? 'opacity-70' : 'shadow-md'
                  }`}
                  style={{
                    background: notif.isRead ? 'var(--color-surface)' : 'var(--color-elevated)',
                    borderColor: 'var(--color-border-soft)',
                    borderLeftWidth: '3px',
                    borderLeftColor: cat.accent,
                  }}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icon Tile */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border"
                      style={{
                        background: cat.bg,
                        borderColor: cat.border,
                        color: cat.accent,
                      }}
                    >
                      <Icon size={15} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono-num font-extrabold border ${cat.pill}`}>
                            {cat.tag}
                          </span>
                          <span className="text-xs font-bold font-display" style={{ color: cat.accent }}>
                            {notif.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono-num shrink-0" style={{ color: 'var(--color-text-dim)' }}>
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs font-body leading-relaxed text-slate-700 dark:text-[#EDEAE3]/90 break-words">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {/* Actions on Item */}
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_6px_#C9A227]" title="Unread" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notif.id);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 transition-colors opacity-60 group-hover:opacity-100"
                      title="Dismiss"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Quick Action Console */}
        <div className="p-3 px-4 border-t flex items-center justify-between text-xs bg-black/20 dark:bg-black/30"
          style={{ borderColor: 'var(--color-border-soft)' }}
        >
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono-num">
            <Radio size={12} className="text-emerald-400 animate-pulse" />
            <span>24/7 Gold Stream</span>
          </div>

          <button
            onClick={() => {
              onClose();
              if (onOpenPriceAlerts) onOpenPriceAlerts();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227]/20 to-[#E4C468]/20 hover:from-[#C9A227]/30 hover:to-[#E4C468]/30 border border-[#C9A227]/40 text-[#F3D371] font-semibold text-xs transition-all shadow-sm group"
          >
            <span>Set Price Target Alert</span>
            <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </>
  );
}
