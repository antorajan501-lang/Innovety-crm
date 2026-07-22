import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Search,
  Filter,
  X,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  Phone
} from 'lucide-react';

const AttendanceAudit = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalInterns: 0,
    presentToday: 0,
    lateToday: 0,
    halfDayToday: 0,
    absentToday: 0
  });

  const [loading, setLoading] = useState(false);
  
  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Dropdown options
  const [allInterns, setAllInterns] = useState([]);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    clockIn: '',
    clockOut: '',
    status: '',
    workingHours: ''
  });

  const [alertMsg, setAlertMsg] = useState('');

  // Leaves sanction state
  const [subTab, setSubTab] = useState('Logs');
  const [leaves, setLeaves] = useState([]);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Letter view modal
  const [viewingLetter, setViewingLetter] = useState(null);

  const fetchAllLeaves = async () => {
    try {
      const res = await api.get('/leaves');
      setLeaves(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateLeaveStatus = async (id, status) => {
    setSubmittingStatus(true);
    try {
      await api.put(`/leaves/${id}/status`, { status });
      const actionText = status === 'APPROVED' ? 'accepted & WFH assigned' : 'declined & marked ABSENT';
      setAlertMsg(`Leave application letter successfully ${actionText}.`);
      fetchAllLeaves();
      fetchLogsAndAnalytics();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to update leave request status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const fetchUsersList = async () => {
    try {
      const res = await api.get('/users?limit=1000&status=ACTIVE');
      setAllInterns(res.data.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogsAndAnalytics = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        api.get('/attendance/logs', {
          params: {
            userId: userIdFilter,
            startDate,
            endDate
          }
        }),
        api.get('/attendance/analytics')
      ]);

      let logsData = logsRes.data;
      if (statusFilter) {
        logsData = logsData.filter(log => log.status === statusFilter);
      }

      setLogs(logsData);
      setStats(statsRes.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const formatLeavePeriod = (startDate, endDate) => {
    if (!startDate) return 'N/A';
    const startObj = new Date(startDate);
    const endObj = endDate ? new Date(endDate) : startObj;
    
    const startStr = startObj.toLocaleDateString();
    const endStr = endObj.toLocaleDateString();

    if (startStr === endStr) {
      return startStr;
    }
    return `${startStr} to ${endStr}`;
  };

  useEffect(() => {
    fetchUsersList();
    if (user.role === 'ADMIN') {
      fetchAllLeaves();
    }

    const pollInterval = setInterval(() => {
      if (user.role === 'ADMIN') {
        fetchAllLeaves();
      }
      fetchLogsAndAnalytics();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    fetchLogsAndAnalytics();
  }, [userIdFilter, statusFilter, startDate, endDate]);

  const openEditModal = (record) => {
    setSelectedRecord(record);
    setEditForm({
      clockIn: record.clockIn ? record.clockIn.split('.')[0] : '',
      clockOut: record.clockOut ? record.clockOut.split('.')[0] : '',
      status: record.status,
      workingHours: record.workingHours || ''
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/attendance/${selectedRecord.id}`, {
        clockIn: editForm.clockIn || undefined,
        clockOut: editForm.clockOut || undefined,
        status: editForm.status,
        workingHours: editForm.workingHours ? parseFloat(editForm.workingHours) : undefined
      });
      setEditModalOpen(false);
      setSelectedRecord(null);
      setAlertMsg('Attendance log updated successfully.');
      fetchLogsAndAnalytics();
    } catch (err) {
      setAlertMsg('Failed to update attendance log.');
      setLoading(false);
    }
  };

  const renderLeavesApprovalTab = () => {
    return (
      <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left animate-in fade-in duration-300 space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Leave & WFH Application Letter Review Panel
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Accepting a letter assigns WFH for remote attendance. Declining a letter automatically marks the employee as ABSENT.
            </p>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
            {leaves.filter(l => l.status === 'PENDING').length} Pending Review
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20 text-left">
                <th className="px-6 py-4">Applicant Employee</th>
                <th className="px-6 py-4">Letter Subject & Type</th>
                <th className="px-6 py-4">Date Duration</th>
                <th className="px-6 py-4">Sanction Status</th>
                <th className="px-6 py-4 text-center">Letter Body</th>
                <th className="px-6 py-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/25">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No leave or WFH application letters submitted.
                  </td>
                </tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/10 transition-all text-xs">
                    <td className="px-6 py-4 font-semibold">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground text-sm">{l.user?.name}</span>
                        <span className="text-[10px] text-muted-foreground">{l.user?.employeeId} ({l.user?.role?.replace('_', ' ')})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-foreground max-w-xs truncate">{l.subject || l.reason}</span>
                        <span className={`inline-flex w-max rounded px-2 py-0.5 text-[10px] font-bold font-mono ${l.type === 'WFH' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-rose-500/10 text-rose-600'}`}>
                          {l.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {formatLeavePeriod(l.startDate, l.endDate)}
                    </td>
                    <td className="px-6 py-4">
                      {l.status === 'APPROVED' ? (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                          ACCEPTED (WFH Assigned)
                        </span>
                      ) : l.status === 'REJECTED' ? (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase bg-red-500/10 text-red-500">
                          DECLINED (Marked Absent)
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase bg-yellow-500/10 text-yellow-600">
                          PENDING SANCTION
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setViewingLetter(l)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Read Letter</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {l.status === 'PENDING' ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleUpdateLeaveStatus(l.id, 'APPROVED')}
                            disabled={submittingStatus}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1"
                            title="Accept Letter & Assign WFH"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Accept (Assign WFH)</span>
                          </button>
                          <button
                            onClick={() => handleUpdateLeaveStatus(l.id, 'REJECTED')}
                            disabled={submittingStatus}
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all flex items-center gap-1"
                            title="Decline Letter & Mark Absent"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Decline (Mark Absent)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground font-semibold">Sanctioned</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {alertMsg && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alertMsg}</span>
          <button onClick={() => setAlertMsg('')}>✕</button>
        </div>
      )}

      {/* Sub-tabs navigation at the top */}
      {user.role === 'ADMIN' && (
        <div className="flex border-b border-border/20 gap-6">
          <button
            onClick={() => setSubTab('Logs')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all relative ${subTab === 'Logs' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground font-semibold'}`}
          >
            Attendance Audit Logs
            {subTab === 'Logs' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
          </button>
          <button
            onClick={() => setSubTab('Leaves')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all relative ${subTab === 'Leaves' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground font-semibold'}`}
          >
            Sanction WFH & Leaves ({leaves.filter(l => l.status === 'PENDING').length})
            {subTab === 'Leaves' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
          </button>
        </div>
      )}

      {subTab === 'Logs' ? (
        <>
          {/* Analytics widgets row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-left">
            <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-premium">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Active Members</span>
              <p className="text-lg font-extrabold mt-1">{stats.totalInterns}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-premium">
              <span className="text-[10px] font-bold text-success uppercase">Present / WFH</span>
              <p className="text-lg font-extrabold mt-1">{stats.presentToday}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-premium">
              <span className="text-[10px] font-bold text-warning uppercase">Late Arrivals</span>
              <p className="text-lg font-extrabold mt-1">{stats.lateToday}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-premium">
              <span className="text-[10px] font-bold text-primary uppercase">Half Day</span>
              <p className="text-lg font-extrabold mt-1">{stats.halfDayToday}</p>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-premium col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-danger uppercase">Absent Today</span>
              <p className="text-lg font-extrabold mt-1">{stats.absentToday}</p>
            </div>
          </div>

          {/* Filter panel */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-card p-4 rounded-2xl border border-border/40 shadow-premium">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <select value={userIdFilter} onChange={(e) => setUserIdFilter(e.target.value)} className="bg-muted/40 text-xs border rounded-xl px-3 py-2">
                <option value="">All Members</option>
                {allInterns.map(intern => (
                  <option key={intern.id} value={intern.id}>{intern.name} ({intern.employeeId})</option>
                ))}
              </select>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-muted/40 text-xs border rounded-xl px-3 py-2">
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="WORK_FROM_HOME">Work From Home</option>
              </select>

              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  className="bg-muted/40 text-xs border rounded-xl px-3 py-1.5" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
                <span className="text-muted-foreground text-xs">to</span>
                <input 
                  type="date" 
                  className="bg-muted/40 text-xs border rounded-xl px-3 py-1.5" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card shadow-premium text-left">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20">
                  <th className="px-6 py-4">Members</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Clock In</th>
                  <th className="px-6 py-4">Clock Out</th>
                  <th className="px-6 py-4">Hours</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Telemetry IP & Device</th>
                  <th className="px-6 py-4">Location Signature</th>
                  {user.role === 'ADMIN' && <th className="px-6 py-4 text-right">Edit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={user.role === 'ADMIN' ? 9 : 8} className="px-6 py-10 text-center text-muted-foreground">
                      No attendance logs match selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/10 transition-all text-xs">
                      <td className="px-6 py-4 font-semibold">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm">{log.user?.name}</span>
                          <span className="text-[10px] text-muted-foreground">{log.user?.employeeId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">{new Date(log.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono">{new Date(log.clockIn).toLocaleTimeString()}</td>
                      <td className="px-6 py-4 font-mono">
                        {log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : 'Shift Active'}
                      </td>
                      <td className="px-6 py-4">{log.workingHours ? `${log.workingHours} hrs` : '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase ${log.status === 'PRESENT' || log.status === 'WORK_FROM_HOME' ? 'bg-emerald-500/10 text-emerald-600' : log.status === 'LATE' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-500'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono">{log.ipAddress || '127.0.0.1'}</span>
                          <span className="text-[10px] text-muted-foreground">{log.browser || 'Browser'} ({log.device || 'Desktop'})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate" title={log.clockInLocation}>
                        {log.clockInLocation || '—'}
                      </td>
                      {user.role === 'ADMIN' && (
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary hover:text-primary-hover p-1 rounded hover:bg-muted" onClick={() => openEditModal(log)}>
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        renderLeavesApprovalTab()
      )}

      {/* View Full Formal Letter Modal for Admin */}
      {viewingLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold">Formal Leave Application Letter</h3>
              </div>
              <button
                className="rounded-lg p-1 hover:bg-muted"
                onClick={() => setViewingLetter(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 font-sans text-xs">
              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/30">
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold">Applicant Employee</span>
                  <p className="font-bold text-sm text-foreground">{viewingLetter.user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{viewingLetter.user?.employeeId} ({viewingLetter.user?.role?.replace('_', ' ')})</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground font-semibold">Type & Sanction Status</span>
                  <p className="font-mono font-bold text-indigo-500">{viewingLetter.type}</p>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${viewingLetter.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' : viewingLetter.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-600'}`}>
                    {viewingLetter.status === 'APPROVED' ? 'ACCEPTED (WFH Assigned)' : viewingLetter.status === 'REJECTED' ? 'DECLINED (Marked Absent)' : 'PENDING REVIEW'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Letter Subject</span>
                <p className="font-bold text-foreground text-sm bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  {viewingLetter.subject || viewingLetter.reason}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Leave Period</span>
                <p className="font-medium text-foreground">
                  {formatLeavePeriod(viewingLetter.startDate, viewingLetter.endDate)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Letter Document Body</span>
                <div className="bg-muted/10 p-4 rounded-xl border border-border/40 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {viewingLetter.letterContent || viewingLetter.reason}
                </div>
              </div>

              {viewingLetter.contactPhone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>Contact Phone: <strong className="text-foreground">{viewingLetter.contactPhone}</strong></span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
              <button
                onClick={() => setViewingLetter(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted"
              >
                Close
              </button>

              {viewingLetter.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const id = viewingLetter.id;
                      setViewingLetter(null);
                      handleUpdateLeaveStatus(id, 'APPROVED');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Accept & Assign WFH</span>
                  </button>

                  <button
                    onClick={() => {
                      const id = viewingLetter.id;
                      setViewingLetter(null);
                      handleUpdateLeaveStatus(id, 'REJECTED');
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Decline & Mark Absent</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit attendance log override modal */}
      {editModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Edit Log: {selectedRecord.user?.name}</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => {
                setEditModalOpen(false);
                setSelectedRecord(null);
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Clock In Time</label>
                <input 
                  type="datetime-local" 
                  value={editForm.clockIn} 
                  onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })} 
                  className="bg-background border px-3 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Clock Out Time</label>
                <input 
                  type="datetime-local" 
                  value={editForm.clockOut} 
                  onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })} 
                  className="bg-background border px-3 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hours Worked Override</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="e.g. 8.5"
                    value={editForm.workingHours} 
                    onChange={(e) => setEditForm({ ...editForm, workingHours: e.target.value })} 
                    className="bg-background border px-3 py-2 rounded-xl text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Attendance Status</label>
                  <select 
                    value={editForm.status} 
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="bg-background border px-3 py-2 rounded-xl text-xs"
                  >
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="ABSENT">Absent</option>
                    <option value="WORK_FROM_HOME">Work From Home</option>
                  </select>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Override Log Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceAudit;
