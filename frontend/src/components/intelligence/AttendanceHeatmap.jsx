import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, User, Building2, RefreshCw, Info, Filter,
  CheckCircle2, AlertCircle, Clock, Home
} from 'lucide-react';
import api from '../../services/api';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_COLORS = {
  PRESENT: 'bg-emerald-500 hover:ring-2 hover:ring-emerald-400',
  LATE: 'bg-amber-500 hover:ring-2 hover:ring-amber-400',
  WFH: 'bg-indigo-500 hover:ring-2 hover:ring-indigo-400',
  LEAVE: 'bg-purple-500 hover:ring-2 hover:ring-purple-400',
  HOLIDAY: 'bg-teal-500 hover:ring-2 hover:ring-teal-400',
  ABSENT: 'bg-rose-500 hover:ring-2 hover:ring-rose-400',
  DAY_OFF: 'bg-muted/40 hover:bg-muted/70',
  FUTURE: 'bg-muted/20 border border-dashed border-border/60'
};

const INTENSITY_COLORS = [
  'bg-muted/30 hover:bg-muted/60',
  'bg-emerald-500/20 hover:ring-2 hover:ring-emerald-400',
  'bg-emerald-500/40 hover:ring-2 hover:ring-emerald-400',
  'bg-emerald-500/70 hover:ring-2 hover:ring-emerald-400',
  'bg-emerald-500 hover:ring-2 hover:ring-emerald-400'
];

