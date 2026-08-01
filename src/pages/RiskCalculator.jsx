import React, { useState, useMemo } from 'react';
import { Calculator, Shield, Target, Info, AlertCircle } from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { calculateLotSize } from '../utils/calculations';

export function RiskCalculator() {
  const { settings } = useTrade();

  const [balance, setBalance] = useState(settings.accountBalance);
  const [riskPct, setRiskPct] = useState(settings.defaultRiskPct);
  const [entryPrice, setEntryPrice] = useState(2431.20);
  const [stopPrice, setStopPrice] = useState(2422.00);

  const contractSize = settings.contractSize || 100;

  const result = useMemo(() => {
    return calculateLotSize(balance, riskPct, entryPrice, stopPrice, contractSize);
  }, [balance, riskPct, entryPrice, stopPrice, contractSize]);

  // Calculate target prices for 1:1, 1:2, 1:3 RR ratios
  const stopDist = Math.abs(entryPrice - stopPrice);
  const tp1 = entryPrice > stopPrice ? entryPrice + stopDist : entryPrice - stopDist;
  const tp2 = entryPrice > stopPrice ? entryPrice + stopDist * 2 : entryPrice - stopDist * 2;
  const tp3 = entryPrice > stopPrice ? entryPrice + stopDist * 3 : entryPrice - stopDist * 3;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold font-display text-[#EDEAE3]">XAU/USD Risk &amp; Lot Size Calculator</h1>
        <p className="text-xs text-[#8B8D91]">
          Calculate precise position lot sizes tailored for Gold standard contracts ({contractSize} oz/lot)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calculator Inputs */}
        <div className="terminal-card p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B8D91] flex items-center gap-2">
            <Calculator size={16} className="text-[#C9A227]" /> Input Position Specs
          </h3>

          <div>
            <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
              Account Balance ($USD)
            </label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227]"
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
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-[#8B8D91] tracking-wider block mb-1">
              Planned Entry Price
            </label>
            <input
              type="number"
              step="0.10"
              value={entryPrice}
              onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#EDEAE3] outline-none focus:border-[#C9A227]"
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
              className="w-full px-3 py-2 bg-[#1B1F23] border border-[#262B30] rounded-md text-sm font-mono-num text-[#C1502E] outline-none focus:border-[#C1502E]"
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
                <span className="text-2xl font-bold text-[#EDEAE3]">${result.riskAmount.toLocaleString()}</span>
              </div>

              <div className="pt-2 border-t border-[#1E2226]">
                <span className="text-xs text-[#8B8D91] block">Recommended Lot Size</span>
                <span className="text-3xl font-bold text-[#C9A227]">{result.lotSize} Lots</span>
                <span className="text-[11px] text-[#8B8D91] block mt-0.5 font-body">
                  Based on stop distance of ${result.stopDistance} points
                </span>
              </div>
            </div>
          </div>

          {/* Target Take Profit Calculator */}
          <div className="terminal-card p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8B8D91] flex items-center gap-1.5">
              <Target size={14} className="text-[#3FA88C]" /> Target Price Levels for Risk-Reward
            </h3>

            <div className="space-y-2 text-xs font-mono-num">
              <div className="flex justify-between items-center p-2 rounded bg-[#1B1F23]">
                <span className="text-[#8B8D91]">Target 1:1 RR:</span>
                <span className="font-bold text-[#EDEAE3]">${tp1.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-[#1B1F23]">
                <span className="text-[#8B8D91]">Target 1:2 RR (Target):</span>
                <span className="font-bold text-[#3FA88C]">${tp2.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-[#1B1F23]">
                <span className="text-[#8B8D91]">Target 1:3 RR (Runner):</span>
                <span className="font-bold text-[#C9A227]">${tp3.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
