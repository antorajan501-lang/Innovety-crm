import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Users, Home, AlertCircle, RefreshCw, X, Search, ShieldCheck,
  Zap, ArrowRightLeft, Sparkles, Filter, ChevronDown
} from 'lucide-react';
import api from '../../services/api';

const DAYS_HEADER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const format12Hour = (timeStr) => {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${mStr || '00'} ${period}`;
};

const ShiftCalendar = ({ organizationId, onOpenPlanner, onOpenOverride, onOpenSwap }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [calendarDays, setCalendarDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [daySchedule, setDaySchedule] = useState(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [daySearch, setDaySearch] = useState('');

  // Calculate month boundaries
  const { monthStart, monthEnd, daysInGrid } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday as index 0 (JS getDay(): Sun=0, Mon=1, ..., Sat=6)
    const firstDayIndex = (firstDay.getDay() + 6) % 7;
    const days = [];

    // Preceding padding days from previous month
    for (let i = firstDayIndex; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Trailing padding days to fill 35 or 42 grid cells
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
      }
    }

    const startDateStr = days[0].date.toISOString().split('T')[0];
    const endDateStr = days[days.length - 1].date.toISOString().split('T')[0];

    return {
      monthStart: startDateStr,
      monthEnd: endDateStr,
      daysInGrid: days
    };
  }, [currentDate]);

  // Fetch calendar summary data
  const fetchCalendarData = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/schedules/calendar', {
        params: {
          organizationId,
          startDate: monthStart,
          endDate: monthEnd
        }
      });
      if (res.data?.success) {
        setCalendarDays(res.data.days || []);
      }
    } catch (err) {
      console.warn('[ShiftCalendar] Error fetching calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [organizationId, monthStart, monthEnd]);

  // Fetch day schedule drill-down
  const handleSelectDay = async (dateStr) => {
    setSelectedDay(dateStr);
    setDaySearch('');
    try {
      setLoadingDay(true);
      const res = await api.get('/schedules/day', {
        params: { organizationId, date: dateStr }
      });
      if (res.data?.success) {
        setDaySchedule(res.data);
      }
    } catch (err) {
      console.warn('[ShiftCalendar] Error fetching day schedule:', err);
    } finally {
      setLoadingDay(false);
    }
  };

  const dayDataMap = useMemo(() => {
    const map = new Map();
    calendarDays.forEach(d => map.set(d.date, d));
    return map;
  }, [calendarDays]);

  const filteredRoster = useMemo(() => {
    if (!daySchedule?.roster) return [];
    if (!daySearch.trim()) return daySchedule.roster;
    const q = daySearch.toLowerCase().trim();
    return daySchedule.roster.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q) ||
      r.shiftName?.toLowerCase().includes(q)
    );
  }, [daySchedule, daySearch]);

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Top Header & Calendar Controls */}
      <div className="p-4 rounded-3xl bg-card border border-border/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground tracking-tight">{monthName}</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Interactive monthly shift schedule and daily roster drill-down.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1 bg-muted/30 border border-border/50 rounded-2xl p-1">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 rounded-xl hover:bg-muted text-xs font-black text-foreground transition-all cursor-pointer"
            >
              Today
            </button>

            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Schedule Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenPlanner}
              className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Plan Shift</span>
            </button>

            <button
              onClick={onOpenOverride}
              className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Override</span>
            </button>

            <button
              onClick={onOpenSwap}
              className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Swap</span>
            </button>

            <button
              onClick={fetchCalendarData}
              disabled={loading}
              className="p-2 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Calendar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid View */}
      <div className="rounded-3xl bg-card border border-border/60 shadow-xs overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20 text-center text-[11px] font-black uppercase tracking-wider text-muted-foreground py-2.5">
          {DAYS_HEADER.map(day => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Month Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
          {daysInGrid.map((item, idx) => {
            const dateStr = item.date.toISOString().split('T')[0];
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const data = dayDataMap.get(dateStr);
            const isSelected = selectedDay === dateStr;

            return (
              <motion.div
                key={dateStr || idx}
                whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.03)' }}
                onClick={() => handleSelectDay(dateStr)}
                className={`min-h-[100px] p-2 flex flex-col justify-between transition-all cursor-pointer relative ${
                  item.isCurrentMonth ? 'bg-card' : 'bg-muted/10 opacity-40'
                } ${isSelected ? 'ring-2 ring-emerald-500 z-10' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black h-6 w-6 rounded-full flex items-center justify-center ${
                    isToday
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : item.isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}>
                    {item.date.getDate()}
                  </span>

                  {data?.overrides > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono text-[9px] font-black border border-purple-500/25">
                      {data.overrides} Overrides
                    </span>
                  )}
                </div>

                {/* Day status chips */}
                {data && (
                  <div className="space-y-1 mt-2">
                    {data.working > 0 && (
                      <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold flex items-center justify-between">
                        <span>Working</span>
                        <span className="font-mono">{data.working}</span>
                      </div>
                    )}

                    {data.wfh > 0 && (
                      <div className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-extrabold flex items-center justify-between">
                        <span>WFH</span>
                        <span className="font-mono">{data.wfh}</span>
                      </div>
                    )}

                    {data.holiday > 0 && (
                      <div className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold flex items-center justify-between">
                        <span>Holiday</span>
                        <span className="font-mono">{data.holiday}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* DAY SCHEDULE DRILL-DOWN MODAL / DRAWER */}
      <AnimatePresence>
        {selectedDay && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 text-left my-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border/50 pb-3.5">
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Schedule for {new Date(selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Resolved employee shifts, active overrides, and swap records.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search & Action Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search employee, department, or shift..."
                    value={daySearch}
                    onChange={(e) => setDaySearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-medium rounded-xl border border-border/60 bg-muted/20 focus:bg-background outline-none transition-all"
                  />
                </div>
              </div>

              {/* Roster List */}
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {loadingDay ? (
                  <div className="py-12 text-center text-xs text-muted-foreground font-bold flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                    <span>Loading day schedule...</span>
                  </div>
                ) : filteredRoster.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No employees found matching query for this day.
                  </div>
                ) : (
                  filteredRoster.map((item) => {
                    const isOverride = item.scheduleType === 'OVERRIDE';
                    const isSwap = item.scheduleType === 'SWAP';
                    const isPlanned = item.scheduleType === 'PLANNED';

                    return (
                      <div
                        key={item.userId}
                        className="p-3 rounded-2xl bg-muted/20 border border-border/50 hover:border-border transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 font-black flex items-center justify-center text-xs shrink-0">
                            {item.name?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-foreground truncate flex items-center gap-1.5">
                              <span>{item.name}</span>
                              {isOverride && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 font-mono text-[9px] font-black border border-purple-500/20">
                                  Override
                                </span>
                              )}
                              {isSwap && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-600 font-mono text-[9px] font-black border border-blue-500/20">
                                  Swapped with {item.swappedWith}
                                </span>
                              )}
                              {isPlanned && (
                                <span className="px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-600 font-mono text-[9px] font-black border border-teal-500/20">
                                  Planned
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {item.department} • {item.email}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-xs font-black text-foreground">
                            {item.shiftName}
                          </div>
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.startTime} – {item.endTime} ({format12Hour(item.startTime)})
                          </div>
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                              item.scheduleStatus === 'Working'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : item.scheduleStatus === 'WFH'
                                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}>
                              {item.scheduleStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end border-t border-border/50 pt-3">
                <button
                  onClick={() => setSelectedDay(null)}
                  className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-black hover:opacity-90 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShiftCalendar;
