import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Clock, CheckCircle2, X, RefreshCw,
  Search, Filter, ShieldAlert, Check, Calendar, User, Eye
} from 'lucide-react';
import api from '../../services/api';

const EXCEPTION_CONFIG = {
  LATE_ARRIVAL: { label: 'Late Arrival', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  MISSED_CLOCK_IN: { label: 'Missed Clock-In', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  MISSED_CLOCK_OUT: { label: 'Missed Clock-Out', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  HOLIDAY_ATTENDANCE: { label: 'Holiday Work', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  UNAUTHORIZED_OVERTIME: { label: 'Unauthorized OT', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' }
};

const AttendanceExceptionCenter = ({ organizationId, onRefreshStats }) => {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [exceptions, setExceptions] = useState([]);
  const [summary, setSummary] = useState({
    TOTAL_OPEN: 0,
    LATE_ARRIVAL: 0,
    MISSED_CLOCK_IN: 0,
    MISSED_CLOCK_OUT: 0,
    HOLIDAY_ATTENDANCE: 0,
    UNAUTHORIZED_OVERTIME: 0
  });

  const [activeType, setActiveType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [search, setSearch] = useState('');
  const [resolvingException, setResolvingException] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

  const fetchExceptions = async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/workforce/exceptions', {
        params: {
          organizationId,
          type: activeType === 'ALL' ? undefined : activeType,
          status: statusFilter === 'ALL' ? undefined : statusFilter
        }
      });
      if (res.data?.success) {
        setExceptions(res.data.exceptions || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('[ExceptionCenter] Error fetching exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [organizationId, activeType, statusFilter]);

  const handleScanNow = async () => {
    try {
      setScanning(true);
      await api.post('/workforce/exceptions/scan', { organizationId, date: new Date() });
      await fetchExceptions();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('[ExceptionCenter] Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleResolveSubmit = async (action) => {
    if (!resolvingException) return;
    try {
      setSubmittingResolution(true);
      await api.put(`/workforce/exceptions/${resolvingException.id}/resolve`, {
        action,
        resolutionNote: resolutionNote.trim() || undefined
      });
      setResolvingException(null);
      setResolutionNote('');
      fetchExceptions();
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('[ExceptionCenter] Resolve error:', err);
    } finally {
      setSubmittingResolution(false);
    }
  };

  const filteredExceptions = exceptions.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      e.user?.name?.toLowerCase().includes(q) ||
      e.user?.employeeId?.toLowerCase().includes(q) ||
      e.user?.department?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 text-left">
      {/* Top Header & Scan Trigger */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
            <span>Attendance Exception Center</span>
          </h3>
          <p className="text-xs text-muted-foreground font-medium">
            Monitor, regularize, and resolve shift deviations, missed punches, and unauthorized overtime.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScanNow}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan Today'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'ALL', label: 'Total Open', count: summary.TOTAL_OPEN, color: 'text-foreground' },
          { key: 'LATE_ARRIVAL', label: 'Late Arrivals', count: summary.LATE_ARRIVAL, color: 'text-amber-500' },
          { key: 'MISSED_CLOCK_IN', label: 'Missed In', count: summary.MISSED_CLOCK_IN, color: 'text-rose-500' },
          { key: 'MISSED_CLOCK_OUT', label: 'Missed Out', count: summary.MISSED_CLOCK_OUT, color: 'text-orange-500' },
          { key: 'HOLIDAY_ATTENDANCE', label: 'Holiday Work', count: summary.HOLIDAY_ATTENDANCE, color: 'text-purple-500' },
          { key: 'UNAUTHORIZED_OVERTIME', label: 'Unauth OT', count: summary.UNAUTHORIZED_OVERTIME, color: 'text-blue-500' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setActiveType(item.key)}
            className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
              activeType === item.key
                ? 'bg-card border-rose-500/50 shadow-md ring-2 ring-rose-500/20'
                : 'bg-card/60 border-border/60 hover:bg-card hover:border-border'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block truncate">
              {item.label}
            </span>
            <span className={`text-xl font-black mt-1 block ${item.color}`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/50 text-xs font-bold">
          {['OPEN', 'RESOLVED', 'DISMISSED', 'ALL'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-card text-foreground shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee or dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border/60 bg-card focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
      </div>

      {/* Exceptions Table */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-rose-500" />
            Loading exceptions...
          </div>
        ) : filteredExceptions.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-foreground">No attendance exceptions found.</p>
            <p className="mt-0.5">All members are following their scheduled shifts cleanly.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/30 text-muted-foreground font-black text-[10px] uppercase tracking-wider border-b border-border/50">
                <tr>
                  <th className="p-3.5">Employee</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Exception Type</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredExceptions.map(exc => {
                  const cfg = EXCEPTION_CONFIG[exc.type] || { label: exc.type, color: 'text-muted-foreground bg-muted' };
                  return (
                    <tr key={exc.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">{exc.user?.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {exc.user?.employeeId} • {exc.user?.department || 'General'}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground">
                        {exc.date ? exc.date.split('T')[0] : '--'}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground max-w-xs truncate" title={exc.resolutionNote}>
                        {exc.resolutionNote || 'No details'}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          exc.status === 'OPEN'
                            ? 'bg-rose-500/10 text-rose-600'
                            : exc.status === 'RESOLVED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {exc.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {exc.status === 'OPEN' ? (
                          <button
                            onClick={() => {
                              setResolvingException(exc);
                              setResolutionNote('');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {exc.resolvedBy ? `By ${exc.resolvedBy.name}` : 'Closed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      <AnimatePresence>
        {resolvingException && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Resolve Attendance Exception</h3>
                  <p className="text-xs text-muted-foreground">
                    {resolvingException.user?.name} — {resolvingException.type.replace(/_/g, ' ')}
                  </p>
                </div>
                <button
                  onClick={() => setResolvingException(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-muted/20 border border-border/50 text-xs space-y-1">
                <span className="font-bold text-foreground block">Deviation Details</span>
                <p className="text-muted-foreground">{resolvingException.resolutionNote}</p>
              </div>

              <div className="space-y-1 text-xs">
                <label className="font-bold text-foreground block">Manager / Regularization Note</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Excused due to emergency, approved overtime, regularized clock-in..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-muted/20 font-medium focus:bg-background focus:ring-2 focus:ring-rose-500/20 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  disabled={submittingResolution}
                  onClick={() => handleResolveSubmit('DISMISS')}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
                >
                  Dismiss Alert
                </button>
                <button
                  type="button"
                  disabled={submittingResolution}
                  onClick={() => handleResolveSubmit('RESOLVE')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingResolution && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <span>Mark Resolved</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceExceptionCenter;
