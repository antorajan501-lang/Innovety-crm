import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Terminal
} from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/logs', {
        params: {
          page,
          action: actionFilter,
          search,
          limit: 25
        }
      });
      setLogs(res.data.logs || []);
      setTotalCount(res.data.meta?.totalCount || 0);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Control bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-border/40 shadow-premium">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search logs by IP, details, user..."
            className="w-full pl-9 bg-muted/40 focus:bg-card text-xs"
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
            className="bg-muted/40 text-xs"
          >
            <option value="">All Audit Actions</option>
            <option value="LOGIN">Logins</option>
            <option value="CLOCK_IN">Clock Ins</option>
            <option value="CLOCK_OUT">Clock Outs</option>
            <option value="TASK_CREATE">Task Creation</option>
            <option value="TASK_STATUS_UPDATE">Task Updates</option>
            <option value="USER_CREATE">User Onboarding</option>
            <option value="USER_DELETE">User Deletions</option>
          </select>

          <button onClick={fetchLogs} className="rounded-lg p-2 border hover:bg-muted text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card shadow-premium">
        <table className="w-full text-sm border-collapse text-left">
          <thead>
            <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20">
              <th className="px-6 py-4">Operator</th>
              <th className="px-6 py-4">Action Type</th>
              <th className="px-6 py-4">Audit Details</th>
              <th className="px-6 py-4">IP Address</th>
              <th className="px-6 py-4 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 font-mono text-xs">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground font-sans">
                  No audit log entries recorded.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10 transition-all">
                  <td className="px-6 py-4 font-sans">
                    <div className="text-left">
                      <p className="font-semibold text-xs text-foreground">{log.user?.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{log.user?.employeeId} ({log.user?.role?.toLowerCase()})</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-primary/10 text-primary-hover px-2.5 py-0.5 text-[9px] font-bold uppercase">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-sans text-xs text-muted-foreground max-w-sm truncate" title={log.details}>
                    {log.details}
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">{log.ipAddress || 'Internal'}</td>
                  <td className="px-6 py-4 text-right text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center px-2">
        <span className="text-xs text-muted-foreground">Total Logs: {totalCount}</span>
        <div className="flex gap-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-card border rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-muted"
          >
            Prev
          </button>
          <button 
            disabled={logs.length < 25}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-card border rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
