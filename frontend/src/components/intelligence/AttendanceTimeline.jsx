import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Coffee, Play, Square, Zap, CheckCircle2, AlertCircle
} from 'lucide-react';

const TYPE_ICONS = {
  CLOCK_IN: Play,
  BREAK: Coffee,
  RESUME: Clock,
  CLOCK_OUT: Square,
  OVERTIME: Zap
};

const TYPE_BG = {
  CLOCK_IN: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  BREAK: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RESUME: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  CLOCK_OUT: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  OVERTIME: 'bg-teal-500/10 text-teal-600 border-teal-500/20'
};

const AttendanceTimeline = ({ events = [] }) => {
  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center rounded-3xl border border-dashed border-border/60 bg-card/40 space-y-1.5 text-left">
        <Clock className="h-6 w-6 text-muted-foreground/30 mx-auto" />
        <p className="text-xs font-bold text-foreground text-center">No Shift Punches Captured Yet</p>
        <p className="text-[11px] text-muted-foreground text-center">Today's punch milestones will appear here once clocked in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-primary" />
          <span>Today's Shift Activity Timeline</span>
        </h3>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
          {events.length} Milestones
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
        {events.map((evt, idx) => {
          const Icon = TYPE_ICONS[evt.type] || Clock;
          const style = TYPE_BG[evt.type] || TYPE_BG.CLOCK_IN;

          return (
            <motion.div
              key={evt.id || idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative flex items-start justify-between gap-3 group"
            >
              {/* Timeline Dot Icon */}
              <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border ${style} flex items-center justify-center bg-card shadow-xs`}>
                <Icon className="h-2.5 w-2.5" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-foreground">{evt.title}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${style}`}>
                    {evt.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{evt.subtitle}</p>
              </div>

              <div className="px-2 py-1 rounded-xl bg-muted/60 text-[11px] font-mono font-bold text-foreground shrink-0 shadow-xs">
                {evt.time}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceTimeline;
