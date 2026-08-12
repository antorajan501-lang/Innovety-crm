import React, { useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This task will be submitted for approval and cannot be moved until it is approved.",
  confirmText = "Yes",
  cancelText = "No",
  variant = "primary" // "primary" | "danger"
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      tabIndex={-1}
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 outline-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[460px] bg-white dark:bg-card border border-border/50 rounded-[24px] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        {/* Top Header Icon & Close button */}
        <div className="flex items-start justify-between gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isDanger 
              ? 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400' 
              : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
          }`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Message */}
        <div className="space-y-2">
          <h3 id="confirm-modal-title" className="text-xl font-bold text-foreground tracking-tight">
            {title}
          </h3>
          <p id="confirm-modal-description" className="text-sm text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold text-sm transition-all cursor-pointer text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 min-h-[44px] px-5 py-2.5 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer text-center ${
              isDanger 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
