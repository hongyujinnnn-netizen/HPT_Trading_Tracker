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
  ShieldAlert,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { Pill } from './Pill';

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

const COLOR_MAP = {
  circuit_breaker: { text: '#E46868', bg: '#2E1815', border: '#C1502E' },
  edge_alert: { text: '#C9A227', bg: '#2A2311', border: '#C9A227' },
  expectancy: { text: '#E46868', bg: '#2E1815', border: '#C1502E' },
  alert: { text: '#C9A227', bg: '#2A2311', border: '#C9A227' },
  triggered: { text: '#C9A227', bg: '#2A2311', border: '#C9A227' },
  closed_tp: { text: '#3FA88C', bg: '#152E25', border: '#3FA88C' },
  closed_sl: { text: '#C1502E', bg: '#4A2A1E', border: '#C1502E' },
  expired: { text: '#8B8D91', bg: '#1B1F23', border: '#5A5D61' },
  news: { text: '#C9A227', bg: '#1B1F23', border: '#C9A227' },
  default: { text: '#8B8D91', bg: '#1B1F23', border: '#262B30' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#131619] border border-[#262B30] rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#262B30] flex items-center justify-between bg-[#1B1F23]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2A2311] border border-[#C9A227]/40 flex items-center justify-center text-[#C9A227]">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display text-[#EDEAE3]">Notifications &amp; Alerts</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-mono-num font-bold bg-[#C9A227] text-[#0A0C0E]">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8B8D91]">
                Real-time risk warnings, circuit breaker trips, price alerts, and order lifecycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={toggleNotificationSound}
              className={`p-2 rounded-lg border transition-colors ${
                isSoundEnabled
                  ? 'bg-[#152E25] text-[#3FA88C] border-[#1F4A40]'
                  : 'bg-[#1B1F23] text-[#5A5D61] border-[#262B30] hover:text-[#EDEAE3]'
              }`}
              title={isSoundEnabled ? 'Notification Sound Enabled' : 'Notification Sound Muted'}
            >
              {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1B1F23] rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Push Notification Permission Banner (if not granted) */}
        {pushPermission !== 'granted' && (
          <div className="px-5 py-3 bg-[#2A2311]/60 border-b border-[#C9A227]/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#EDEAE3]">
              <BellRing size={15} className="text-[#C9A227] shrink-0" />
              <span>Enable native browser notifications for background price &amp; circuit breaker alerts.</span>
            </div>
            <button
              onClick={enablePushNotifications}
              className="px-3 py-1 rounded bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-[11px] shrink-0 transition-colors"
            >
              Enable Push
            </button>
          </div>
        )}

        {/* Filter Tabs & Bulk Actions */}
        <div className="px-5 py-2.5 border-b border-[#262B30] flex flex-wrap items-center justify-between gap-2 bg-[#1B1F23]/40 text-xs">
          <div className="flex items-center gap-1 bg-[#131619] p-0.5 rounded-lg border border-[#262B30]">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: `Unread (${unreadCount})` },
              { id: 'risk', label: 'Risk & Edge' },
              { id: 'orders', label: 'Orders' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 rounded font-semibold text-[11px] transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#2A2311] text-[#C9A227] border border-[#C9A227]/40'
                    : 'text-[#8B8D91] hover:text-[#EDEAE3]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsAsRead}
                className="text-[11px] text-[#8B8D91] hover:text-[#3FA88C] flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck size={13} /> Mark Read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="text-[11px] text-[#8B8D91] hover:text-[#C1502E] flex items-center gap-1 transition-colors ml-1"
                title="Clear all notification history"
              >
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Bell size={28} className="text-[#5A5D61]" />
              <p className="text-sm font-semibold text-[#EDEAE3] font-display">No notifications found</p>
              <p className="text-xs text-[#8B8D91] max-w-xs">
                Your notifications for triggered orders, risk limits, and price alerts will appear here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const Icon = ICON_MAP[notif.type] || ICON_MAP.default;
              const color = COLOR_MAP[notif.type] || COLOR_MAP.default;

              return (
                <div
                  key={notif.id}
                  onClick={() => markNotificationAsRead(notif.id)}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all hover:scale-[1.01] ${
                    notif.isRead
                      ? 'bg-[#1B1F23]/60 border-[#262B30] text-[#8B8D91]'
                      : 'bg-[#1B1F23] border-[#3FA88C]/30 text-[#EDEAE3] shadow-md'
                  }`}
                  style={!notif.isRead ? { borderColor: color.border } : {}}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: color.bg, color: color.text }}
                    >
                      <Icon size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold font-display" style={{ color: color.text }}>
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-[#5A5D61] font-mono-num shrink-0">
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-[#EDEAE3]/90 mt-0.5 font-body leading-relaxed break-words">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#C9A227]" title="Unread" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notif.id);
                      }}
                      className="p-1 text-[#5A5D61] hover:text-[#C1502E] rounded transition-colors"
                      title="Delete notification"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Quick Action: Manage Price Alerts */}
        <div className="p-4 border-t border-[#262B30] bg-[#1B1F23]/60 flex items-center justify-between text-xs">
          <span className="text-[#8B8D91]">Need to track a specific gold level?</span>
          <button
            onClick={() => {
              onClose();
              if (onOpenPriceAlerts) onOpenPriceAlerts();
            }}
            className="text-[#C9A227] hover:underline font-semibold flex items-center gap-1"
          >
            Set Price Targets <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
