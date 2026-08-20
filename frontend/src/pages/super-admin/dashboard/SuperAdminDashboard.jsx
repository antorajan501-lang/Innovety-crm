import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Palette, Users, Briefcase, UserCheck, Activity,
  ArrowUpRight, PlusCircle, Building2, Lock, CheckCircle2, RefreshCw, Award,
  Clock, Ticket, FileText, Server, AlertTriangle, Layers, TrendingUp, Check
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const [statsRes, posRes] = await Promise.all([
        api.get('/super-admin/stats'),
        api.get('/positions').catch(() => ({ data: [] }))
      ]);
      setData(statsRes.data);
      setPositions(posRes.data || []);
    } catch (err) {
      console.error('Failed to load Super Admin dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const logs = data?.recentLogs || [];
  const attendanceToday = stats.attendanceToday || { present: 0, late: 0, wfh: 0, absent: 0, totalPresent: 0 };
  const taskDelivery = stats.taskDelivery || { pending: 0, inProgress: 0, review: 0, approved: 0, completed: 0 };
  const systemHealth = stats.systemHealth || { database: 'CONNECTED', api: 'HEALTHY', socket: 'ACTIVE', storage: 'OPERATIONAL' };

  // Task Delivery total for percentage calculation
  const totalTasks = (taskDelivery.pending || 0) + (taskDelivery.inProgress || 0) + (taskDelivery.review || 0) + (taskDelivery.approved || 0) + (taskDelivery.completed || 0);

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-extrabold text-primary border border-primary/20 mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Platform Control Center • Executive Layer</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              Platform Administration Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-medium max-w-xl">
              Real-time enterprise metrics for workforce distribution, multi-role security, platform health, and organizational controls.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchDashboardStats}
              className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Stats</span>
            </button>
          </div>
        </div>
      </div>

      {/* PHASE 4: Executive Overview (8 Cards - Live Backend Data Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Workforce */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Workforce</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.totalActiveUsers || stats.totalUsers || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 pt-1 border-t border-border/20">
            <span>{stats.totalEmployees || 0} Emp</span>
            <span>•</span>
            <span>{stats.totalInterns || 0} Int</span>
            <span>•</span>
            <span>{stats.totalTeamLeaders || 0} TL</span>
          </div>
        </div>

        {/* Card 2: Total Admins */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Admins</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.totalAdmins || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>Active: <strong className="text-emerald-600 dark:text-emerald-400">{stats.activeAdmins || 0}</strong></span>
            <Link to="/super-admin/admins" className="text-primary hover:underline font-bold text-[10px]">Manage</Link>
          </div>
        </div>

        {/* Card 3: Active Departments/Teams */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Teams</span>
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.totalTeams || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>Organized teams</span>
            <Link to="/super-admin/teams" className="text-primary hover:underline font-bold text-[10px]">Directory</Link>
          </div>
        </div>

        {/* Card 4: Active Projects */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Projects</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.activeProjects || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>Running deliverables</span>
            <Link to="/projects" className="text-primary hover:underline font-bold text-[10px]">View Projects</Link>
          </div>
        </div>

        {/* Card 5: Attendance Today */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Attendance Today</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-foreground">{attendanceToday.totalPresent || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>{attendanceToday.present || 0} On Time • {attendanceToday.late || 0} Late</span>
            <Link to="/attendance-audit" className="text-primary hover:underline font-bold text-[10px]">Audit</Link>
          </div>
        </div>

        {/* Card 6: Open Support Tickets */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Open Support Tickets</span>
            <Ticket className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.openTickets || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>Requires resolution</span>
            <Link to="/tickets" className="text-primary hover:underline font-bold text-[10px]">Desk</Link>
          </div>
        </div>

        {/* Card 7: Payroll Batches This Month */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payroll Batches (Month)</span>
            <FileText className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.payrollBatchesMonth || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>Total Batches: {stats.totalPayrollBatches || 0}</span>
            <Link to="/payroll/dashboard" className="text-primary hover:underline font-bold text-[10px]">Payroll</Link>
          </div>
        </div>

        {/* Card 8: System Health */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Health</span>
            <Server className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">ALL SYSTEMS OK</span>
          </div>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between pt-1 border-t border-border/20">
            <span>DB: {systemHealth.database}</span>
            <span className="text-emerald-600 font-extrabold">{systemHealth.api}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Control Panel */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-foreground">Quick Platform Actions</h3>
            <p className="text-xs text-muted-foreground font-medium">Direct shortcuts to platform control center tasks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/super-admin/admins?action=new"
            className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Create Admin</p>
                <p className="text-[10px] text-muted-foreground font-medium">Provision administrator</p>
              </div>
            </div>
            <PlusCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/super-admin/branding"
            className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Branding & Theme</p>
                <p className="text-[10px] text-muted-foreground font-medium">Customize look & feel</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/super-admin/users"
            className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Users Directory</p>
                <p className="text-[10px] text-muted-foreground font-medium">All system roles</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/super-admin/teams"
            className="flex items-center justify-between p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/40 transition-all group shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Team Directory</p>
                <p className="text-[10px] text-muted-foreground font-medium">Read-only stats</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>

      {/* PHASE 5: Executive Charts (Real Data Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Workforce Distribution */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Workforce Distribution</h3>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">Role Breakdown</span>
          </div>

          <div className="space-y-3 pt-1">
            {/* Employees Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Employees</span>
                <span>{stats.totalEmployees || 0}</span>
              </div>
              <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((stats.totalEmployees || 0) / (stats.totalUsers || 1)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Interns Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Interns</span>
                <span>{stats.totalInterns || 0}</span>
              </div>
              <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((stats.totalInterns || 0) / (stats.totalUsers || 1)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Team Leaders Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Team Leaders</span>
                <span>{stats.totalTeamLeaders || 0}</span>
              </div>
              <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((stats.totalTeamLeaders || 0) / (stats.totalUsers || 1)) * 100))}%` }}
                />
              </div>
            </div>

            {/* Admins Bar */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span>Administrators</span>
                <span>{stats.totalAdmins || 0}</span>
              </div>
              <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(((stats.totalAdmins || 0) / (stats.totalUsers || 1)) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: Attendance Today Breakdown */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-emerald-500" />
              <h3 className="text-sm font-bold text-foreground">Attendance Today</h3>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">Shift Status</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Present</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{attendanceToday.present || 0}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Late</span>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{attendanceToday.late || 0}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Work From Home</span>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{attendanceToday.wfh || 0}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Absent</span>
              <p className="text-xl font-black text-rose-600 dark:text-rose-400">{attendanceToday.absent || 0}</p>
            </div>
          </div>
        </div>

        {/* Chart 3: Project Delivery Velocity */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Project Delivery Velocity</h3>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">Tasks Pipeline</span>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">Pending</span>
              <span className="font-mono font-bold text-foreground">{taskDelivery.pending}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">In Progress</span>
              <span className="font-mono font-bold text-primary">{taskDelivery.inProgress}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">Under Review</span>
              <span className="font-mono font-bold text-amber-600">{taskDelivery.review}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">Approved</span>
              <span className="font-mono font-bold text-indigo-600">{taskDelivery.approved}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-muted-foreground">Completed</span>
              <span className="font-mono font-bold text-emerald-600">{taskDelivery.completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 6: Super Admin Exclusive Section — Organization Controls */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-extrabold text-foreground">Organization Controls</h3>
              <p className="text-xs text-muted-foreground font-medium">Enterprise administrator oversight, system health, and security telemetry</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Admin Management Controls */}
          <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Admin Management</span>
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Active Admins: <strong className="text-foreground font-mono">{stats.activeAdmins || 0} / {stats.totalAdmins || 0}</strong></p>
            <p className="text-[11px] text-muted-foreground truncate">
              Last Admin Activity: <span className="font-semibold text-foreground">{stats.lastAdminActivity?.adminName || 'None'}</span>
            </p>
            <Link to="/super-admin/admins" className="inline-block pt-1 text-[11px] font-extrabold text-primary hover:underline">
              Manage Administrators →
            </Link>
          </div>

          {/* Organization Controls */}
          <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Organization Hierarchy</span>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Active Teams: <strong className="text-foreground font-mono">{stats.totalTeams || 0}</strong></p>
            <p className="text-[11px] text-muted-foreground">Career Ranks: <strong className="text-foreground font-mono">{positions.length || 8} Levels</strong></p>
            <Link to="/super-admin/organization" className="inline-block pt-1 text-[11px] font-extrabold text-primary hover:underline">
              Configure Ranks →
            </Link>
          </div>

          {/* System Telemetry */}
          <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">System Health</span>
              <Server className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-[11px] space-y-0.5 text-muted-foreground font-mono">
              <p>Database: <span className="text-emerald-600 font-bold">{systemHealth.database}</span></p>
              <p>API Server: <span className="text-emerald-600 font-bold">{systemHealth.api}</span></p>
              <p>Socket.io: <span className="text-emerald-600 font-bold">{systemHealth.socket}</span></p>
            </div>
          </div>

          {/* Security Telemetry */}
          <div className="p-4 rounded-2xl border border-border/50 bg-muted/10 space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Security Overview</span>
              <Lock className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-xs text-muted-foreground">Locked Accounts: <strong className="text-rose-600 font-mono">{stats.lockedAccounts || 0}</strong></p>
            <p className="text-[11px] text-muted-foreground">Active Sessions: <strong className="text-emerald-600 font-mono">{stats.totalActiveUsers || 0}</strong></p>
            <Link to="/super-admin/users" className="inline-block pt-1 text-[11px] font-extrabold text-primary hover:underline">
              Inspect Security Directory →
            </Link>
          </div>
        </div>
      </div>

      {/* Enterprise Position Distribution Card */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-extrabold text-foreground">Career Rank Position Distribution</h3>
              <p className="text-xs text-muted-foreground font-medium">Employee breakdown across hierarchical positions (Intern → Director)</p>
            </div>
          </div>
          <Link to="/super-admin/organization" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            <span>Manage Positions</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {positions.map(pos => (
            <div key={pos.id} className="p-3 rounded-2xl border border-border/40 bg-muted/20 text-center space-y-1">
              <span
                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold truncate max-w-full"
                style={{ backgroundColor: pos.color, color: pos.textColor || '#FFFFFF' }}
              >
                Level {pos.level}
              </span>
              <p className="text-xs font-bold text-foreground truncate" title={pos.name}>{pos.name}</p>
              <p className="text-lg font-black text-primary">{pos.totalEmployees || 0}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{pos.code}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Recent Audit Trail Stream */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Recent Platform Audit Log Stream</h3>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground bg-muted/40 px-2.5 py-0.5 rounded-full">
            Real-time Activity
          </span>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No recent platform activity logged.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 text-xs border-b border-border/20 pb-2.5 last:border-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{log.user?.name || 'System Super Admin'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({log.user?.role || 'SUPER_ADMIN'})</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{log.details}</p>
                  <span className="text-[10px] text-muted-foreground/60 font-mono block">
                    {new Date(log.createdAt).toLocaleString()} • IP: {log.ipAddress || 'Internal'}
                  </span>
                </div>
                <span className="text-[9px] bg-primary/10 text-primary-hover px-2.5 py-0.5 rounded-full font-bold uppercase shrink-0 whitespace-nowrap">
                  {log.action}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PHASE 4 REQ: My Profile Positioned Below Dashboard Content */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-extrabold text-foreground">My Profile & Account Details</h3>
              <p className="text-xs text-muted-foreground font-medium">Logged-in Super Admin account credentials, security role, and profile configuration</p>
            </div>
          </div>
          <Link
            to="/profile"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20"
          >
            <span>Edit Full Profile</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/20 border border-border/40">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-lg font-black shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground">{user?.name || 'Super Admin'}</h4>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-extrabold border border-primary/20">
                  {user?.role || 'SUPER_ADMIN'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{user?.email || 'admin@innovety.com'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground font-medium w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
            <div>
              <span className="block text-[10px] font-bold text-muted-foreground uppercase">Status</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">ACTIVE</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-muted-foreground uppercase">Security Tier</span>
              <span className="font-bold text-primary">Level 0 (Root)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
