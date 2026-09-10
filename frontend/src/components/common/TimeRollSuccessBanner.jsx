import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, LogOut } from 'lucide-react';

export default function TimeRollSuccessBanner({
  clockInToast,
  toastData = null,
  time,
  dateFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
  customTimeFormat = null,
  size = 'md' // 'sm' | 'md' | 'lg'
}) {
  const activeData = toastData || clockInToast;
  const isClockOut = activeData?.mode === 'clockOut' || activeData?.isClockOut;

  return (
    <AnimatePresence mode="wait">
      {activeData ? (
        <motion.div
          key={isClockOut ? 'roll-clockout-panel' : 'roll-clockin-panel'}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex flex-col items-center justify-center text-center py-0.5 space-y-1 w-full overflow-hidden"
        >
          {isClockOut ? (
            activeData.type === 'success' ? (
              <>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="p-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                    <LogOut className={`${size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} shrink-0 text-blue-500`} />
                  </div>
                  <p className={`font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
                    Clock-Out Successful!
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold">
                  See you tomorrow 👋
                </p>
                <div className="flex items-center justify-center gap-2 text-xs font-bold mt-0.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    Clock-Out: {activeData.clockOutTime}
                  </span>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                    Duration: {activeData.workingDuration}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className={`font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
                  <AlertCircle className={`${size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} shrink-0 text-rose-500`} />
                  <span>Clock-Out Failed</span>
                </p>
                <p className="text-[11px] font-bold text-rose-500 mt-0.5">
                  {activeData.message || 'Please try again.'}
                </p>
              </>
            )
          ) : (
            activeData.type === 'success' ? (
              <>
                <p className={`font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
                  <CheckCircle2 className={`${size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} shrink-0 text-emerald-500 animate-bounce`} />
                  <span>Clock-In Successful!</span>
                </p>
                <div className="flex items-center justify-center gap-2 text-xs font-bold mt-0.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                    activeData.attendanceStatus === 'LATE'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeData.attendanceStatus === 'LATE' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {activeData.attendanceStatus === 'LATE' ? 'LATE' : 'PRESENT'}
                  </span>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="font-mono text-foreground font-extrabold text-sm">{activeData.checkInTime}</span>
                </div>
              </>
            ) : (
              <>
                <p className={`font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
                  <AlertCircle className={`${size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} shrink-0 text-rose-500`} />
                  <span>Clock-In Failed</span>
                </p>
                <p className="text-[11px] font-bold text-rose-500 mt-0.5">
                  {activeData.message || 'Please try again.'}
                </p>
              </>
            )
          )}
        </motion.div>
      ) : (
        <motion.div
          key="roll-live-time"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex flex-col items-center justify-center text-center w-full"
        >
          <span className={`font-black font-mono tracking-tight text-primary block ${
            size === 'lg' ? 'text-3xl' : 'text-2xl'
          }`}>
            {customTimeFormat || time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={`text-muted-foreground font-bold block mt-0.5 ${
            size === 'lg' ? 'text-xs' : 'text-[11px]'
          }`}>
            {time.toLocaleDateString('en-US', dateFormatOptions)}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
