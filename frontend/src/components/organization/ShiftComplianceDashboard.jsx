import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, Clock, Calendar, CheckCircle2,
  Users, RefreshCw, Filter, Search, TrendingUp, Info
} from 'lucide-react';
import api from '../../services/api';

const ShiftComplianceDashboard = ({ organizationId }) => {
  const [loading, setLoading] = useState(false);
  const [complianceData, setComplianceData] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchCompliance = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/workforce/compliance', {
        params: {
          organizationId,
          department: departmentFilter === 'ALL' ? undefined : departmentFilter
        }
      });
      if (res.data?.success) {
        setComplianceData(res.data);
      }
    } catch (err) {
      console.error('[ComplianceDashboard] Error fetching compliance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliance();
  }, [organizationId, departmentFilter]);

  const kpis = complianceData?.kpis || {
    totalEmployees: 0,
    compliantEmployees: 0,
    flaggedEmployees: 0,
    complianceRate: 100,
    weeklyHoursViolations: 0,
    overtimeViolations: 0,
    consecutiveDaysViolations: 0,
    restDayViolations: 0
  };

  const flaggedList = (complianceData?.flaggedEmployees || []).filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <span>Workforce Compliance & Labor Standards</span>
          </h3>
          <p className="text-xs text-muted-foreground font-medium">
            Monitor consecutive work streaks, weekly limits, and mandatory rest periods. (Informational compliance report).
          </p>
        </div>

        <button
          onClick={fetchCompliance}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-card border border-border/70 hover:bg-muted text-foreground text-xs font-black transition-all cursor-pointer shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Compliance Score
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${
              kpis.complianceRate >= 90 ? 'text-emerald-500' : kpis.complianceRate >= 75 ? 'text-amber-500' : 'text-rose-500'
            }`}>
              {kpis.complianceRate}%
            </span>
            <span className="text-[10px] text-muted-foreground font-bold">
              ({kpis.compliantEmployees}/{kpis.totalEmployees})
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                kpis.complianceRate >= 90 ? 'bg-emerald-500' : kpis.complianceRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${kpis.complianceRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Weekly Hours &gt;48h
          </span>
          <span className="text-2xl font-black text-rose-500 block">
            {kpis.weeklyHoursViolations}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium block">
            Past 7-day labor threshold
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Overtime &gt;10h/wk
          </span>
          <span className="text-2xl font-black text-amber-500 block">
            {kpis.overtimeViolations}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium block">
            High fatigue indicators
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Consecutive Days &gt;6d
          </span>
          <span className="text-2xl font-black text-purple-500 block">
            {kpis.consecutiveDaysViolations}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium block">
            Unbroken work streaks
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Rest Day Violations
          </span>
          <span className="text-2xl font-black text-indigo-500 block">
            {kpis.restDayViolations}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium block">
            0 rest days in 7 days
          </span>
        </div>
      </div>

      {/* Flagged Employees Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Employees Requiring Management Attention ({flaggedList.length})
            </h4>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border/60 bg-card focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-500" />
              Evaluating compliance data...
            </div>
          ) : flaggedList.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-foreground">100% Full Compliance</p>
              <p className="mt-0.5">All employees have adhered to working hour limits and rest day mandates.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/30 text-muted-foreground font-black text-[10px] uppercase tracking-wider border-b border-border/50">
                  <tr>
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Weekly Hours</th>
                    <th className="p-3.5">Consecutive Days</th>
                    <th className="p-3.5">Compliance Violations</th>
                    <th className="p-3.5 text-right">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {flaggedList.map(emp => (
                    <tr key={emp.userId} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">{emp.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {emp.employeeId} • {emp.department}
                        </div>
                      </td>
                      <td className="p-3.5 font-bold">
                        <span className={emp.weeklyHours > 48 ? 'text-rose-600 font-extrabold' : 'text-foreground'}>
                          {emp.weeklyHours} hrs
                        </span>
                      </td>
                      <td className="p-3.5 font-bold">
                        <span className={emp.maxConsecutiveDays > 6 ? 'text-rose-600 font-extrabold' : 'text-foreground'}>
                          {emp.maxConsecutiveDays} days
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {emp.issues.map((iss, i) => (
                            <span
                              key={i}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                iss.severity === 'HIGH'
                                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}
                              title={iss.description}
                            >
                              {iss.title}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          emp.issues.some(i => i.severity === 'HIGH')
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}>
                          {emp.issues.some(i => i.severity === 'HIGH') ? 'HIGH ALERT' : 'WARNING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftComplianceDashboard;
