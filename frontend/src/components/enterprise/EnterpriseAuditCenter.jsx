import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Download, Search, Filter, Calendar, Clock,
  User, Database, RefreshCw, AlertCircle, ChevronLeft, ChevronRight,
  Eye, FileSpreadsheet, Shield, Terminal, ArrowDownToLine
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';

const CATEGORY_COLORS = {
  GENERAL: 'bg-slate-800 text-slate-300 border-slate-700',
  SHIFT: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  LEAVE: 'bg-blue-950/60 text-blue-300 border-blue-800/40',
  PAYROLL: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
  ASSET: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40',
  VISITOR: 'bg-purple-950/60 text-purple-300 border-purple-800/40',
  DOCUMENT: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40',
  ORGANIZATION: 'bg-rose-950/60 text-rose-300 border-rose-800/40',
  AUTH: 'bg-red-950/60 text-red-300 border-red-800/40',
  LIFECYCLE: 'bg-teal-950/60 text-teal-300 border-teal-800/40'
};

const EnterpriseAuditCenter = () => {
  const { selectedOrgId } = useCompanyScope();

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ totalCount: 0, todayCount: 0, recentActivity: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/enterprise/audit/stats');
      if (res.data?.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Error fetching audit stats:', err);
    }
  };

  const fetchLogs = async (targetPage = 1) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/enterprise/audit', {
        params: {
          search,
          category: categoryFilter,
          action: actionFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page: targetPage,
          limit: pagination.limit
        }
      });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load enterprise audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedOrgId]);

  useEffect(() => {
    fetchLogs(1);
  }, [selectedOrgId, categoryFilter, actionFilter, startDate, endDate]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/enterprise/audit/export-csv', {
        params: {
          search,
          category: categoryFilter,
          action: actionFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to download audit logs CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-rose-600 to-red-600 rounded-xl shadow-lg shadow-rose-500/20 text-white">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Enterprise Audit Center</h1>
              <p className="text-sm text-slate-400">Immutable compliance logs, forensic activity records, and event histories</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-rose-400" />}
            Export CSV
          </button>

          <button
            onClick={() => { fetchStats(); fetchLogs(pagination.page); }}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Total Audit Events</span>
            <span className="text-2xl font-bold font-mono text-white">
              {stats.totalCount?.toLocaleString() || 0}
            </span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Events Logged Today</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {stats.todayCount?.toLocaleString() || 0}
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block mb-1">Compliance Status</span>
            <span className="text-sm font-bold text-slate-200 block">RFC 4180 / ISO 27001</span>
            <span className="text-[11px] text-emerald-400">Active & Tamper-Resistant</span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action, user, entity, IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">All Categories</option>
            <option value="SHIFT">Shift Management</option>
            <option value="LEAVE">Leave Approvals</option>
            <option value="PAYROLL">Payroll & Salary</option>
            <option value="ASSET">Asset Custody</option>
            <option value="VISITOR">Visitor Access</option>
            <option value="DOCUMENT">Document Vault</option>
            <option value="ORGANIZATION">Organization & Branches</option>
            <option value="LIFECYCLE">Employee Lifecycle</option>
            <option value="AUTH">Authentication</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="SHIFT_OVERRIDE">SHIFT_OVERRIDE</option>
            <option value="LEAVE_APPROVE">LEAVE_APPROVE</option>
            <option value="PAYROLL_RUN">PAYROLL_RUN</option>
            <option value="BRANCH_CREATE">BRANCH_CREATE</option>
            <option value="BRANCH_ARCHIVE">BRANCH_ARCHIVE</option>
            <option value="ASSET_ASSIGN">ASSET_ASSIGN</option>
            <option value="ASSET_RETURN">ASSET_RETURN</option>
            <option value="DOCUMENT_UPLOAD">DOCUMENT_UPLOAD</option>
            <option value="DOCUMENT_VERIFY">DOCUMENT_VERIFY</option>
            <option value="ONBOARD_COMPLETE">ONBOARD_COMPLETE</option>
            <option value="OFFBOARD_COMPLETE">OFFBOARD_COMPLETE</option>
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
              title="Start Date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
              title="End Date"
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Employee</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-500">
                    No enterprise audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-800/40 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <span className="group-hover:text-rose-400 transition">{log.action}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${CATEGORY_COLORS[log.category] || CATEGORY_COLORS.GENERAL}`}>
                        {log.category || 'GENERAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.performedBy ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{log.performedBy.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{log.performedBy.employeeId}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">System / Engine</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {log.targetUser ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-300">{log.targetUser.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{log.targetUser.employeeId}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {log.entityType ? (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span>{log.entityType}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                        title="View payload"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing Page <strong className="text-white">{pagination.page}</strong> of <strong className="text-white">{pagination.totalPages}</strong> ({pagination.totalCount} total entries)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail JSON Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-rose-400" />
                  <span className="font-bold text-white text-base">Audit Payload Details</span>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 block mb-1">Action</span>
                    <span className="font-semibold text-rose-400">{selectedLog.action}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Category</span>
                    <span className="font-semibold text-slate-200">{selectedLog.category || 'GENERAL'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Timestamp</span>
                    <span className="font-mono text-slate-300">{new Date(selectedLog.createdAt).toISOString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Entity ID</span>
                    <span className="font-mono text-slate-300">{selectedLog.entityId || 'N/A'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">
                    Metadata & State Snapshot
                  </span>
                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-60 leading-relaxed">
                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnterpriseAuditCenter;
