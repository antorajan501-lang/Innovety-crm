import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Terminal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CompanyScopeSelector from '../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../context/CompanyScopeContext';

const AuditLogs = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = {
        page,
        action: actionFilter,
        search,
        limit: 25
      };
      if (activeOrg) params.organizationId = activeOrg;

      const res = await api.get('/logs', { params });
      setLogs(res.data.logs || []);
      setTotalCount(res.data.meta?.totalCount || 0);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setLogs([]);
    setPage(1);
    if (orgsLoading) return;
    fetchLogs();
  }, [user, targetOrg, user?.organizationId, page, actionFilter, orgsLoading]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      {/* Control bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-border/40 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs by IP, details, user..."
            className="w-full pl-9 bg-muted/40 focus:bg-card text-xs border border-border/40 rounded-xl p-2.5"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        <div className="flex items-center gap-3">
          <select 
            value={actionFilter} 
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }} 
            className="bg-muted/40 text-xs border border-border/40 rounded-xl p-2.5 font-semibold"
          >
            <option value="">All Audit Actions</option>
            <option value="LOGIN">Logins</option>
            <option value="CLOCK_IN">Clock Ins</option>
            <option value="CLOCK_OUT">Clock Outs</option>
            <option value="TASK_CREATE">Task Creation</option>
            <option value="TASK_STATUS_UPDATE">Task Updates</option>
            <option value="USER_CREATE">User Onboarding</option>
            <option value="USER_DELETE">User Deletions</option>
            <option value="PAYROLL_PUBLISH">Payroll Published</option>
            <option value="PAYROLL_SETTINGS_UPDATE">Payroll Settings Update</option>
          </select>

          <button onClick={fetchLogs} className="rounded-xl p-2.5 border border-border/40 hover:bg-muted text-muted-foreground shadow-sm">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading audit logs for {selectedCompany?.name || 'company'}...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card p-12 text-center text-muted-foreground font-semibold text-xs">
          No audit logs found for {selectedCompany?.name || 'this company'}.
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-border/40 bg-card shadow-sm">
          <table className="w-full min-w-[900px] text-xs border-collapse text-left">
            <thead>
              <tr className="font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20 whitespace-nowrap">
                <th className="px-6 py-4 whitespace-nowrap">Operator</th>
                <th className="px-6 py-4 whitespace-nowrap">Action Type</th>
                <th className="px-6 py-4 whitespace-nowrap">Audit Details</th>
                <th className="px-6 py-4 whitespace-nowrap">IP Address</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10">
                  <td className="px-6 py-4 font-bold text-foreground">
                    {log.user ? `${log.user.name} (${log.user.role})` : 'System'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-primary">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-md truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">
                    {log.ipAddress || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
