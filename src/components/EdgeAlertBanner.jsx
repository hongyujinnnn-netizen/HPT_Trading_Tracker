import React, { useState, useMemo } from 'react';
import { AlertTriangle, AlertOctagon, TrendingDown, Ban, X, ShieldAlert } from 'lucide-react';
import { calculateRollingWinRate, calculateUnderwaterDrawdown, calculateExpectancy } from '../utils/edgeAnalytics';

export function EdgeAlertBanner({ trades = [], initialBalance = 10000, circuitBreakerPct = 10, currentSlotKey = null }) {
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
        icon: AlertOctagon,
        title: `Circuit Breaker Tripped: -${drawdown.currentDrawdownPct}% Drawdown`,
        message: `Drawdown has breached your hard ${circuitBreakerPct}% limit. Pause trading or reduce risk to minimum lot size (0.01) to protect capital.`,
      });
    }

    // 2. Rolling Win Rate Degradation
    if (rolling.hasAlert && !dismissedAlerts['rolling']) {
      list.push({
        id: 'rolling',
        level: 'warning',
        icon: TrendingDown,
        title: `Edge Degradation Alert: Rolling Win Rate at ${rolling.currentRollingWinRate}%`,
        message: `Rolling 20-trade win rate has dropped below your ${rolling.baseline}% baseline for ${rolling.belowBaselineStreak} consecutive readings. Review recent setups for slippage or late entries.`,
      });
    }

    // 3. Negative Expectancy / Losing Streak
    if ((expectancy.expectancy < 0 || expectancy.consecutiveNegativeTrades >= 3) && !dismissedAlerts['expectancy']) {
      list.push({
        id: 'expectancy',
        level: 'warning',
        icon: AlertTriangle,
        title: `Expectancy Alert: ${expectancy.sizingAdvice}`,
        message: expectancy.sizingDesc,
      });
    }

    // 4. Current time slot is blocked
    if (isSlotBlocked && !dismissedAlerts['blocked_slot']) {
      list.push({
        id: 'blocked_slot',
        level: 'warning',
        icon: Ban,
        title: 'Restricted Trading Window Active',
        message: `Current session hour is flagged in your Time-of-Day Heat Map as an unprofitable red slot.`,
      });
    }

    return list;
  }, [drawdown, rolling, expectancy, isSlotBlocked, circuitBreakerPct, dismissedAlerts]);

  if (activeAlerts.length === 0) return null;

  const handleDismiss = (id) => {
    setDismissedAlerts((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="space-y-2 animate-fade-in">
      {activeAlerts.map((alert) => {
        const Icon = alert.icon;
        const isCritical = alert.level === 'critical';

        return (
          <div
            key={alert.id}
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 shadow-lg ${
              isCritical
                ? 'bg-[#2E1815] border-[#C1502E] text-[#EDEAE3]'
                : 'bg-[#2A2311] border-[#C9A227]/50 text-[#EDEAE3]'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon size={18} className={`mt-0.5 shrink-0 ${isCritical ? 'text-[#C1502E] animate-pulse' : 'text-[#C9A227]'}`} />
              <div className="text-xs">
                <span className={`font-bold block ${isCritical ? 'text-[#E46868]' : 'text-[#C9A227]'}`}>
                  {alert.title}
                </span>
                <p className="text-[#8B8D91] mt-0.5 leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleDismiss(alert.id)}
              className="text-[#8B8D91] hover:text-[#EDEAE3] p-1 rounded transition-colors"
              title="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
