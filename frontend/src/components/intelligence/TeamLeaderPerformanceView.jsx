import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, Clock, AlertTriangle, Calendar, ShieldCheck,
  RefreshCw, CheckCircle2, ChevronRight, Briefcase, Eye
} from 'lucide-react';
import api from '../../services/api';

const TeamLeaderPerformanceView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/intelligence/team-performance');
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching TL performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-emerald-500" />
        <span>Loading team attendance performance...</span>
      </div>
    );
  }

  const {
    teamName,
    totalMembers,
    attendanceRateToday,
    presentCount,
    lateMembers,
    missingClockOuts,
    upcomingLeaves,
    shiftCoverage
  } = data || {};

  return (
    <div className="space-y-5 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" />
            <span>{teamName || 'My Team'} Performance</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational status, attendance health, missing clock-outs, and roster coverage for your direct team.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top 3 KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-3xl border border-border/60 bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Team Attendance</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500">{attendanceRateToday}%</span>
            <span className="text-xs text-muted-foreground font-semibold">({presentCount}/{totalMembers} Present)</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl border border-border/60 bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Late Today</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-500">{lateMembers?.length || 0}</span>
            <span className="text-xs text-muted-foreground font-semibold">members delayed</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl border border-border/60 bg-card shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">Missing Clock-Out</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-500">{missingClockOuts?.length || 0}</span>
            <span className="text-xs text-muted-foreground font-semibold">unclosed punches</span>
          </div>
        </div>
      </div>

      {/* 2 Columns: Late/Missing Punches and Shift Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Exceptions & Attention List */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Attendance Exceptions & Follow-Ups</span>
          </h3>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {/* Missing Clock-Outs */}
            {missingClockOuts?.map(item => (
              <div key={item.id} className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">Clocked in {item.date} at {item.clockInTime}</span>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">
                  {item.hoursElapsed}h open
                </span>
              </div>
            ))}

            {/* Late Arrivals */}
            {lateMembers?.map(item => (
              <div key={item.id} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">{item.name}</span>
                  <span className="text-[10px] text-muted-foreground">Clocked in at {item.clockInTime}</span>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-[10px]">
                  +{item.lateMinutes}m late
                </span>
              </div>
            ))}

            {(!missingClockOuts || missingClockOuts.length === 0) && (!lateMembers || lateMembers.length === 0) && (
              <div className="p-6 text-center text-xs font-bold text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/40">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                <span>Zero attendance exceptions in your team today!</span>
              </div>
            )}
          </div>
        </div>

        {/* Shift Coverage Today */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Shift Staffing Distribution</span>
          </h3>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {shiftCoverage?.map((cov, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-muted/20 border border-border/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-foreground block">{cov.shiftName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{cov.timings}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-bold text-[10px]">
                    {cov.presentCount}/{cov.assignedCount} Active
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {cov.members.map(m => (
                    <span
                      key={m.id}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        m.isPresent
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.name} {m.isPresent ? '✓' : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamLeaderPerformanceView;
