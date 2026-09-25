import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, Calendar, UserCheck, Coffee, Zap, Shield, AlertCircle,
  CheckCircle2, RefreshCw, ChevronRight, Award, Home, Briefcase
} from 'lucide-react';
import api from '../../services/api';
import AttendanceTimeline from './AttendanceTimeline';

const EmployeeSelfService = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/intelligence/self-service');
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching self service data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        <span>Loading your employee self-service dashboard...</span>
      </div>
    );
  }

  const { employee, today, upcoming, monthlySummary, timeline } = data || {};

  return (
    <div className="space-y-6 text-left">
      {/* Top Welcome Banner */}
      <div className="p-6 rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 inline-block mb-1.5">
            Self-Service Hub
          </span>
          <h2 className="text-xl font-black text-foreground">
            Welcome back, {employee?.name || 'Team Member'} 👋
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {employee?.department || 'Operations'} • ID: {employee?.employeeId || 'N/A'} • Shift Portal
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Sync Status</span>
        </button>
      </div>

      {/* 3 Major Pillars: Today, Upcoming, Monthly */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PILLAR 1: TODAY'S SHIFT & CLOCK-IN STATUS */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Today's Shift</h3>
              </div>

              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                today?.clockInStatus === 'CLOCKED_IN'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 animate-pulse'
                  : today?.clockInStatus === 'CLOCKED_OUT'
                  ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {today?.clockInStatus?.replace('_', ' ')}
              </span>
            </div>

            {/* Shift Card Details */}
            <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/40 space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground block">Assigned Shift</span>
              <p className="text-sm font-black text-foreground">{today?.shift?.name || 'Company Default'}</p>
              <p className="text-xs text-primary font-mono font-bold">
                {today?.shift?.startTime || '09:00'} – {today?.shift?.endTime || '18:00'}
              </p>
              {today?.shift?.isCustomSchedule && (
                <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  {today?.shift?.scheduleType} Override
                </span>
              )}
            </div>

            {/* Punches & Elapsed Time */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground block">Clock In</span>
                <span className="text-xs font-black text-foreground mt-0.5 block">{today?.clockInTime || '--:--'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground block">Clock Out</span>
                <span className="text-xs font-black text-foreground mt-0.5 block">{today?.clockOutTime || '--:--'}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">Working Hours Today</span>
              <span className="font-mono font-black text-emerald-600 text-sm">{today?.workingHours || 0} hrs</span>
            </div>
          </div>

          {/* Break Summary */}
          <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Coffee className="h-3.5 w-3.5 text-amber-500" />
              <span>{today?.breakSummary?.breakSchedule}</span>
            </span>
            <span className="font-bold text-foreground">{today?.breakSummary?.breakStatus}</span>
          </div>
        </div>

        {/* PILLAR 2: UPCOMING SHIFTS, LEAVES & HOLIDAYS */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Upcoming Schedule</h3>
              </div>
            </div>

            {/* Tomorrow's Shift */}
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Tomorrow's Shift</span>
              <p className="text-xs font-black text-foreground">{upcoming?.tomorrow?.shift?.name || 'Company Default'}</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {upcoming?.tomorrow?.shift?.startTime || '09:00'} – {upcoming?.tomorrow?.shift?.endTime || '18:00'}
              </p>
            </div>

            {/* Upcoming Leaves */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Upcoming Approved Leaves</span>
              {upcoming?.leaves?.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  No upcoming leaves scheduled.
                </p>
              ) : (
                upcoming?.leaves?.map(l => (
                  <div key={l.id} className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground block">{l.reason || 'Personal'}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{l.startDate} to {l.endDate}</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-purple-500/20 text-purple-600">
                      {l.status}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Upcoming Holidays */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Next Public Holiday</span>
              {upcoming?.holidays?.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  No public holidays in near horizon.
                </p>
              ) : (
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs flex items-center justify-between">
                  <span className="font-bold text-foreground">{upcoming?.holidays[0]?.name}</span>
                  <span className="text-[10px] font-mono text-teal-600 font-bold">{upcoming?.holidays[0]?.date}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PILLAR 3: MONTHLY SUMMARY & LEAVE BALANCES */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
                  <Award className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  {monthlySummary?.monthLabel} Metrics
                </h3>
              </div>
            </div>

            {/* 4 Quick Monthly Stat Tiles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground block">Turnout %</span>
                <span className="text-base font-black text-foreground mt-0.5 block">{monthlySummary?.attendanceRate}%</span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground block">Late Arrivals</span>
                <span className="text-base font-black text-amber-500 mt-0.5 block">{monthlySummary?.lateArrivalCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground block">Overtime Hours</span>
                <span className="text-base font-black text-purple-500 mt-0.5 block">{monthlySummary?.overtimeHours}h</span>
              </div>
              <div className="p-3 rounded-2xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground block">Active Leave Types</span>
                <span className="text-base font-black text-blue-500 mt-0.5 block">{monthlySummary?.leaveBalances?.length || 3}</span>
              </div>
            </div>

            {/* Remaining Leave Balances */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Leave Balances Remaining</span>
              <div className="space-y-1.5">
                {monthlySummary?.leaveBalances?.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2.5 rounded-xl">Standard statutory quota active.</p>
                ) : (
                  monthlySummary?.leaveBalances?.map((b, idx) => (
                    <div key={b.id || idx} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs flex items-center justify-between">
                      <span className="font-bold text-foreground">Leave Quota Type #{idx + 1}</span>
                      <span className="font-mono text-primary font-bold">{b.remainingDays} days left</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Activity Timeline */}
      <div className="p-6 rounded-3xl border border-border/60 bg-card shadow-xs">
        <AttendanceTimeline events={timeline || []} />
      </div>
    </div>
  );
};

export default EmployeeSelfService;
