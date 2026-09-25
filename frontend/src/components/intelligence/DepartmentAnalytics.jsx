import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, TrendingUp, Clock, Zap, Home, RefreshCw, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../../services/api';

const DepartmentAnalytics = ({ organizationId }) => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await api.get('/intelligence/departments', { params: { organizationId } });
      if (res.data?.success) {
        setDepartments(res.data.departments || []);
      }
    } catch (err) {
      console.warn('Error fetching department analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-500" />
            <span>Department Performance Analytics</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Side-by-side department benchmarks across attendance rates, overtime velocity, and remote work distribution.
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

      {loading && departments.length === 0 ? (
        <div className="p-12 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
          <span>Computing cross-department analytics...</span>
        </div>
      ) : (
        <>
          {/* Comparative Chart */}
          <div className="p-5 rounded-3xl border border-border/60 bg-card shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Department Attendance vs Overtime Hours Comparison
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
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
                  <Bar dataKey="attendanceRate" name="Attendance Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalOvertimeHours" name="Overtime (Hours)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Side-by-Side Table */}
          <div className="rounded-3xl border border-border/60 bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground font-black text-[10px] uppercase tracking-wider">
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Staff Count</th>
                    <th className="py-3 px-4">Attendance Rate</th>
                    <th className="py-3 px-4">Total Overtime</th>
                    <th className="py-3 px-4">Avg Overtime</th>
                    <th className="py-3 px-4">Late Arrival %</th>
                    <th className="py-3 px-4">Remote WFH %</th>
                    <th className="py-3 px-4">Leaves Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {departments.map((dept, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-black text-foreground">{dept.department}</td>
                      <td className="py-3 px-4 font-semibold text-muted-foreground">{dept.memberCount} members</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">{dept.attendanceRate}%</td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-600">{dept.totalOvertimeHours}h</td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">{dept.avgOvertimeHours}h/emp</td>
                      <td className="py-3 px-4 font-mono text-amber-600">{dept.lateArrivalRate}%</td>
                      <td className="py-3 px-4 font-mono text-indigo-600">{dept.wfhDistribution}%</td>
                      <td className="py-3 px-4 text-muted-foreground">{dept.leaveCount} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DepartmentAnalytics;
