import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Shield, Target, Info, AlertCircle, ArrowUpRight, ArrowDownRight, PlusCircle, ArrowRight } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { calculateLotSize } from '../utils/calculations';

export function RiskCalculator() {
  const { settings, liveGoldPrice, activeAccount, setTradeDraft, setActivePage } = useTrade();

  const accountBal = activeAccount ? parseFloat(activeAccount.initialBalance) || settings.accountBalance : settings.accountBalance;

  const [balance, setBalance] = useState(accountBal);
  const [riskPct, setRiskPct] = useState(settings.defaultRiskPct || 1.0);
  const [side, setSide] = useState('Buy');
  const [entryPrice, setEntryPrice] = useState(() => (liveGoldPrice ? parseFloat(liveGoldPrice.toFixed(2)) : 2700.00));
  const [stopPrice, setStopPrice] = useState(() => (liveGoldPrice ? parseFloat((liveGoldPrice - 10).toFixed(2)) : 2690.00));

  // Sync balance if active account changes
  useEffect(() => {
    if (accountBal) setBalance(accountBal);
  }, [accountBal]);

  const contractSize = settings.contractSize || 100;

  const result = useMemo(() => {
    return calculateLotSize(balance, riskPct, entryPrice, stopPrice, contractSize);
  }, [balance, riskPct, entryPrice, stopPrice, contractSize]);

  // Calculate target prices for 1:1, 1:2, 1:3 RR ratios based on selected side
  const stopDist = Math.abs(entryPrice - stopPrice);
  const isBuy = side === 'Buy';
  const tp1 = isBuy ? entryPrice + stopDist : entryPrice - stopDist;
  const tp2 = isBuy ? entryPrice + stopDist * 2 : entryPrice - stopDist * 2;
  const tp3 = isBuy ? entryPrice + stopDist * 3 : entryPrice - stopDist * 3;

  const handleUseInAddTrade = () => {
    setTradeDraft({
      side,
      entryPrice: entryPrice.toFixed(2),
      stopLoss: stopPrice.toFixed(2),
      takeProfit: tp2.toFixed(2),
      lotSize: result.lotSize.toString(),
      strategy: 'Breakout',
      accountId: activeAccount?.id || null,
    });
    setActivePage('add');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">XAU/USD Risk &amp; Position Size Calculator</h1>
        <p className="text-xs text-[#8B8D91]">
          Calculate exact position lot sizes and R:R target levels tailored for Gold standard contracts ({contractSize} oz/lot)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calculator Inputs */}
        <div className="terminal-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B8D91] flex items-center gap-2">
              <Calculator size={16} className="text-[#C9A227]" /> Position Parameters
            </h3>
            {activeAccount && (
              <span className="text-[10px] font-mono-num px-2 py-0.5 rounded bg-[#1B1F23] border border-[#262B30] text-[#C9A227]">
                {activeAccount.name}
              </span>
            )}
          </div>

          {/* Direction Toggle */}
          <div>
            <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1.5">
              Trade Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSide('Buy');
                  if (stopPrice >= entryPrice) setStopPrice(parseFloat((entryPrice - 10).toFixed(2)));
                }}
                className={`py-2 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1.5 border transition-all ${
                  side === 'Buy'
                    ? 'bg-[#1F4A40] text-[#3FA88C] border-[#265C50] shadow-sm'
                    : 'bg-[#1B1F23] text-[#8B8D91] border-[#262B30] hover:text-[#EDEAE3]'
                }`}
              >
                <ArrowUpRight size={15} /> Buy / Long
              </button>
              <button
                type="button"
                onClick={() => {
                  setSide('Sell');
                  if (stopPrice <= entryPrice) setStopPrice(parseFloat((entryPrice + 10).toFixed(2)));
                }}
                className={`py-2 rounded-lg text-xs font-bold font-mono-num flex items-center justify-center gap-1.5 border transition-all ${
                  side === 'Sell'
                    ? 'bg-[#4A2A1E] text-[#C1502E] border-[#5C3426] shadow-sm'
                    : 'bg-[#1B1F23] text-[#8B8D91] border-[#262B30] hover:text-[#EDEAE3]'
                }`}
              >
                <ArrowDownRight size={15} /> Sell / Short
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
              Account Balance ($USD)
            </label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-sm font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
              Risk Per Trade (%)
            </label>
            <input
              type="number"
              step="0.25"
              value={riskPct}
              onChange={(e) => setRiskPct(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-sm font-mono-num text-[#C9A227] outline-none focus:border-[#C9A227] transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider">
                Planned Entry Price
              </label>
              {liveGoldPrice && (
                <button
                  type="button"
                  onClick={() => setEntryPrice(parseFloat(liveGoldPrice.toFixed(2)))}
                  className="text-[10px] text-[#C9A227] hover:underline font-mono-num"
                >
                  Use Live Price (${liveGoldPrice.toFixed(2)})
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.10"
              value={entryPrice}
              onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-sm font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
              Planned Stop Loss Price
            </label>
            <input
              type="number"
              step="0.10"
              value={stopPrice}
              onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-lg text-sm font-mono-num text-[#C1502E] outline-none focus:border-[#C1502E] transition-colors"
            />
          </div>
        </div>

        {/* Output & Recommendations */}
        <div className="space-y-4">
          <div className="terminal-card p-6 space-y-4 border-l-4 border-l-[#C9A227] bg-[#1A1608]/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C9A227] flex items-center gap-2">
              <Shield size={16} /> Recommended Position Size
            </h3>

            <div className="space-y-3 font-mono-num">
              <div>
                <span className="text-xs text-[#8B8D91] block">Maximum Allowed Risk ($)</span>
                <span className="text-2xl font-bold text-[#EDEAE3]">${result.riskAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="pt-2 border-t border-[#1E2226]">
                <span className="text-xs text-[#8B8D91] block">Recommended Lot Size</span>
                <span className="text-3xl font-bold text-[#C9A227]">{result.lotSize} Lots</span>
                <span className="text-[11px] text-[#8B8D91] block mt-0.5 font-body">
                  Based on stop distance of ${result.stopDistance} points
                </span>
              </div>
            </div>

            {/* Bridge Button: Use in Trade Entry */}
            <div className="pt-3 border-t border-[#1E2226]">
              <button
                type="button"
                onClick={handleUseInAddTrade}
                className="w-full py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
              >
                <PlusCircle size={14} /> Send to Add Trade Form <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Target Take Profit Calculator */}
          <div className="terminal-card p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B8D91] flex items-center gap-1.5">
              <Target size={14} className="text-[#3FA88C]" /> Target Price Levels for Risk-Reward
            </h3>

            <div className="space-y-2 text-xs font-mono-num">
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1B1F23] border border-[#262B30]">
                <span className="text-[#8B8D91]">Target 1:1 RR:</span>
                <span className="font-bold text-[#EDEAE3]">${tp1.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1B1F23] border border-[#262B30]">
                <span className="text-[#8B8D91]">Target 1:2 RR (Standard Target):</span>
                <span className="font-bold text-[#3FA88C]">${tp2.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#1B1F23] border border-[#262B30]">
                <span className="text-[#8B8D91]">Target 1:3 RR (Trend Runner):</span>
                <span className="font-bold text-[#C9A227]">${tp3.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

