import React, { useState, useMemo } from 'react';
import { AlertTriangle, AlertOctagon, TrendingDown, Ban, X, Zap } from 'lucide-react';
import { calculateRollingWinRate, calculateUnderwaterDrawdown, calculateExpectancy } from '../utils/edgeAnalytics';
import { useTrade } from '../context/TradeContext';

export function EdgeAlertBanner({ trades = [], initialBalance = 10000, circuitBreakerPct = 10, currentSlotKey = null }) {
  const { theme } = useTrade();
  const isDark = theme !== 'light';

  const [dismissedAlerts, setDismissedAlerts] = useState({});

  const rolling = useMemo(() => calculateRollingWinRate(trades, 20, 50), [trades]);
  const drawdown = useMemo(() => calculateUnderwaterDrawdown(trades, initialBalance, circuitBreakerPct), [trades, initialBalance, circuitBreakerPct]);
  const expectancy = useMemo(() => calculateExpectancy(trades), [trades]);

  const blockedSlots = useMemo(() => {
    try {
      const saved = localStorage.getItem('tradepulse_blocked_slots');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  const isSlotBlocked = currentSlotKey && blockedSlots.includes(currentSlotKey);

  const activeAlerts = useMemo(() => {
    const list = [];

    // 1. Drawdown Circuit Breaker
    if (drawdown.circuitBreakerHit && !dismissedAlerts['drawdown']) {
      list.push({
        id: 'drawdown',
        level: 'critical',
        category: 'CIRCUIT BREAKER',
        icon: AlertOctagon,
        title: `Circuit Breaker Tripped (-${drawdown.currentDrawdownPct}% Drawdown)`,
        message: `Drawdown breached your ${circuitBreakerPct}% limit. Recommended: Pause trading or reduce risk to 0.01 lot.`,
        actionText: 'Pause Trading',
      });
    }

    // 2. Rolling Win Rate Degradation
    if (rolling.hasAlert && !dismissedAlerts['rolling']) {
      list.push({
        id: 'rolling',
        level: 'warning',
        category: 'EDGE DEGRADATION',
        icon: TrendingDown,
        title: `Win Rate Degradation (${rolling.currentRollingWinRate}% vs ${rolling.baseline}% baseline)`,
        message: `20-trade rolling win rate dropped below baseline for ${rolling.belowBaselineStreak} consecutive checks. Review setups for late entries or slippage.`,
        actionText: 'Review Setups',
      });
    }

    // 3. Negative Expectancy / Losing Streak
    if ((expectancy.expectancy < 0 || expectancy.consecutiveNegativeTrades >= 3) && !dismissedAlerts['expectancy']) {
      list.push({
        id: 'expectancy',
        level: 'warning',
        category: 'EXPECTANCY WARNING',
        icon: AlertTriangle,
        title: `Negative Expectancy Alert (${expectancy.sizingAdvice})`,
        message: expectancy.sizingDesc,
        actionText: 'Reduce Lot Size',
      });
    }

    // 4. Current time slot is blocked
    if (isSlotBlocked && !dismissedAlerts['blocked_slot']) {
      list.push({
        id: 'blocked_slot',
        level: 'warning',
        category: 'RESTRICTED SESSION',
        icon: Ban,
        title: 'High-Loss Trading Window Active',
        message: `Current session hour is flagged in your Heat Map as an unprofitable slot. Avoid entering new market executions.`,
        actionText: 'Stand Down',
      });
    }

    return list;
  }, [drawdown, rolling, expectancy, isSlotBlocked, circuitBreakerPct, dismissedAlerts]);

  if (activeAlerts.length === 0) return null;

  const handleDismiss = (id) => {
    setDismissedAlerts((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="space-y-2.5 animate-fade-in">
      {activeAlerts.map((alert) => {
        const Icon = alert.icon;
        const isCritical = alert.level === 'critical';

        const cardStyle = isDark
          ? isCritical
            ? {
                background: 'linear-gradient(135deg, rgba(32, 12, 16, 0.92) 0%, rgba(18, 9, 12, 0.92) 100%)',
                borderColor: 'rgba(244, 63, 94, 0.35)',
                boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.6), 0 0 16px rgba(244, 63, 94, 0.08)',
              }
            : {
                background: 'linear-gradient(135deg, rgba(26, 19, 8, 0.92) 0%, rgba(16, 12, 6, 0.92) 100%)',
                borderColor: 'rgba(201, 162, 39, 0.35)',
                boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.6), 0 0 16px rgba(201, 162, 39, 0.08)',
              }
          : isCritical
          ? {
              background: '#FFF1F2',
              borderColor: '#FECDD3',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }
          : {
              background: '#FFFBEB',
              borderColor: '#FDE68A',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            };

        return (
          <div
            key={alert.id}
            className="group relative overflow-hidden rounded-xl border backdrop-blur-md transition-all p-3 sm:p-3.5 flex items-start justify-between gap-3"
            style={cardStyle}
          >
            {/* Left High-Voltage Glowing Strip */}
            <div
              className="absolute top-0 bottom-0 left-0 w-1"
              style={{
                backgroundColor: isCritical ? '#F43F5E' : isDark ? '#E5B83B' : '#D97706',
                boxShadow: isDark
                  ? isCritical
                    ? '0 0 12px #F43F5E'
                    : '0 0 12px #E5B83B'
                  : 'none',
              }}
            />

            <div className="flex items-start gap-3 pl-1.5 flex-1 min-w-0">
              {/* Category Icon Badge */}
              <div
                className="p-1.5 rounded-lg border shrink-0 mt-0.5"
                style={
                  isDark
                    ? isCritical
                      ? { background: 'rgba(244, 63, 94, 0.15)', borderColor: 'rgba(244, 63, 94, 0.35)', color: '#FB7185' }
                      : { background: 'rgba(201, 162, 39, 0.15)', borderColor: 'rgba(201, 162, 39, 0.35)', color: '#F3D371' }
                    : isCritical
                    ? { background: '#FFE4E6', borderColor: '#FDA4AF', color: '#BE123C' }
                    : { background: '#FEF3C7', borderColor: '#FCD34D', color: '#B45309' }
                }
              >
                <Icon size={16} className={isCritical ? 'animate-pulse' : ''} />
              </div>

              {/* Alert Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category Pill Tag */}
                  <span
                    className="px-1.5 py-0.2 rounded text-[9px] font-mono-num font-extrabold tracking-wide uppercase border"
                    style={
                      isDark
                        ? isCritical
                          ? { background: 'rgba(244, 63, 94, 0.20)', borderColor: 'rgba(244, 63, 94, 0.40)', color: '#FB7185' }
                          : { background: 'rgba(201, 162, 39, 0.20)', borderColor: 'rgba(201, 162, 39, 0.40)', color: '#F3D371' }
                        : isCritical
                        ? { background: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B' }
                        : { background: '#FEF3C7', borderColor: '#FDE68A', color: '#78350F' }
                    }
                  >
                    {alert.category}
                  </span>

                  <span
                    className="text-xs font-bold font-display tracking-tight"
                    style={{
                      color: isDark
                        ? isCritical
                          ? '#FB7185'
                          : '#F3D371'
                        : isCritical
                        ? '#9F1239'
                        : '#78350F',
                    }}
                  >
                    {alert.title}
                  </span>
                </div>

                <p
                  className="text-xs mt-1 leading-relaxed break-words font-body"
                  style={{
                    color: isDark ? '#EDEAE3' : '#1E293B',
                  }}
                >
                  {alert.message}
                </p>
              </div>
            </div>

            {/* Quick Action & Dismiss */}
            <div className="flex items-center gap-1.5 shrink-0 self-center">
              {alert.actionText && (
                <span
                  className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono-num font-semibold border"
                  style={
                    isDark
                      ? isCritical
                        ? { background: 'rgba(244, 63, 94, 0.12)', borderColor: 'rgba(244, 63, 94, 0.30)', color: '#FB7185' }
                        : { background: 'rgba(201, 162, 39, 0.12)', borderColor: 'rgba(201, 162, 39, 0.30)', color: '#F3D371' }
                      : isCritical
                      ? { background: '#FFE4E6', borderColor: '#FECDD3', color: '#9F1239' }
                      : { background: '#FEF3C7', borderColor: '#FDE68A', color: '#78350F' }
                  }
                >
                  <Zap size={10} />
                  {alert.actionText}
                </span>
              )}

              <button
                onClick={() => handleDismiss(alert.id)}
                className="p-1 rounded-md transition-colors"
                style={{
                  color: isDark ? '#94A3B8' : '#64748B',
                }}
                title="Dismiss alert"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
