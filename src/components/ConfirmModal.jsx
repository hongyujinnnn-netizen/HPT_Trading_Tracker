import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Delete',
  confirmTone = 'danger',
  icon: Icon = Trash2,
}) {
  if (!isOpen) return null;

  const toneStyles = {
    danger: {
      iconBg: 'bg-[#4A2A1E]/50 text-[#C1502E] border-[#5C3426]',
      btnBg: 'bg-[#C1502E] hover:bg-[#D95B38] text-white shadow-[#C1502E]/20',
    },
    warning: {
      iconBg: 'bg-[#3D3216]/50 text-[#C9A227] border-[#59491F]',
      btnBg: 'bg-[#C9A227] hover:bg-[#E4C468] text-[#0A0C0E] shadow-[#C9A227]/20',
    },
  };

  const style = toneStyles[confirmTone] || toneStyles.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Modal Container */}
      <div className="bg-[#131619] border border-[#262B30] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[#5A5D61] hover:text-[#EDEAE3] hover:bg-[#1B1F23] rounded-lg transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-4">
          <div className={`p-3.5 rounded-xl border flex items-center justify-center shrink-0 ${style.iconBg}`}>
            <Icon size={24} />
          </div>

          <div className="space-y-1 pr-6">
            <h3 className="text-base font-bold font-display text-[#EDEAE3] leading-snug">
              {title}
            </h3>
            <p className="text-xs text-[#8B8D91] font-body leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1E2226]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold font-display bg-[#1B1F23] hover:bg-[#262B30] text-[#EDEAE3] border border-[#262B30] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold font-display transition-all shadow-md flex items-center gap-1.5 ${style.btnBg}`}
          >
            <Icon size={14} />
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
