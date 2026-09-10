import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, X, Clock } from 'lucide-react';

export default function ClockInToast({ toastData, onClose }) {
  useEffect(() => {
    if (toastData) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastData, onClose]);

  if (!toastData) return null;

  const isSuccess = toastData.type === 'success' || !toastData.type;
  const isLate = toastData.attendanceStatus === 'LATE';
  const statusLabel = isLate ? 'Late' : 'Present';
  const checkInTimeStr = toastData.checkInTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <AnimatePresence>
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -25, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="pointer-events-auto bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 relative overflow-hidden"
        >
          {/* Accent Glow Pill */}
          <div
            className={`absolute top-0 left-0 bottom-0 w-1.5 ${
              !isSuccess
                ? 'bg-rose-500'
                : isLate
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />

          {/* Icon Badge */}
          <div
            className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
              !isSuccess
                ? 'bg-rose-500/10 text-rose-500'
                : isLate
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            {!isSuccess ? (
              <XCircle className="w-6 h-6 animate-pulse" />
            ) : isLate ? (
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            ) : (
              <CheckCircle2 className="w-6 h-6 animate-bounce" />
            )}
          </div>

          {/* Toast Text Content */}
          <div className="flex-1 text-left min-w-0 pr-4">
            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5 leading-tight">
              {!isSuccess ? (
                toastData.title || 'Clock-In Failed'
              ) : (
                'Clock-In Successful!'
              )}
            </h4>

            {isSuccess ? (
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide ${
                    isLate
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {statusLabel} • {checkInTimeStr}
                </span>
              </div>
            ) : (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                {toastData.message || 'Please try again.'}
              </p>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
