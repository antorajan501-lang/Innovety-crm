import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sun,
  Home,
  Briefcase,
  ShieldAlert,
  Info,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  Sparkles,
  Lock,
  Building2,
  Palmtree
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Helper component for smooth horizontal scrolling text when title overflows cell width
const AutoMarqueeText = ({ text, className = '' }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [text]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden whitespace-nowrap relative text-center">
      <span
        ref={textRef}
        className={`inline-block text-xs font-medium ${className} ${
          isOverflowing ? 'animate-marquee-scroll hover:pause-marquee' : 'truncate'
        }`}
      >
        {text}
      </span>
    </div>
  );
};

// Check if a title is a generic status default (which should NOT be rendered in normal cells)
const isGenericTitle = (title) => {
  if (!title) return true;
  const lower = title.trim().toLowerCase();
  return [
    'working day',
    'work from home',
    'sunday',
    'standard working day',
    'saturday default wfh',
    'fixed weekly holiday',
    'wfh'
  ].includes(lower);
};

// Status Configuration Tokens with rich soft corporate background colors & matching text tokens
const STATUS_TOKENS = {
  WORKING_DAY: {
    label: 'Working Day',
    cellBg: 'bg-[#D3F3E7] dark:bg-emerald-950/40 text-[#087443] dark:text-emerald-200 hover:bg-[#C2EDE0] dark:hover:bg-emerald-900/50 border-[#B5EADB]/40',
    legendBg: 'bg-[#D3F3E7] text-[#087443] border-[#A8E2CD] dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800/60',
    indicatorBg: 'bg-[#087443] dark:bg-emerald-400',
    textCls: 'text-[#087443] dark:text-emerald-200',
    icon: Briefcase
  },
  WFH: {
    label: 'Work From Home',
    cellBg: 'bg-[#CCE3FA] dark:bg-sky-950/40 text-[#124A9E] dark:text-sky-200 hover:bg-[#BADAFA] dark:hover:bg-sky-900/50 border-[#AEDBFA]/40',
    legendBg: 'bg-[#CCE3FA] text-[#124A9E] border-[#A3CEFA] dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800/60',
    indicatorBg: 'bg-[#124A9E] dark:bg-sky-400',
    textCls: 'text-[#124A9E] dark:text-sky-200',
    icon: Home
  },
  HOLIDAY: {
    label: 'Company Holiday',
    cellBg: 'bg-[#FFDAE0] dark:bg-rose-950/40 text-[#A81D37] dark:text-rose-200 hover:bg-[#FCD0D8] dark:hover:bg-rose-900/50 border-[#FBBFCB]/40',
    legendBg: 'bg-[#FFDAE0] text-[#A81D37] border-[#FCA5B5] dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800/60',
    indicatorBg: 'bg-[#A81D37] dark:bg-rose-400',
    textCls: 'text-[#A81D37] dark:text-rose-200',
    icon: Building2
  },
  MY_LEAVE: {
    label: 'My Leave',
    cellBg: 'bg-[#FFE5C0] dark:bg-amber-950/40 text-[#9E5D12] dark:text-amber-200 hover:bg-[#FCDBAA] dark:hover:bg-amber-900/50 border-[#FAD296]/40',
    legendBg: 'bg-[#FFE5C0] text-[#9E5D12] border-[#FCD298] dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800/60',
    indicatorBg: 'bg-[#9E5D12] dark:bg-amber-400',
    textCls: 'text-[#9E5D12] dark:text-amber-200',
    icon: Palmtree
  },
  SUNDAY: {
    label: 'Sunday',
    cellBg: 'bg-[#E9ECEF] dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 hover:bg-[#DFE3E8] dark:hover:bg-slate-800/80 border-[#CBD5E1]/40',
    legendBg: 'bg-[#E9ECEF] text-[#475569] border-[#CBD5E1] dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
    indicatorBg: 'bg-[#475569] dark:bg-slate-400',
    textCls: 'text-[#475569] dark:text-slate-300',
    icon: Lock
  }
};

