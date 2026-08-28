import React from 'react';
import { AlertTriangle, LogOut, CheckSquare, X } from 'lucide-react';

export const ClockOutReminderModal = ({
  isOpen,
  onClose,
  onCompleteWorkLog,
  onClockOutAnyway,
  isDraft = false,
  hasWorkLog = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 text-left animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border/80 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Daily Work Log Pending</h3>
              <p className="text-xs text-muted-foreground">End of Shift Reminder</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Body */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          {isDraft ? (
            <>
              <p className="font-semibold text-sm">
                Your Daily Work Log is still saved as a draft.
              </p>
              <p className="text-xs opacity-90">
                Would you like to submit it before clocking out?
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-sm">
                You haven't completed today's Daily Work Log.
              </p>
              <p className="text-xs opacity-90">
                Would you like to complete it before clocking out?
              </p>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onClockOutAnyway}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border/80 text-foreground hover:bg-muted font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Clock Out Anyway
          </button>

          <button
            type="button"
            onClick={onCompleteWorkLog}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" /> Complete Work Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClockOutReminderModal;
