import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, Clock, Home, Calendar, AlertTriangle, Zap,
  TrendingUp, RefreshCw, BarChart3, ShieldCheck, CheckCircle2, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../services/api';

const ExecutiveDashboard = ({ organizationId }) => {
  const [kpis, setKpis] = useState(null);
  const [trends, setTrends] = useState([]);
  const [trendDays, setTrendDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [kpiRes, trendRes] = await Promise.all([
        api.get('/intelligence/executive', { params: { organizationId } }),
        api.get('/intelligence/trends', { params: { organizationId, days: trendDays } })
      ]);

      if (kpiRes.data?.success) setKpis(kpiRes.data);
      if (trendRes.data?.success) setTrends(trendRes.data.trends || []);
    } catch (err) {
      console.warn('Error fetching executive dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId, trendDays]);

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
        <span className="text-xs font-bold">Aggregating executive workforce metrics...</span>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Workforce',
      value: kpis?.totalEmployees || 0,
      sub: 'Active employees',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      label: 'Present Today',
      value: kpis?.presentToday || 0,
      sub: `${kpis?.attendanceRate || 0}% workforce on duty`,
      icon: UserCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20'
    },
    {
      label: 'Late Arrivals',
      value: kpis?.lateToday || 0,
      sub: 'Clocked in past shift start',
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20'
    },
    {
      label: 'Remote (WFH)',
      value: kpis?.wfhToday || 0,
      sub: 'Working from home today',
      icon: Home,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 border-indigo-500/20'
    },
    {
      label: 'Holiday Today',
      value: kpis?.holidayToday ? 'YES' : 'NO',
      sub: kpis?.holidayName || 'Standard working day',
      icon: Calendar,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10 border-teal-500/20'
    },
    {
      label: 'Overtime Today',
      value: `${kpis?.overtimeHoursToday || 0}h`,
      sub: 'Accumulated beyond 8h',
      icon: Zap,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/20'
    },
    {
      label: 'Active Shifts',
      value: kpis?.activeShifts || 0,
      sub: 'Configured roster shifts',
      icon: ShieldCheck,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10 border-cyan-500/20'
    },
    {
      label: 'Attendance Rate',
      value: `${kpis?.attendanceRate || 0}%`,
      sub: 'Turnout today',
      icon: TrendingUp,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/20'
    }
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <span>Executive Workforce Analytics</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time executive metrics, attendance velocity, and overtime analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Trend Period Selector */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl text-[11px] font-bold">
            {[14, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  trendDays === d
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {d} Days
              </button>
            ))}
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
      </div>

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`p-4 rounded-3xl border ${kpi.bg} bg-card/60 backdrop-blur-xs shadow-xs space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div className={`p-1.5 rounded-xl ${kpi.color} bg-background/80 shadow-xs`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tracking-tight">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground font-semibold truncate mt-0.5">{kpi.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recharts Analytics Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance Trend (30 Days) */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                Attendance & Remote Velocity
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Present vs WFH daily distribution</p>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {trendDays}d Trend
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="wfhGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#presentGrad)" />
                <Area type="monotone" dataKey="wfh" name="WFH" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#wfhGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Late Arrival & Overtime Trend */}
        <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                Late Arrivals & Overtime Hours
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Discrepancy and extra hours tracking</p>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Punctuality & OT
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="late" name="Late Arrivals" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="overtimeHours" name="Overtime (Hours)" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
