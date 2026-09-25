import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, X, ShieldAlert, Check, ArrowRight } from 'lucide-react';

const ShiftConflictAssistantModal = ({
  isOpen,
  onClose,
  conflicts = [],
  onProceedAnyway
}) => {
  if (!isOpen || !conflicts || conflicts.length === 0) return null;

  const hasErrors = conflicts.some(c => c.severity === 'ERROR');

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-3xl border border-border/70 bg-card p-6 shadow-2xl space-y-4 text-left"
      >
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-inner ${
              hasErrors
                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            }`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Scheduling Conflicts Detected
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                {conflicts.length} issue(s) identified across the requested schedule assignment.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conflicts List */}
        <div className="max-h-72 overflow-y-auto space-y-2.5">
          {conflicts.map((conf, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                conf.severity === 'ERROR'
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : 'bg-amber-500/5 border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-md ${
                  conf.severity === 'ERROR' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {conf.title}
                </span>
                <span className="font-extrabold text-foreground">{conf.employeeName}</span>
              </div>

              <p className="text-foreground/90 font-medium leading-relaxed">
                {conf.message}
              </p>

              {conf.suggestion && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                  <span>Recommendation: {conf.suggestion}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted border border-border cursor-pointer transition-all"
          >
            Cancel & Fix Details
          </button>

          {!hasErrors && (
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onProceedAnyway) onProceedAnyway();
              }}
              className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 cursor-pointer transition-all"
            >
              Acknowledge & Proceed
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ShiftConflictAssistantModal;
