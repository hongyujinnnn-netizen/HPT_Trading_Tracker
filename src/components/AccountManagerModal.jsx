import React, { useState } from 'react';
import {
  X,
  Plus,
  Building2,
  Check,
  Shield,
  Trash2,
  Edit2,
  DollarSign,
  Info,
  Archive,
  Layers,
} from 'lucide-react';
import { useTrade } from '../context/TradeContext';
import { BROKER_OPTIONS, ACCOUNT_TYPE_LABELS } from '../types/accountSchema';

const COLOR_PRESETS = [
  '#C9A227', // Gold
  '#3B82F6', // Blue
  '#10B981', // Emerald Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

const LEVERAGE_OPTIONS = ['1:50', '1:100', '1:200', '1:500', '1:1000', '1:2000', '1:Unlimited'];
const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'THB', 'JPY', 'AUD'];

export function AccountManagerModal({ isOpen, onClose }) {
  const {
    tradingAccounts,
    activeAccountId,
    setActiveAccountId,
    addTradingAccount,
    updateTradingAccount,
    archiveTradingAccount,
    trades,
  } = useTrade();

  const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    broker: 'Exness',
    accountType: 'live',
    accountNumber: '',
    initialBalance: 10000,
    currency: 'USD',
    leverage: '1:500',
    colorHex: '#C9A227',
    currencyMode: 'standard',
    isDefault: false,
  });

  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const visibleAccounts = tradingAccounts.filter((a) => !a.isArchived);

  const resetForm = () => {
    setFormData({
      name: '',
      broker: 'Exness',
      accountType: 'live',
      accountNumber: '',
      initialBalance: 10000,
      currency: 'USD',
      leverage: '1:500',
      colorHex: '#C9A227',
      currencyMode: 'standard',
      isDefault: false,
    });
    setErrorMsg('');
  };

  const handleStartCreate = () => {
    resetForm();
    setMode('create');
  };

  const handleStartEdit = (account) => {
    setEditingId(account.id);
    setFormData({
      name: account.name,
      broker: account.broker,
      accountType: account.accountType,
      accountNumber: account.accountNumber || '',
      initialBalance: account.initialBalance,
      currency: account.currency || 'USD',
      leverage: account.leverage || '1:500',
      colorHex: account.colorHex || '#C9A227',
      currencyMode: account.currencyMode || 'standard',
      isDefault: account.isDefault || false,
    });
    setErrorMsg('');
    setMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Account name is required.');
      return;
    }

    if (mode === 'create') {
      const created = await addTradingAccount(formData);
      if (created) {
        setActiveAccountId(created.id);
      }
    } else if (mode === 'edit' && editingId) {
      await updateTradingAccount(editingId, formData);
    }

    setMode('list');
  };

  const handleArchive = async (accountId) => {
    const accountTrades = trades.filter((t) => t.accountId === accountId);
    const confirmMessage = accountTrades.length > 0
      ? `Archive sub-account "${accountId}"? Its ${accountTrades.length} historical trades will be preserved safely in Trade History.`
      : `Archive sub-account?`;

    if (window.confirm(confirmMessage)) {
      await archiveTradingAccount(accountId);
      if (activeAccountId === accountId) {
        setActiveAccountId('all');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#101418] border border-[#262B33] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#1E232B] flex items-center justify-between bg-[#14181D]">
          <div className="flex items-center gap-2">
            <Building2 className="text-[#C9A227]" size={20} />
            <div>
              <h2 className="text-sm font-semibold text-[#EDEAE3]">
                Trading Sub-Accounts Manager
              </h2>
              <p className="text-[11px] text-[#8B8D91]">
                Broker accounts, FTMO challenges, and strategy backtest accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1E232B] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-[#262B33]">
          {mode === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8B8D91] font-mono">
                  Active Accounts ({visibleAccounts.length})
                </span>
                <button
                  onClick={handleStartCreate}
                  className="px-3 py-1.5 rounded-lg bg-[#C9A227] hover:bg-[#E6C65C] text-black font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Plus size={14} />
                  <span>New Sub-Account</span>
                </button>
              </div>

              {/* Accounts Cards List */}
              {visibleAccounts.length === 0 ? (
                <div className="p-8 text-center bg-[#14181D] border border-[#222730] rounded-xl space-y-3">
                  <Building2 size={32} className="mx-auto text-[#C9A227]" />
                  <div className="text-sm font-semibold text-[#EDEAE3]">No Trading Sub-Accounts Yet</div>
                  <p className="text-xs text-[#8B8D91] max-w-sm mx-auto">
                    Create your first real trading sub-account (e.g. Exness Live, FTMO Challenge, or IC Markets Demo) to organize your trades by broker and account type.
                  </p>
                  <button
                    onClick={handleStartCreate}
                    className="px-4 py-2 rounded-lg bg-[#C9A227] hover:bg-[#E6C65C] text-black font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Plus size={14} />
                    <span>Create Your First Sub-Account</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                {visibleAccounts.map((account) => {
                  const accountTrades = trades.filter((t) => t.accountId === account.id);
                  const isSelected = activeAccountId === account.id;

                  return (
                    <div
                      key={account.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#181D24] border-[#C9A227]'
                          : 'bg-[#14181D] border-[#222730] hover:border-[#333A46]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-black flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: account.colorHex || '#C9A227' }}
                        >
                          {account.broker.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#EDEAE3] truncate">
                              {account.name}
                            </span>
                            {account.isDefault && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/30 font-medium">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#8B8D91] mt-1 font-mono">
                            <span className="text-[#C9A227] capitalize">{account.broker}</span>
                            <span>•</span>
                            <span>{ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}</span>
                            <span>•</span>
                            <span>{account.leverage}</span>
                            <span>•</span>
                            <span className="text-[#22C55E]">
                              ${account.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {account.currency}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6B7280] mt-0.5">
                            {accountTrades.length} trades recorded
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        {!isSelected && (
                          <button
                            onClick={() => setActiveAccountId(account.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#1E232B] hover:bg-[#2A313C] text-xs text-[#EDEAE3] font-medium transition-all"
                          >
                            Select
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(account)}
                          className="p-1.5 rounded-lg text-[#8B8D91] hover:text-[#EDEAE3] hover:bg-[#1E232B] transition-all"
                          title="Edit Sub-Account"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleArchive(account.id)}
                          className="p-1.5 rounded-lg text-[#8B8D91] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all"
                          title="Archive Sub-Account"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          ) : (
            /* Create / Edit Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E232B] pb-3">
                <h3 className="text-sm font-semibold text-[#EDEAE3]">
                  {mode === 'create' ? 'Create New Sub-Account' : 'Edit Sub-Account'}
                </h3>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="text-xs text-[#8B8D91] hover:text-[#EDEAE3]"
                >
                  ← Back to List
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Exness Live Standard"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Broker / Platform
                  </label>
                  <select
                    value={formData.broker}
                    onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none"
                  >
                    {BROKER_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Account Type
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none"
                  >
                    <option value="live">Live Account</option>
                    <option value="demo">Demo Account</option>
                    <option value="challenge">Prop Firm Challenge</option>
                    <option value="backtest">Backtest Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Account Number / Login (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8821940"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Initial Balance ($)
                  </label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Base Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Account Mode
                  </label>
                  <select
                    value={formData.currencyMode}
                    onChange={(e) => setFormData({ ...formData, currencyMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none"
                  >
                    <option value="standard">Standard ($)</option>
                    <option value="cent">Cent Account (USC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1">
                    Leverage
                  </label>
                  <select
                    value={formData.leverage}
                    onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#14181D] border border-[#262B33] text-xs text-[#EDEAE3] focus:border-[#C9A227] focus:outline-none"
                  >
                    {LEVERAGE_OPTIONS.map((lev) => (
                      <option key={lev} value={lev}>{lev}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color Preset Selector */}
              <div>
                <label className="block text-[11px] text-[#8B8D91] uppercase tracking-wider mb-1.5">
                  Account Theme Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setFormData({ ...formData, colorHex: hex })}
                      className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center ${
                        formData.colorHex === hex ? 'scale-110 ring-2 ring-white/50' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {formData.colorHex === hex && <Check size={14} className="text-black font-bold" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded bg-[#14181D] border-[#262B33] text-[#C9A227] focus:ring-[#C9A227]"
                />
                <label htmlFor="isDefault" className="text-xs text-[#EDEAE3] select-none">
                  Set as default account on application startup
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E232B]">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-4 py-2 rounded-lg bg-[#1E232B] hover:bg-[#2A313C] text-xs text-[#8B8D91] font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#C9A227] hover:bg-[#E6C65C] text-black font-semibold text-xs transition-all shadow-md"
                >
                  {mode === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
