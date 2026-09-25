import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Users, Home, Calendar, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Building2, ShieldCheck,
  TrendingUp, Sparkles
} from 'lucide-react';

const format12Hour = (timeStr) => {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${mStr || '00'} ${period}`;
};

const ShiftAnalyticsBar = ({
  analytics,
  loading = false,
  onSelectShiftForDrawer = null
}) => {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const kpis = analytics?.kpis || {
    totalShifts: 0,
    assignedMembers: 0,
    workingToday: 0,
    wfhToday: 0,
    holidayToday: 0
  };

  const breakdown = analytics?.breakdown || [];

  return (
    <div className="space-y-3">
      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Shifts */}
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-foreground tracking-tight">
              {loading ? '...' : kpis.totalShifts}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground truncate">
              Total Shifts
            </div>
          </div>
        </div>

        {/* Assigned Members */}
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-foreground tracking-tight">
              {loading ? '...' : kpis.assignedMembers}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground truncate">
              Assigned Members
            </div>
          </div>
        </div>

        {/* Working Today */}
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {loading ? '...' : kpis.workingToday}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground truncate">
              Working Today
            </div>
          </div>
        </div>

        {/* WFH Today */}
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Home className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
              {loading ? '...' : kpis.wfhToday}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground truncate">
              WFH Today
            </div>
          </div>
        </div>

        {/* Holiday Today */}
        <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex items-center gap-3.5 col-span-2 sm:col-span-1">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {loading ? '...' : kpis.holidayToday}
            </div>
            <div className="text-[11px] font-bold text-muted-foreground truncate">
              Holiday Today
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Section: Today's Attendance by Shift */}
      <div className="rounded-3xl bg-card border border-border/60 shadow-xs overflow-hidden transition-all">
        <button
          onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-muted/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-black text-foreground uppercase tracking-wider">
              Today's Attendance by Shift
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Live Breakdown
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span>{isBreakdownOpen ? 'Hide Breakdown' : 'Show Breakdown'}</span>
            {isBreakdownOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        <AnimatePresence>
          {isBreakdownOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border/60 overflow-hidden"
            >
              {breakdown.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No shift breakdown available for today.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/60 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        <th className="py-3 px-4">Shift Name</th>
                        <th className="py-3 px-4">Timings</th>
                        <th className="py-3 px-4">Schedule Today</th>
                        <th className="py-3 px-4 text-center">Assigned</th>
                        <th className="py-3 px-4 text-center">Present</th>
                        <th className="py-3 px-4 text-center">Late</th>
                        <th className="py-3 px-4 text-center">WFH</th>
                        <th className="py-3 px-4">Assigned Departments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {breakdown.map((row) => {
                        const isDefault = row.shiftName === 'Company Default';
                        const statusBadge =
                          row.todayStatus === 'Working'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : row.todayStatus === 'WFH'
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20';

                        return (
                          <tr
                            key={row.shiftId}
                            onClick={() => onSelectShiftForDrawer && onSelectShiftForDrawer(row.shiftId)}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            title="Click to open shift details drawer"
                          >
                            <td className="py-3 px-4 font-extrabold text-foreground">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{row.shiftName}</span>
                                {isDefault && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                                    Default
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {row.startTime} – {row.endTime}
                              <span className="text-[10px] text-muted-foreground ml-1">
                                ({format12Hour(row.startTime)})
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-block px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${statusBadge}`}>
                                {row.todayStatus}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center font-bold text-foreground">
                              {row.assignedCount}
                            </td>

                            <td className="py-3 px-4 text-center font-bold text-teal-600 dark:text-teal-400">
                              {row.presentToday}
                            </td>

                            <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                              {row.lateToday}
                            </td>

                            <td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400">
                              {row.wfhCount}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {row.assignedDepartments?.length > 0 ? (
                                  row.assignedDepartments.map((d, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-foreground truncate max-w-[120px]"
                                    >
                                      {d}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">
                                    None
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ShiftAnalyticsBar;
