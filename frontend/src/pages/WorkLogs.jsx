import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import CompanyScopeSelector from '../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../context/CompanyScopeContext';
import {
  Clock,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  Briefcase,
  CheckSquare,
  Paperclip,
  Save,
  Send,
  Eye,
  Filter,
  Download,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSearch
} from 'lucide-react';
import WorkLogAttachmentUploader from '../components/worklog/WorkLogAttachmentUploader';

const formatDisplayDate = (dateObj = new Date()) => {
  return new Date(dateObj).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }); // e.g. "25 Aug 2026"
};

const formatTime12h = (dateObj) => {
  if (!dateObj) return '—';
  return new Date(dateObj).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatHoursMinutes = (decimalHours = 0) => {
  if (isNaN(decimalHours) || decimalHours <= 0) return '0h';
  const hrs = Math.floor(decimalHours);
  const mins = Math.round((decimalHours - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

export const WorkLogs = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const isAdminOrSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertType, setAlertType] = useState('success');

  // Today Status & Auto Hours
  const [todayStatus, setTodayStatus] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: null,
    clockOut: null,
    hoursWorked: 0,
    isClockedIn: false,
    workLogSubmitted: false,
    workLogDraft: false,
    workLog: null
  });

  // Table Data & Metrics
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    hoursToday: 0,
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    tasksWorkedOnCount: 0,
    avgHoursPerDay: '0.0'
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });

  // Filters & Sorting State
  const [filters, setFilters] = useState({
    dateRange: 'ALL',
    status: 'ALL',
    hoursRange: 'ALL',
    search: '',
    page: 1,
    limit: 10,
    sortBy: 'date',
    sortOrder: 'desc'
  });

  // Admin Review Filters
  const [adminLogs, setAdminLogs] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [adminFilters, setAdminFilters] = useState({
    search: '',
    departmentId: 'ALL',
    employeeId: 'ALL',
    date: '',
    status: 'ALL'
  });

  // Form Modal & View Modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [viewModalLog, setViewModalLog] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState(null);

  const [projectsList, setProjectsList] = useState([]);
  const [tasksList, setTasksList] = useState([]);

  const [formData, setFormData] = useState({
    projectId: '',
    taskId: '',
    description: '',
    hoursWorked: 0,
    workDate: new Date().toISOString().split('T')[0],
    attachments: []
  });

  // Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Live Timer for Hours Worked
  useEffect(() => {
    let interval = null;
    if (!isAdminOrSuperAdmin && todayStatus.isClockedIn && todayStatus.clockIn) {
      interval = setInterval(() => {
        const now = new Date();
        const start = new Date(todayStatus.clockIn);
        const diffHrs = (now - start) / (1000 * 60 * 60);
        setTodayStatus(prev => ({
          ...prev,
          hoursWorked: Math.round(diffHrs * 100) / 100
        }));
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAdminOrSuperAdmin, todayStatus.isClockedIn, todayStatus.clockIn]);

  // Fetch Today Status
  const fetchTodayStatus = async () => {
    if (isAdminOrSuperAdmin) return;
    try {
      const res = await api.get('/worklogs/today-status');
      setTodayStatus(res.data);
      if (res.data.workLog) {
        setFormData(prev => ({
          ...prev,
          description: res.data.workLog.description || '',
          projectId: res.data.workLog.projectId || '',
          taskId: res.data.workLog.taskId || '',
          attachments: res.data.workLog.attachments || [],
          hoursWorked: res.data.hoursWorked
        }));
      }
    } catch (err) {
      console.error('Failed to fetch today status:', err);
    }
  };

  // Fetch Employee Table Work Logs
  const fetchEmployeeWorkLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('dateRange', filters.dateRange);
      params.append('status', filters.status);
      params.append('hoursRange', filters.hoursRange);
      if (filters.search) params.append('search', filters.search);
      params.append('page', filters.page);
      params.append('limit', filters.limit);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);
      if (targetOrg) params.append('organizationId', targetOrg);

      const res = await api.get(`/worklogs?${params.toString()}`);
      setLogs(res.data.data || res.data.logs || []);
      setSummary(res.data.summary || {});
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch employee work logs:', err);
      setLoading(false);
    }
  };

  // Fetch Admin Review Logs
  const fetchAdminWorkLogs = async () => {
    if (!isAdminOrSuperAdmin) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (adminFilters.search) params.append('search', adminFilters.search);
      if (adminFilters.departmentId !== 'ALL') params.append('departmentId', adminFilters.departmentId);
      if (adminFilters.employeeId !== 'ALL') params.append('employeeId', adminFilters.employeeId);
      if (adminFilters.date) params.append('date', adminFilters.date);
      if (adminFilters.status !== 'ALL') params.append('status', adminFilters.status);
      if (targetOrg) params.append('organizationId', targetOrg);

      const res = await api.get(`/worklogs/admin?${params.toString()}`);
      setAdminLogs(res.data.logs || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch admin work logs:', err);
      setLoading(false);
    }
  };

  // Fetch Projects, Tasks, Departments, Employees
  const fetchMetadata = async () => {
    try {
      const params = targetOrg ? { organizationId: targetOrg } : {};
      const [pRes, tRes] = await Promise.all([
        api.get('/projects', { params }).catch(() => ({ data: {} })),
        api.get('/tasks', { params }).catch(() => ({ data: [] }))
      ]);
      setProjectsList(pRes.data?.projects || []);
      setTasksList(tRes.data || []);

      if (isAdminOrSuperAdmin) {
        const [dRes, eRes] = await Promise.all([
          api.get('/organization/departments', { params }).catch(() => ({ data: [] })),
          api.get('/users', { params: { ...params, limit: 1000 } }).catch(() => ({ data: [] }))
        ]);
        setDepartmentsList(Array.isArray(dRes.data) ? dRes.data : dRes.data?.departments || []);
        setEmployeesList(Array.isArray(eRes.data) ? eRes.data : eRes.data?.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  useEffect(() => {
    setAdminFilters(prev => ({ ...prev, departmentId: 'ALL', employeeId: 'ALL' }));
    fetchMetadata();
    if (isAdminOrSuperAdmin) {
      fetchAdminWorkLogs();
    } else {
      fetchTodayStatus();
      fetchEmployeeWorkLogs();
    }
  }, [isAdminOrSuperAdmin, targetOrg, user?.organizationId]);

  useEffect(() => {
    if (isAdminOrSuperAdmin) {
      fetchAdminWorkLogs();
    } else {
      fetchEmployeeWorkLogs();
    }
  }, [filters, adminFilters, targetOrg, user?.organizationId]);

  // Open Form Modal (Creates or Continues today's or specific draft)
  const openFormModal = (logToEdit = null) => {
    const target = logToEdit || todayStatus.workLog;

    if (target) {
      setIsEditing(true);
      setSelectedLogId(target.id);
      setFormData({
        projectId: target.projectId || '',
        taskId: target.taskId || '',
        description: target.description || '',
        hoursWorked: target.hoursWorked || todayStatus.hoursWorked || 0,
        workDate: new Date(target.workDate).toISOString().split('T')[0],
        attachments: target.attachments || []
      });
    } else {
      setIsEditing(false);
      setSelectedLogId(null);
      setFormData({
        projectId: '',
        taskId: '',
        description: '',
        hoursWorked: todayStatus.hoursWorked || 0,
        workDate: new Date().toISOString().split('T')[0],
        attachments: []
      });
    }
    setFormModalOpen(true);
  };

  // Submit or Save Draft
  const handleFormSubmit = async (e, submitAsDraft = false) => {
    if (e) e.preventDefault();
    try {
      const payload = {
        ...formData,
        hoursWorked: todayStatus.hoursWorked || formData.hoursWorked || 0,
        isDraft: submitAsDraft
      };

      const res = selectedLogId
        ? await api.put(`/worklogs/${selectedLogId}`, payload)
        : await api.post('/worklogs', payload);

      const savedLog = res.data;

      // Update state immediately without requiring page refresh
      setTodayStatus(prev => ({
        ...prev,
        workLogSubmitted: !submitAsDraft,
        workLogDraft: submitAsDraft,
        workLog: savedLog
      }));

      setAlertMsg(submitAsDraft ? 'Work log draft saved successfully.' : 'Work log submitted successfully!');
      setAlertType('success');
      setFormModalOpen(false);
      await fetchTodayStatus();
      await fetchEmployeeWorkLogs();
    } catch (err) {
      console.error('Submit work log error:', err);
      setAlertMsg(err.response?.data?.message || 'Failed to submit work log.');
      setAlertType('error');
    }
  };

  // Delete Draft Handler
  const handleDeleteDraft = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this draft work log?')) return;
    try {
      await api.delete(`/worklogs/${logId}`);
      setAlertMsg('Draft work log deleted.');
      setAlertType('success');
      fetchTodayStatus();
      fetchEmployeeWorkLogs();
    } catch (err) {
      setAlertMsg(err.response?.data?.message || 'Failed to delete work log draft.');
      setAlertType('error');
    }
  };

  // Sort Toggle Handler
  const handleSort = (columnKey) => {
    setFilters(prev => {
      const isSameCol = prev.sortBy === columnKey;
      const nextOrder = isSameCol && prev.sortOrder === 'desc' ? 'asc' : 'desc';
      return {
        ...prev,
        sortBy: columnKey,
        sortOrder: nextOrder,
        page: 1
      };
    });
  };

  // Deduplicate logs per YYYY-MM-DD date (Submitted > Draft)
  const displayLogs = React.useMemo(() => {
    const map = new Map();
    logs.forEach(log => {
      const dateKey = new Date(log.workDate).toISOString().split('T')[0];
      const existing = map.get(dateKey);
      if (!existing) {
        map.set(dateKey, log);
      } else {
        if (existing.isDraft && !log.isDraft) {
          map.set(dateKey, log);
        }
      }
    });
    return Array.from(map.values());
  }, [logs]);

  // Dynamic Single Primary Action Button Label & Icon
  const getSingleActionButtonProps = () => {
    if (todayStatus.workLogSubmitted) {
      return {
        text: 'View Today\'s Work Log',
        icon: <Eye className="w-4 h-4" />,
        action: () => setViewModalLog(todayStatus.workLog)
      };
    }
    if (todayStatus.workLogDraft) {
      return {
        text: 'Continue Today\'s Work Log',
        icon: <Edit3 className="w-4 h-4" />,
        action: () => openFormModal(todayStatus.workLog)
      };
    }
    return {
      text: 'Create Today\'s Work Log',
      icon: <Plus className="w-4 h-4" />,
      action: () => openFormModal()
    };
  };

  const actionButton = getSingleActionButtonProps();

  return (
    <div className="flex-1 flex flex-col space-y-6 text-left">
      {/* Alert Banner */}
      {alertMsg && (
        <div className={`px-4 py-3 rounded-2xl flex items-center justify-between animate-in fade-in duration-300 ${
          alertType === 'error' ? 'bg-destructive/10 border border-destructive/30 text-destructive' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        }`}>
          <span className="text-xs font-bold">{alertMsg}</span>
          <button onClick={() => setAlertMsg('')} className="hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER SECTION (With Single Primary Action Button) */}
      <CompanyScopeSelector />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-primary" /> {isAdminOrSuperAdmin ? 'Daily Work Log Review Dashboard' : 'Daily Work Logs'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            {isAdminOrSuperAdmin
              ? 'Monitor, filter, and review daily work logs across the organization.'
              : "Track your daily completed tasks, auto-fill working hours, and review submitted work logs."}
          </p>
        </div>

        {!isAdminOrSuperAdmin && (
          <button
            onClick={actionButton.action}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex-shrink-0"
          >
            {actionButton.icon} {actionButton.text}
          </button>
        )}
      </div>

      {/* SUMMARY CARDS */}
      {!isAdminOrSuperAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="glass-card p-4 rounded-2xl border border-white/70 dark:border-white/10 shadow-xs space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hours Today</div>
            <div className="text-2xl font-black text-primary font-mono">{formatHoursMinutes(summary.hoursToday || todayStatus.hoursWorked)}</div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/70 dark:border-white/10 shadow-xs space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-primary">This Week</div>
            <div className="text-2xl font-black text-primary font-mono">{summary.hoursThisWeek || 0} hrs</div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/70 dark:border-white/10 shadow-xs space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-sky-500">This Month</div>
            <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">{summary.hoursThisMonth || 0} hrs</div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/70 dark:border-white/10 shadow-xs space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-purple-500">Tasks Logged</div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{summary.tasksWorkedOnCount || 0} Tasks</div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/70 dark:border-white/10 shadow-xs space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-amber-500">Avg Hours / Day</div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{summary.avgHoursPerDay || '0.0'} hrs</div>
          </div>
        </div>
      )}

      {/* ADMIN REVIEWER VIEW */}
      {isAdminOrSuperAdmin ? (
        <div className="space-y-5">
          {/* Admin Filters */}
          <div className="glass-card p-4 rounded-2xl border border-border/60 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Filter className="w-4 h-4 text-primary" /> Review Filters
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search employee or ID..."
                  value={adminFilters.search}
                  onChange={e => setAdminFilters({ ...adminFilters, search: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <select
                  value={adminFilters.departmentId}
                  onChange={e => setAdminFilters({ ...adminFilters, departmentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="ALL">All Departments</option>
                  {departmentsList.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={adminFilters.employeeId}
                  onChange={e => setAdminFilters({ ...adminFilters, employeeId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="ALL">All Employees</option>
                  {employeesList.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.employeeId || 'ID N/A'})</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="date"
                  value={adminFilters.date}
                  onChange={e => setAdminFilters({ ...adminFilters, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <select
                  value={adminFilters.status}
                  onChange={e => setAdminFilters({ ...adminFilters, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Admin Table View */}
          <div className="glass-card rounded-2xl border border-border/60 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-bold border-b border-border/60">
                  <tr>
                    <th className="px-4 py-3.5">Employee</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Project / Task</th>
                    <th className="px-4 py-3.5">Hours</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Attachments</th>
                    <th className="px-4 py-3.5">Submitted Time</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted-foreground font-bold animate-pulse">
                        Loading reviewer logs...
                      </td>
                    </tr>
                  ) : adminLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <FileSearch className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="font-bold text-foreground">No work logs found{selectedCompany?.name ? ` for ${selectedCompany.name}` : ''}</p>
                        <p className="text-[11px] text-muted-foreground">Try changing your filters or selecting another company scope.</p>
                      </td>
                    </tr>
                  ) : (
                    adminLogs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              {log.user?.name ? log.user.name.charAt(0).toUpperCase() : 'E'}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{log.user?.name || 'Unknown'}</p>
                              <p className="text-[10px] text-muted-foreground">{log.user?.department || log.user?.departmentRef?.name || 'Dept N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatDisplayDate(log.workDate)}</td>
                        <td className="px-4 py-3">
                          {log.project ? (
                            <span className="font-semibold text-foreground">{log.project.name}</span>
                          ) : log.task ? (
                            <span className="text-muted-foreground">{log.task.title}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">{formatHoursMinutes(log.hoursWorked)}</td>
                        <td className="px-4 py-3">
                          {log.isDraft ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold text-[10px]">Draft</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">Submitted</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold">
                            {log.attachments?.length || 0} Files
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{formatTime12h(log.submittedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setViewModalLog(log)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="View Work Log"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* EMPLOYEE TABLE-BASED VIEW */
        <div className="space-y-4">
          {/* FILTER BAR ABOVE TABLE */}
          <div className="glass-card p-4 rounded-2xl border border-border/60 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search project, task, or description..."
                  value={filters.search}
                  onChange={e => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Date Range */}
              <div>
                <select
                  value={filters.dateRange}
                  onChange={e => setFilters(prev => ({ ...prev, dateRange: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today</option>
                  <option value="THIS_WEEK">This Week</option>
                  <option value="THIS_MONTH">This Month</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <select
                  value={filters.status}
                  onChange={e => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>

              {/* Hours Range */}
              <div>
                <select
                  value={filters.hoursRange}
                  onChange={e => setFilters(prev => ({ ...prev, hoursRange: e.target.value, page: 1 }))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="ALL">All Hours</option>
                  <option value="UNDER_4">Under 4h</option>
                  <option value="BETWEEN_4_8">4h – 8h</option>
                  <option value="OVER_8">Over 8h</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="glass-card rounded-2xl border border-border/60 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-bold border-b border-border/60">
                  <tr>
                    <th
                      onClick={() => handleSort('date')}
                      className="px-4 py-3.5 cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Date</span>
                        {filters.sortBy === 'date' ? (
                          filters.sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5">Project / Task</th>
                    <th
                      onClick={() => handleSort('hours')}
                      className="px-4 py-3.5 cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Hours</span>
                        {filters.sortBy === 'hours' ? (
                          filters.sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3.5 cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        {filters.sortBy === 'status' ? (
                          filters.sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5">Attachments</th>
                    <th
                      onClick={() => handleSort('submittedAt')}
                      className="px-4 py-3.5 cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Submitted Time</span>
                        {filters.sortBy === 'submittedAt' ? (
                          filters.sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground font-bold animate-pulse">
                        Loading daily work logs...
                      </td>
                    </tr>
                  ) : displayLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <FileSearch className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="font-bold text-foreground text-sm">No work logs found</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          Try changing your filters or create today's work log.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    displayLogs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-foreground">
                          {formatDisplayDate(log.workDate)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            {log.project ? (
                              <p className="font-bold text-foreground">{log.project.name} ({log.project.projectCode})</p>
                            ) : (
                              <p className="text-muted-foreground font-medium">— No Project —</p>
                            )}
                            {log.task && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-purple-500" /> {log.task.title}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-primary">
                          {formatHoursMinutes(log.hoursWorked)}
                        </td>
                        <td className="px-4 py-3.5">
                          {log.isDraft ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                              Draft
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> Submitted
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {log.attachments && log.attachments.length > 0 ? (
                            <button
                              onClick={() => setViewModalLog(log)}
                              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-bold text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <Paperclip className="w-3 h-3 text-primary" /> {log.attachments.length} Files
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground">
                          {formatTime12h(log.submittedAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setViewModalLog(log)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="View Work Log"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {log.isDraft && (
                              <>
                                <button
                                  onClick={() => openFormModal(log)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                  title="Continue Draft"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleDeleteDraft(log.id)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Delete Draft"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION FOOTER */}
            {!loading && pagination.total > 0 && (
              <div className="p-4 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-muted-foreground font-medium">
                  Showing <span className="font-bold text-foreground">{Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}</span>–<span className="font-bold text-foreground">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-foreground">{pagination.total}</span> logs
                </div>

                <div className="flex items-center gap-4">
                  {/* Limit selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Rows per page:</span>
                    <select
                      value={filters.limit}
                      onChange={e => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value, 10), page: 1 }))}
                      className="px-2 py-1 rounded-lg bg-background border border-border/60 text-xs font-bold"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  {/* Page Navigation */}
                  <div className="flex items-center gap-1">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                      className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-3 py-1 font-bold text-foreground font-mono">
                      {pagination.page} / {pagination.totalPages}
                    </span>

                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                      className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WORK LOG FORM MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border/80 p-6 space-y-5 text-left max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> {isEditing ? 'Continue Work Log' : 'Create Today\'s Work Log'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Submit today's completed work before ending your shift.
                </p>
              </div>
              <button onClick={() => setFormModalOpen(false)}>
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <form onSubmit={(e) => handleFormSubmit(e, false)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-muted/30 p-3.5 rounded-2xl border border-border/50">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Today's Date
                  </label>
                  <div className="px-3 py-2 rounded-xl bg-background border border-border/70 text-xs font-bold text-foreground">
                    {formatDisplayDate(new Date())}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Hours Worked (Auto-calculated)
                  </label>
                  <div className="px-3 py-2 rounded-xl bg-background border border-border/70 text-xs font-bold font-mono text-primary flex items-center justify-between">
                    <span>{formatHoursMinutes(todayStatus.hoursWorked)}</span>
                    {todayStatus.isClockedIn && (
                      <span className="text-[10px] text-emerald-600 font-bold animate-pulse">● Live</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Select Project (Optional)</label>
                  <select
                    value={formData.projectId}
                    onChange={e => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- No Specific Project --</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Select Task (Optional)</label>
                  <select
                    value={formData.taskId}
                    onChange={e => setFormData({ ...formData, taskId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">-- No Specific Task --</option>
                    {tasksList.map(t => (
                      <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Work Summary (Tasks Completed) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your achievements, tasks completed, features built, or bugs solved today..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <WorkLogAttachmentUploader
                attachments={formData.attachments}
                onChange={(updatedAtts) => setFormData({ ...formData, attachments: updatedAtts })}
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border/80 text-xs font-bold hover:bg-muted"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={(e) => handleFormSubmit(e, true)}
                  className="px-4 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Draft
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" /> Submit Work Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* READ-ONLY VIEW MODAL */}
      {viewModalLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-xl rounded-2xl border border-border/80 p-6 space-y-4 text-left max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Work Log Details
                </h3>
                <p className="text-xs text-muted-foreground">
                  Date: {formatDisplayDate(viewModalLog.workDate)}
                </p>
              </div>
              <button onClick={() => setViewModalLog(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl border border-border/50 text-xs">
              <div>
                <span className="text-muted-foreground font-bold block">Status</span>
                {viewModalLog.isDraft ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold">Draft</span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">Submitted</span>
                )}
              </div>

              <div>
                <span className="text-muted-foreground font-bold block">Hours Logged</span>
                <span className="font-mono font-bold text-primary">{formatHoursMinutes(viewModalLog.hoursWorked)}</span>
              </div>

              {viewModalLog.project && (
                <div>
                  <span className="text-muted-foreground font-bold block">Project</span>
                  <span className="font-bold">{viewModalLog.project.name} ({viewModalLog.project.projectCode})</span>
                </div>
              )}

              {viewModalLog.task && (
                <div>
                  <span className="text-muted-foreground font-bold block">Task</span>
                  <span className="font-bold">{viewModalLog.task.title}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Work Summary
              </label>
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 text-xs leading-relaxed whitespace-pre-line text-foreground">
                {viewModalLog.description || 'No work description provided.'}
              </div>
            </div>

            {viewModalLog.attachments && viewModalLog.attachments.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Attachments ({viewModalLog.attachments.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {viewModalLog.attachments.map((att) => (
                    <button
                      key={att.id}
                      onClick={() => setPreviewAttachment(att)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background border border-border/80 text-xs font-bold hover:border-primary transition-all text-left"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-primary" />
                      <span className="truncate max-w-[180px]">{att.fileName}</span>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setViewModalLog(null)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl border border-border p-6 space-y-4 text-left shadow-2xl relative">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 truncate pr-4">
                <Paperclip className="w-4 h-4 text-primary" /> {previewAttachment.fileName}
              </h3>
              <button onClick={() => setPreviewAttachment(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto flex items-center justify-center bg-muted/40 p-4 rounded-xl border border-border/60">
              {previewAttachment.fileType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(previewAttachment.fileName) ? (
                <img
                  src={previewAttachment.filePath}
                  alt={previewAttachment.fileName}
                  className="max-h-[50vh] object-contain rounded-lg shadow-md"
                />
              ) : previewAttachment.fileType?.startsWith('video/') || /\.(mp4|mov)$/i.test(previewAttachment.fileName) ? (
                <video controls className="max-h-[50vh] w-full rounded-lg">
                  <source src={previewAttachment.filePath} />
                  Your browser does not support video playback.
                </video>
              ) : previewAttachment.fileType?.startsWith('audio/') || /\.(mp3|wav)$/i.test(previewAttachment.fileName) ? (
                <audio controls className="w-full">
                  <source src={previewAttachment.filePath} />
                  Your browser does not support audio playback.
                </audio>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <FileText className="w-12 h-12 text-primary mx-auto" />
                  <p className="text-xs font-bold text-foreground">{previewAttachment.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">Document / File attachment</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <a
                href={previewAttachment.filePath}
                target="_blank"
                rel="noreferrer"
                download={previewAttachment.fileName}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary-hover flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkLogs;