const AttendanceHeatmap = ({ organizationId }) => {
  const [view, setView] = useState('company'); // 'company' | 'department' | 'individual'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [employees, setEmployees] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [weeksRange, setWeeksRange] = useState(26);

  // Tooltip Hover State
  const [hoveredCell, setHoveredCell] = useState(null);

  // Load employee & department options
  useEffect(() => {
    if (!organizationId) return;
    api.get('/users', { params: { organizationId, limit: 1000 } })
      .then(res => {
        if (res.data?.users) {
          const active = res.data.users.filter(u => u.status === 'ACTIVE');
          setEmployees(active);
          if (active.length > 0 && !selectedUserId) {
            setSelectedUserId(active[0].id);
          }
          const depts = Array.from(new Set(active.map(u => u.department).filter(Boolean)));
          setDepartments(depts);
          if (depts.length > 0 && !selectedDepartment) {
            setSelectedDepartment(depts[0]);
          }
        }
      })
      .catch(() => {});
  }, [organizationId]);

  const fetchHeatmap = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const params = {
        organizationId,
        view,
        ...(view === 'individual' && selectedUserId ? { userId: selectedUserId } : {}),
        ...(view === 'department' && selectedDepartment ? { department: selectedDepartment } : {})
      };

      const res = await api.get('/intelligence/heatmap', { params });
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching heatmap:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap();
  }, [organizationId, view, selectedUserId, selectedDepartment, weeksRange]);

  // Group days into 7 rows (Mon=0, Tue=1, ..., Sun=6)
  const columnsMatrix = useMemo(() => {
    if (!data?.days || data.days.length === 0) return [];

    const weeks = [];
    let currentWeek = [];

    data.days.forEach((day, index) => {
      // dayOfWeek: 0 = Sun, 1 = Mon ... 6 = Sat
      // Normalizing to Mon=0, ..., Sun=6
      const normalizedDayIndex = (day.dayOfWeek + 6) % 7;

      currentWeek.push({ ...day, normalizedDayIndex });

      if (normalizedDayIndex === 6 || index === data.days.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return weeks;
  }, [data]);

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & View Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-500" />
            <span>Attendance Heatmap Matrix</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            GitHub-style attendance intensity and daily punch classification across workforce tiers.
          </p>
        </div>

        {/* View Switcher & Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setView('company')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                view === 'company'
                  ? 'bg-card text-foreground shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Company</span>
            </button>

            <button
              onClick={() => setView('department')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                view === 'department'
                  ? 'bg-card text-foreground shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Department</span>
            </button>

            <button
              onClick={() => setView('individual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                view === 'individual'
                  ? 'bg-card text-foreground shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Individual</span>
            </button>
          </div>

          {/* Conditional Department Dropdown */}
          {view === 'department' && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-xs font-bold text-foreground outline-none shadow-xs"
            >
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {/* Conditional Employee Dropdown */}
          {view === 'individual' && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-border/60 bg-card text-xs font-bold text-foreground outline-none shadow-xs max-w-[180px] truncate"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.department || 'General'})</option>
              ))}
            </select>
          )}

          <button
            onClick={fetchHeatmap}
            disabled={loading}
            className="p-2 rounded-xl border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-xs cursor-pointer"
            title="Refresh Heatmap"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Heatmap Card */}
      <div className="p-6 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
        {/* Heatmap Header Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground capitalize">
              {view === 'individual'
                ? `Employee: ${data?.user?.name || 'Selected Employee'}`
                : view === 'department'
                ? `Department: ${data?.department || 'Selected Department'}`
                : `Company Wide (${data?.totalEmployees || 0} active members)`}
            </span>
            <span>•</span>
            <span className="text-[11px]">Period: {data?.startDate} to {data?.endDate}</span>
          </div>

          {/* Active Hover Detail Banner */}
          {hoveredCell && (
            <div className="px-3 py-1 rounded-xl bg-muted/80 text-[11px] font-bold text-foreground border border-border/60 animate-in fade-in duration-150">
              {hoveredCell.label}
            </div>
          )}
        </div>

        {/* Heatmap Grid Container */}
        <div className="overflow-x-auto pb-2 dash-scroll">
          <div className="inline-flex gap-1.5 select-none pt-2">
            {/* Weekdays Label Column */}
            <div className="flex flex-col gap-1.5 pr-2 justify-between py-0.5 text-[10px] font-bold text-muted-foreground/80 shrink-0">
              {WEEKDAYS.map((day, i) => (
                <div key={day} className="h-3.5 leading-none flex items-center">
                  {i % 2 === 0 ? day : ''}
                </div>
              ))}
            </div>

            {/* Weeks Columns */}
            {columnsMatrix.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {Array.from({ length: 7 }).map((_, dIdx) => {
                  const day = week.find(d => d.normalizedDayIndex === dIdx);
                  if (!day) {
                    return <div key={dIdx} className="w-3.5 h-3.5 rounded-sm bg-transparent" />;
                  }

                  let cellColorClass = 'bg-muted/40';
                  if (view === 'individual') {
                    cellColorClass = STATUS_COLORS[day.status] || STATUS_COLORS.DAY_OFF;
                  } else {
                    if (day.isHoliday) {
                      cellColorClass = 'bg-teal-500 hover:ring-2 hover:ring-teal-400';
                    } else {
                      cellColorClass = INTENSITY_COLORS[day.level] || INTENSITY_COLORS[0];
                    }
                  }

                  return (
                    <div
                      key={dIdx}
                      onMouseEnter={() => setHoveredCell(day)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`w-3.5 h-3.5 rounded-sm transition-all cursor-pointer ${cellColorClass}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40 text-[11px] flex-wrap gap-3">
          <span className="text-muted-foreground font-semibold">Legend:</span>
          {view === 'individual' ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Late</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> WFH</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" /> Leave</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> Holiday</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted/60 inline-block" /> Rest/Off</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[10px]">Less Turnout</span>
              {INTENSITY_COLORS.map((c, i) => (
                <span key={i} className={`w-3 h-3 rounded-sm ${c.split(' ')[0]} inline-block`} />
              ))}
              <span className="text-muted-foreground text-[10px]">Full Attendance</span>
              <span className="ml-2 flex items-center gap-1.5 text-teal-600">
                <span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> Holiday
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceHeatmap;
