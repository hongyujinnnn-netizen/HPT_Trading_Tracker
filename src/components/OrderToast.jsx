import React, { useEffect } from 'react';
import { Zap, CheckCircle, XCircle, Clock, X, Bell, AlertOctagon, TrendingDown, AlertTriangle, Flame } from 'lucide-react';

const TOAST_CONFIG = {
  triggered: {
    icon: Zap,
    bg: '#2A2311',
    border: '#C9A227',
    fg: '#E4C468',
    label: 'Order Triggered',
  },
  closed_tp: {
    icon: CheckCircle,
    bg: '#1F4A40',
    border: '#3FA88C',
    fg: '#3FA88C',
    label: 'Take Profit Hit',
  },
  closed_sl: {
    icon: XCircle,
    bg: '#4A2A1E',
    border: '#C1502E',
    fg: '#C1502E',
    label: 'Stop Loss Hit',
  },
  expired: {
    icon: Clock,
    bg: '#1B1F23',
    border: '#5A5D61',
    fg: '#8B8D91',
    label: 'Order Expired',
  },
  alert: {
    icon: Bell,
    bg: '#2A2311',
    border: '#C9A227',
    fg: '#C9A227',
    label: 'Price Alert',
  },
  circuit_breaker: {
    icon: AlertOctagon,
    bg: '#2E1815',
    border: '#C1502E',
    fg: '#E46868',
    label: 'Circuit Breaker Alert',
  },
  edge_alert: {
    icon: TrendingDown,
    bg: '#2A2311',
    border: '#C9A227',
    fg: '#E4C468',
    label: 'Edge Degradation Alert',
  },
  expectancy: {
    icon: AlertTriangle,
    bg: '#2E1815',
    border: '#C1502E',
    fg: '#E46868',
    label: 'Expectancy Warning',
  },
  news: {
    icon: Flame,
    bg: '#1B1F23',
    border: '#C9A227',
    fg: '#C9A227',
    label: 'Economic Release Warning',
  },
};

function Toast({ toast, onDismiss }) {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.triggered;
  const Icon = config.icon;

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 8000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl min-w-[320px] max-w-[420px] animate-fade-in"
      style={{ background: config.bg, borderColor: config.border }}
    >
      <Icon size={18} style={{ color: config.fg, marginTop: 2 }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold font-display" style={{ color: config.fg }}>
          {toast.title || config.label}
        </div>
        <p className="text-xs text-[#EDEAE3] mt-0.5 font-body leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded text-[#5A5D61] hover:text-[#EDEAE3] transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function OrderToast({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
