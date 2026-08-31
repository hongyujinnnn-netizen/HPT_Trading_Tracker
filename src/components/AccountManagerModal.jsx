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
      <div className="relative w-full max-w-xl terminal-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
          <div className="flex items-center gap-2">
            <Building2 className="text-amber-500 dark:text-[#C9A227]" size={20} />
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                Trading Sub-Accounts Manager
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Broker accounts, FTMO challenges, and strategy backtest accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border hover:opacity-80 transition-all"
            style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 scrollbar-thin">
          {mode === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--color-text-dim)' }}>
                  Active Accounts ({visibleAccounts.length})
                </span>
                <button
                  onClick={handleStartCreate}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Plus size={14} />
                  <span>New Sub-Account</span>
                </button>
              </div>

              {/* Accounts Cards List */}
              {visibleAccounts.length === 0 ? (
                <div className="p-8 text-center border rounded-2xl space-y-3" style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)' }}>
                  <Building2 size={32} className="mx-auto text-amber-500 dark:text-[#C9A227]" />
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>No Trading Sub-Accounts Yet</div>
                  <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                    Create your first real trading sub-account (e.g. Exness Live, FTMO Challenge, or IC Markets Demo) to organize your trades by broker and account type.
                  </p>
                  <button
                    onClick={handleStartCreate}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md"
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
                          ? 'border-amber-500 ring-1 ring-amber-500/30 shadow-md'
                          : 'hover:opacity-85'
                      }`}
                      style={{
                        background: 'var(--color-elevated)',
                        borderColor: !isSelected ? 'var(--color-border-soft)' : undefined,
                      }}
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
                            <span className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-main)' }}>
                              {account.name}
                            </span>
                            {account.isDefault && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-700 dark:text-[#C9A227] border border-amber-500/30 font-bold">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-1 font-mono" style={{ color: 'var(--color-text-dim)' }}>
                            <span className="text-amber-600 dark:text-[#C9A227] font-semibold capitalize">{account.broker}</span>
                            <span>•</span>
                            <span>{ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}</span>
                            <span>•</span>
                            <span>{account.leverage}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              ${account.initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {account.currency}
                            </span>
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {accountTrades.length} trades recorded
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                        {!isSelected && (
                          <button
                            onClick={() => setActiveAccountId(account.id)}
                            className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold hover:opacity-80 transition-all"
                            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-main)' }}
                          >
                            Select
                          </button>
                        )}
                        <button
                          onClick={() => handleStartEdit(account)}
                          className="p-1.5 rounded-lg border hover:opacity-80 transition-all"
                          style={{ borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
                          title="Edit Sub-Account"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleArchive(account.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
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
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border-soft)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                  {mode === 'create' ? 'Create New Sub-Account' : 'Edit Sub-Account'}
                </h3>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="text-xs hover:opacity-80"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ← Back to List
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Account Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Exness Live Standard"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-input"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Broker / Platform
                  </label>
                  <select
                    value={formData.broker}
                    onChange={(e) => setFormData({ ...formData, broker: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-select"
                  >
                    {BROKER_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Account Type
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-select"
                  >
                    <option value="live">Live Account</option>
                    <option value="demo">Demo Account</option>
                    <option value="challenge">Prop Firm Challenge</option>
                    <option value="backtest">Backtest Account</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Account Number / Login (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 8821940"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Initial Balance ($)
                  </label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={formData.initialBalance}
                    onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-input font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Base Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-select"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Account Mode
                  </label>
                  <select
                    value={formData.currencyMode}
                    onChange={(e) => setFormData({ ...formData, currencyMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-select"
                  >
                    <option value="standard">Standard ($)</option>
                    <option value="cent">Cent Account (USC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-dim)' }}>
                    Leverage
                  </label>
                  <select
                    value={formData.leverage}
                    onChange={(e) => setFormData({ ...formData, leverage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs terminal-select"
                  >
                    {LEVERAGE_OPTIONS.map((lev) => (
                      <option key={lev} value={lev}>{lev}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color Preset Selector */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-dim)' }}>
                  Account Theme Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setFormData({ ...formData, colorHex: hex })}
                      className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center ${
                        formData.colorHex === hex ? 'scale-110 ring-2 ring-amber-500' : 'hover:scale-105'
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
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="isDefault" className="text-xs select-none" style={{ color: 'var(--color-text-main)' }}>
                  Set as default account on application startup
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--color-border-soft)' }}>
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="px-4 py-2 rounded-lg border text-xs font-medium hover:opacity-80 transition-all"
                  style={{ background: 'var(--color-elevated)', borderColor: 'var(--color-border-soft)', color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#C9A227] to-[#D4AF37] hover:brightness-105 text-[#080A0D] font-bold text-xs transition-all shadow-md"
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