const WorkCalendar = () => {
  const { user } = useAuth();
  const isAdminOrSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  // Dynamic real-world today string
  const realToday = new Date();
  const todayStr = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected date details modal state
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // In-Place Edit Mode state for Date Override
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    date: '',
    status: 'WORKING_DAY',
    title: '',
    reason: '',
    isPermanent: false
  });
  const [saving, setSaving] = useState(false);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Fetch Monthly Calendar Data
  const fetchCalendar = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await api.get(`/work-calendar?month=${month}&year=${year}`);
      setCalendarDays(res.data.days || []);
    } catch (err) {
      console.error('Failed to load work calendar:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load work calendar data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [month, year]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  // Navigates directly to the actual current real-world month & year
  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  // Open Modal (Date Override Form DIRECTLY for Admin/Super Admin on editable dates)
  const handleDayClick = (dayItem) => {
    setSelectedDay(dayItem);
    let defaultStatus = dayItem.status;
    if (dayItem.status === 'SUNDAY') defaultStatus = 'HOLIDAY';
    if (dayItem.status === 'MY_LEAVE') defaultStatus = dayItem.dayOfWeek === 6 ? 'WFH' : 'WORKING_DAY';

    setEditForm({
      date: dayItem.date,
      status: ['WORKING_DAY', 'WFH', 'HOLIDAY'].includes(defaultStatus) ? defaultStatus : 'WORKING_DAY',
      title: dayItem.title && !isGenericTitle(dayItem.title) ? dayItem.title : '',
      reason: dayItem.reason && !['Saturday Default WFH', 'Standard Working Day', 'Fixed Weekly Holiday'].includes(dayItem.reason) ? dayItem.reason : '',
      isPermanent: Boolean(dayItem.isPermanent)
    });

    // Admin / Super Admin opening an editable (non-Sunday) date -> open Override Form directly
    if (isAdminOrSuperAdmin && !dayItem.isSunday) {
      setIsEditMode(true);
    } else {
      setIsEditMode(false);
    }
    setIsDetailsOpen(true);
  };

  // Close Override Form and discard changes
  const handleCancelEdit = () => {
    setIsDetailsOpen(false);
    setIsEditMode(false);
  };

  // Save Override Handler (Admin / Super Admin)
  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!selectedDay || selectedDay.isSunday) return;

    try {
      setSaving(true);
      setErrorMsg('');

      const cleanTitle = editForm.title.trim();
      const cleanReason = editForm.reason.trim();
      const payload = {
        date: editForm.date,
        status: editForm.status,
        title: cleanTitle || null,
        reason: cleanReason || null,
        isPermanent: editForm.status === 'HOLIDAY' ? editForm.isPermanent : false
      };

      await api.post('/work-calendar', payload);

      setSuccessMsg('Calendar date override saved successfully.');
      setIsDetailsOpen(false);
      setIsEditMode(false);
      fetchCalendar();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Save override error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save calendar override.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Override Handler (Admin / Super Admin)
  const handleDeleteOverride = async () => {
    if (!selectedDay?.overrideId) return;
    if (!window.confirm('Are you sure you want to delete this custom override? The date will revert to its default schedule.')) return;

    try {
      setSaving(true);
      await api.delete(`/work-calendar/${selectedDay.overrideId}`);

      setSuccessMsg('Override deleted. Date restored to default schedule.');
      setIsDetailsOpen(false);
      setIsEditMode(false);
      fetchCalendar();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Delete override error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to delete override.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate previous month padding dates
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun, ..., 6 = Sat
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const prevMonthPaddingDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthPaddingDays.push(daysInPrevMonth - i);
  }

  // Calculate next month padding dates to complete grid (35 or 42 cells total)
  const totalCurrentMonthCells = firstDayOfWeek + calendarDays.length;
  const totalGridCells = totalCurrentMonthCells > 35 ? 42 : 35;
  const nextMonthPaddingCount = totalGridCells - totalCurrentMonthCells;

  const nextMonthPaddingDays = [];
  for (let i = 1; i <= nextMonthPaddingCount; i++) {
    nextMonthPaddingDays.push(i);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 md:p-8 max-w-7xl mx-auto space-y-6"
    >
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Work Calendar</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Overview of working days, WFH schedule, company holidays, and personal leaves.
              </p>
            </div>
          </div>
        </div>

        {/* Month Navigation & Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto bg-card border border-border rounded-xl p-1.5 shadow-sm">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Today
          </button>
          <span className="px-3 py-1 font-semibold text-sm min-w-[130px] text-center text-foreground">
            {monthName} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Alert Toasts */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-danger/20 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-success/20 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Calendar Legend Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
        <span className="font-semibold text-muted-foreground uppercase text-[11px] tracking-wider">Legend:</span>
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          {Object.entries(STATUS_TOKENS).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div
                key={key}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium ${config.legendBg}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${config.indicatorBg}`} />
                <Icon className="w-3.5 h-3.5" />
                <span>{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Monthly Calendar Grid */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Day Header Row (Sun header remains red) */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center font-semibold text-xs py-3 text-muted-foreground uppercase tracking-wider">
          <div className="text-rose-500 dark:text-rose-400">Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div className="text-sky-500 dark:text-sky-400">Sat</div>
        </div>

        {/* Days Grid */}
        {loading ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading calendar schedule...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/60 bg-background">
            {/* Previous Month Faded Padding Days (Neutral/white background, faded gray date) */}
            {prevMonthPaddingDays.map((prevDay) => (
              <div
                key={`prev-${prevDay}`}
                className="p-2.5 md:p-3.5 min-h-[95px] md:min-h-[115px] flex flex-col items-center justify-center text-center bg-white dark:bg-card select-none"
              >
                <span className="text-lg md:text-xl font-normal text-slate-400 dark:text-slate-600 select-none">
                  {prevDay}
                </span>
              </div>
            ))}

            {/* Current Month Calendar Days */}
            {calendarDays.map((dayItem) => {
              const dayNum = parseInt(dayItem.date.split('-')[2], 10);
              const isToday = dayItem.date === todayStr;
              const config = STATUS_TOKENS[dayItem.status] || STATUS_TOKENS.WORKING_DAY;
              const showCustomTitle = !isGenericTitle(dayItem.title);

              return (
                <div
                  key={dayItem.date}
                  onClick={() => handleDayClick(dayItem)}
                  className={`group relative p-2.5 md:p-3.5 min-h-[95px] md:min-h-[115px] flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 ${
                    config.cellBg
                  } ${
                    isToday ? 'ring-2 ring-[#087443] ring-inset shadow-xs' : ''
                  }`}
                >
                  {/* Today Indicator Badge */}
                  {isToday && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#087443] text-white uppercase tracking-wider shadow-xs">
                      TODAY
                    </span>
                  )}

                  {/* Permanent Holiday Sparkles */}
                  {dayItem.isPermanent && (
                    <span className="absolute top-1.5 left-1.5" title="Annual Permanent Holiday">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    </span>
                  )}

                  {/* Centered Date Number */}
                  <span
                    className={`text-lg md:text-xl font-medium transition-transform group-hover:scale-105 ${
                      isToday
                        ? 'w-8 h-8 rounded-full bg-[#087443] text-white flex items-center justify-center font-semibold shadow-xs'
                        : config.textCls
                    }`}
                  >
                    {dayNum}
                  </span>

                  {/* Custom Title ONLY (Centered below date number with auto marquee scroll) */}
                  {showCustomTitle && (
                    <div className="mt-1.5 w-full overflow-hidden px-1">
                      <AutoMarqueeText
                        text={dayItem.title}
                        className={`text-xs font-semibold ${config.textCls} leading-tight`}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Next Month Faded Padding Days (Neutral/white background, faded gray date) */}
            {nextMonthPaddingDays.map((nextDay) => (
              <div
                key={`next-${nextDay}`}
                className="p-2.5 md:p-3.5 min-h-[95px] md:min-h-[115px] flex flex-col items-center justify-center text-center bg-white dark:bg-card select-none"
              >
                <span className="text-lg md:text-xl font-normal text-slate-400 dark:text-slate-600 select-none">
                  {nextDay}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Single Date Details & Edit Override Modal */}
      <AnimatePresence>
        {isDetailsOpen && selectedDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between border-b border-border/40 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('default', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEditMode ? 'Date Override Form' : 'Work Calendar Date Details'}
                  </p>
                </div>
                <button
                  onClick={() => { setIsDetailsOpen(false); setIsEditMode(false); }}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!isEditMode ? (
                /* READ-ONLY DETAILS VIEW */
                <div className="space-y-4">
                  {/* Status Badge */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                    {(() => {
                      const cfg = STATUS_TOKENS[selectedDay.status] || STATUS_TOKENS.WORKING_DAY;
                      const Icon = cfg.icon;
                      return (
                        <div className={`mt-1 flex items-center gap-2 px-3 py-2 rounded-xl border font-semibold text-sm ${cfg.legendBg}`}>
                          <span className={`w-3 h-3 rounded-full ${cfg.indicatorBg}`} />
                          <Icon className="w-4 h-4" />
                          <span>{cfg.label}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</label>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{selectedDay.title || 'Standard Schedule'}</p>
                  </div>

                  {/* Reason / Details */}
                  {selectedDay.reason && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details / Reason</label>
                      <p className="text-sm text-foreground/90 bg-muted/40 p-3 rounded-xl border border-border/50 mt-1 whitespace-pre-wrap">
                        {selectedDay.reason}
                      </p>
                    </div>
                  )}

                  {/* Permanent Holiday Flag */}
                  {selectedDay.isPermanent && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
                      <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>This is an annual recurring permanent company holiday.</span>
                    </div>
                  )}

                  {/* Created By Metadata */}
                  {selectedDay.createdBy && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                      <Info className="w-3.5 h-3.5" />
                      <span>Configured by Admin: <strong>{selectedDay.createdBy}</strong></span>
                    </div>
                  )}

                  {/* Sunday Locked Warning Banner */}
                  {selectedDay.isSunday && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 flex items-start gap-2.5 text-xs">
                      <Lock className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                      <div>
                        <strong className="font-semibold block">Sunday — Fixed Holiday</strong>
                        Sunday is a fixed weekly holiday and cannot be modified.
                      </div>
                    </div>
                  )}

                  {/* Read-Only Action Buttons */}
                  <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
                    {selectedDay.overrideId && isAdminOrSuperAdmin && !selectedDay.isSunday && (
                      <button
                        onClick={handleDeleteOverride}
                        disabled={saving}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Override
                      </button>
                    )}

                    {isAdminOrSuperAdmin && !selectedDay.isSunday && (
                      <button
                        onClick={handleStartEdit}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        Override
                      </button>
                    )}

                    <button
                      onClick={() => { setIsDetailsOpen(false); setIsEditMode(false); }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                /* IN-PLACE EDIT MODE FORM */
                <form onSubmit={handleSaveOverride} className="space-y-4">
                  {/* Status Selector */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Status</label>
                    <select
                      value={editForm.status}
                      disabled={selectedDay.isSunday}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    >
                      <option value="WORKING_DAY">🟢 Working Day</option>
                      <option value="WFH">🔵 Work From Home</option>
                      <option value="HOLIDAY">🔴 Company Holiday</option>
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Independence Day / Special Working Day"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  {/* Reason / Details */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Details / Reason</label>
                    <textarea
                      rows={3}
                      placeholder="Enter reason or additional details..."
                      value={editForm.reason}
                      onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    />
                  </div>

                  {/* Permanent Holiday Checkbox (Only when status is HOLIDAY) */}
                  {editForm.status === 'HOLIDAY' && (
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editForm.isPermanent}
                        onChange={(e) => setEditForm({ ...editForm, isPermanent: e.target.checked })}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">
                        Make this holiday permanent every year
                      </span>
                    </label>
                  )}

                  {/* Edit Mode Buttons */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-4">
                    {selectedDay.overrideId ? (
                      <button
                        type="button"
                        onClick={handleDeleteOverride}
                        disabled={saving}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Override
                      </button>
                    ) : <div />}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {saving ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default WorkCalendar;
