import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Palette, Users, Briefcase, UserCheck, Activity,
  ArrowUpRight, PlusCircle, Building2, Lock, CheckCircle2, RefreshCw, Award
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

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-extrabold text-primary border border-primary/20 mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Platform Control Center • Super Admin Layer</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              Platform Administration
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-medium max-w-xl">
              Configure company branding, manage administrator access, oversee multi-role users, and inspect enterprise organization statistics.
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

      {/* Quick Action Control Panel */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
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

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Users</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.totalUsers || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-2 pt-1 border-t border-border/20">
            <span>{stats.totalEmployees || 0} Employees</span>
            <span>•</span>
            <span>{stats.totalInterns || 0} Interns</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Administrators</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.totalAdmins || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-2 pt-1 border-t border-border/20">
            <span>{stats.totalTeamLeaders || 0} Team Leaders</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Teams</span>
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.totalTeams || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-2 pt-1 border-t border-border/20">
            <span>Organized teams</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Projects</span>
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-primary">{stats.activeProjects || 0}</p>
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-2 pt-1 border-t border-border/20">
            <span>Running client & R&D projects</span>
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
    </div>
  );
};

export default SuperAdminDashboard;
