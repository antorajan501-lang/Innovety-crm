import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Search,
  Check,
  X,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  RotateCcw,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Ban
} from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const DEPARTMENTS = [
  'ALL',
  'Engineering',
  'HR',
  'Finance',
  'Marketing',
  'Operations',
  'Sales',
  'Product',
  'Legal',
  'IT',
  'Design'
];

const LEAVE_TYPES = [
  { id: 'ALL', label: 'All Leave Types' },
  { id: 'CASUAL', label: 'Casual Leave' },
  { id: 'SICK', label: 'Sick Leave' },
  { id: 'EMERGENCY', label: 'Emergency Leave' },
  { id: 'WFH', label: 'Work From Home (WFH)' }
];

const QUICK_FILTERS = [
  { id: 'ALL', label: 'All Dates' },
  { id: 'TODAY', label: 'Today' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'CUSTOM', label: 'Custom Range' }
];

const getQuickFilterDates = (preset) => {
  const today = new Date();
  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  if (preset === 'TODAY') {
    const todayStr = formatYMD(today);
    return { fromDate: todayStr, toDate: todayStr };
  }
  if (preset === 'THIS_WEEK') {
    const currentDay = today.getDay();
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMon);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { fromDate: formatYMD(monday), toDate: formatYMD(sunday) };
  }
  if (preset === 'THIS_MONTH') {
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { fromDate: formatYMD(startMonth), toDate: formatYMD(endMonth) };
  }

  return { fromDate: '', toDate: '' };
};

const AdvancedLeaveFilterSuite = ({ leaves = [], userRole = 'EMPLOYEE', onRefresh }) => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdmin = userRole === 'ADMIN';
  const isTL = userRole === 'TEAM_LEADER';
  
  // Approver status check: Admin & TL can sanction team members' leaves
  const canSanction = isAdmin || isTL;

  // Main Tab State (Sanction WFH & Leaves vs History)
  const getInitialTab = () => {
    if (!canSanction) return 'History';
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q === 'History' || q === 'Desk') return 'History';
    return 'Sanction';
  };

  const [mainTab, setMainTab] = useState(getInitialTab);
  const [viewingLetter, setViewingLetter] = useState(null);

  useEffect(() => {
    if (!canSanction) {
      setMainTab('History');
      return;
    }
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q === 'History' || q === 'Desk') setMainTab('History');
    else if (q === 'Sanction') setMainTab('Sanction');
  }, [window.location.search, canSanction]);

  // Simplified Filter States
  const [quickFilter, setQuickFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusTab, setStatusTab] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [payTypeFilter, setPayTypeFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Review Modal State
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Quick Filter Chip Handler
  const handleQuickFilterClick = (preset) => {
    setQuickFilter(preset);
    const dates = getQuickFilterDates(preset);
    setFromDate(dates.fromDate);
    setToDate(dates.toDate);
    setCurrentPage(1);
  };

  // Clear All Filters
  const handleClearFilters = () => {
    setQuickFilter('ALL');
    setFromDate('');
    setToDate('');
    setStatusTab('ALL');
    setTypeFilter('ALL');
    setPayTypeFilter('ALL');
    setDepartmentFilter('ALL');
    setSearch('');
    setCurrentPage(1);
  };

  // Date Overlap Filtering Logic
  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      // 1. Status Filter
      if (statusTab !== 'ALL') {
        if (statusTab === 'PENDING') {
          if (!['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status)) return false;
        } else if (statusTab === 'APPROVED') {
          if (l.status !== 'APPROVED') return false;
        } else if (statusTab === 'REJECTED') {
          if (l.status !== 'REJECTED') return false;
        } else if (statusTab === 'CANCELLED') {
          if (l.status !== 'CANCELLED') return false;
        }
      }

      // 2. Leave Type Filter
      const lType = (l.leaveType || l.type || 'CASUAL').toUpperCase();
      if (typeFilter !== 'ALL' && lType !== typeFilter) return false;

      // 2.5 Pay Type Filter (Stored DB value or derived)
      const lPayType = (l.payType || (['LOP', 'UNPAID', 'LOSS_OF_PAY'].includes(lType) ? 'UNPAID' : 'PAID')).toUpperCase();
      if (payTypeFilter !== 'ALL' && lPayType !== payTypeFilter) return false;

      // 3. Department Filter
      const userDept = l.user?.department || 'General';
      if (departmentFilter !== 'ALL' && userDept.toLowerCase() !== departmentFilter.toLowerCase()) return false;

      // 4. Employee Search Filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = l.user?.name?.toLowerCase() || '';
        const empId = l.user?.employeeId?.toLowerCase() || '';
        const email = l.user?.email?.toLowerCase() || '';
        const reason = l.reason?.toLowerCase() || '';
        if (!name.includes(q) && !empId.includes(q) && !email.includes(q) && !reason.includes(q)) {
          return false;
        }
      }

      // 5. Date Overlap Filter
      let fStart = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null;
      let fEnd = toDate ? new Date(`${toDate}T23:59:59.999Z`) : null;

      if (fStart || fEnd) {
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate || l.startDate);

        if (fEnd && !isNaN(fEnd.getTime()) && lStart > fEnd) return false;
        if (fStart && !isNaN(fStart.getTime()) && lEnd < fStart) return false;
      }

      return true;
    });
  }, [leaves, statusTab, typeFilter, payTypeFilter, departmentFilter, search, fromDate, toDate]);

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const total = filteredLeaves.length;
    const pending = filteredLeaves.filter(l => ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status)).length;
    const approved = filteredLeaves.filter(l => l.status === 'APPROVED').length;
    const rejected = filteredLeaves.filter(l => l.status === 'REJECTED').length;
    const cancelled = filteredLeaves.filter(l => l.status === 'CANCELLED').length;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const onLeaveToday = filteredLeaves.filter(l => {
      if (l.status !== 'APPROVED') return false;
      const s = new Date(l.startDate).toISOString().split('T')[0];
      const e = new Date(l.endDate || l.startDate).toISOString().split('T')[0];
      return todayStr >= s && todayStr <= e;
    }).length;

    return { total, pending, approved, rejected, cancelled, onLeaveToday };
  }, [filteredLeaves]);

  // Pagination Chunking
  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / pageSize));
  const paginatedLeaves = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLeaves.slice(startIdx, startIdx + pageSize);
  }, [filteredLeaves, currentPage, pageSize]);

  // Helper for Duration Display
  const getDurationDisplay = (l) => {
    if (l.totalDays !== undefined && l.totalDays !== null && Number(l.totalDays) > 0) {
      const days = Number(l.totalDays);
      return days === 1 ? '1 Day' : `${days} Days`;
    }
    if (!l.startDate) return '1 Day';
    const start = new Date(l.startDate);
    const end = l.endDate ? new Date(l.endDate) : start;
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 Day' : `${diffDays} Days`;
  };

  // Export Data
  const handleExport = (isExcel = false) => {
    const headers = ['Applicant Name', 'Employee ID', 'Role', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason'];
    const rows = filteredLeaves.map(l => [
      `"${l.user?.name || ''}"`,
      `"${l.user?.employeeId || ''}"`,
      `"${l.user?.role || ''}"`,
      `"${l.user?.department || 'General'}"`,
      `"${l.leaveType || l.type || 'CASUAL'}"`,
      `"${new Date(l.startDate).toLocaleDateString()}"`,
      `"${new Date(l.endDate || l.startDate).toLocaleDateString()}"`,
      l.totalDays || 1,
      `"${l.status}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`
    ]);

    const filename = `${isExcel ? 'leave_analytics_report' : 'leave_management_report'}_${new Date().toISOString().split('T')[0]}.csv`;
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Action Permission Check for Sanction Queue
  const isActionable = (l) => {
    if (!l || isSuperAdmin) return false;
    // Cannot approve/reject self
    const isSelf = l.userId === currentUser?.id || l.user?.id === currentUser?.id;
    if (isSelf) return false;
    if (isAdmin) return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
    if (isTL) return l.status === 'PENDING_TL_APPROVAL';
    return false;
  };

  // Quick Action Approve (Sanction Queue)
  const handleQuickApprove = async (e, leave) => {
    e.stopPropagation();
    if (isSuperAdmin) return;
    try {
      if (isTL && leave.status === 'PENDING_TL_APPROVAL') {
        await api.put(`/leaves/${leave.id}/tl-approve`, { remarks: 'Recommended by Team Leader' });
      } else {
        await api.put(`/leaves/${leave.id}/admin-approve`, { remarks: 'Sanctioned by Admin' });
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to sanction leave request.');
    }
  };

  // Quick Action Reject (Sanction Queue)
  const handleQuickReject = async (e, leave) => {
    e.stopPropagation();
    if (isSuperAdmin) return;
    try {
      await api.put(`/leaves/${leave.id}/reject`, { remarks: 'Declined by Admin' });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject leave request.');
    }
  };

  return (
    <div className="space-y-6 text-left font-sans w-full print:p-0">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  {mainTab === 'Sanction'
                    ? 'Leave Management'
                    : (isSuperAdmin ? 'Enterprise Leave Analytics & Audit Desk' : 'Leave History & Applications')}
                </h1>
                {isSuperAdmin && (
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    Strictly Read-Only
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">
                {mainTab === 'Sanction'
                  ? 'Review and approve pending leave and work-from-home requests'
                  : (isSuperAdmin
                      ? 'Real-time leave analytics, workforce audit logs, and date-wise filtering.'
                      : 'View leave applications, track real-time request statuses, and access history.')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <button
            onClick={() => handleExport()}
            className="flex items-center gap-1.5 bg-card hover:bg-muted text-foreground border border-border/70 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Export filtered records as CSV"
          >
            <Download className="h-4 w-4 text-primary" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-card hover:bg-muted text-foreground border border-border/70 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Print Filtered Report"
          >
            <Printer className="h-4 w-4 text-indigo-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs Navigation (Admin & TL Sanction Queue vs History) */}
      {canSanction && (
        <div className="flex border-b border-border/40 gap-6 print:hidden">
          <button
            onClick={() => setMainTab('Sanction')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
              mainTab === 'Sanction' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground font-semibold'
            }`}
          >
            Sanction WFH & Leaves ({leaves.filter(l => ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status)).length})
            {mainTab === 'Sanction' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
          </button>
          <button
            onClick={() => setMainTab('History')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer ${
              mainTab === 'History' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground font-semibold'
            }`}
          >
            History
            {mainTab === 'History' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
          </button>
        </div>
      )}

      {mainTab === 'Sanction' && canSanction ? (
        <div className="space-y-6">
          {/* Admin / TL Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Total Filtered</span>
              <span className="text-2xl font-black text-foreground mt-2">{metrics.total}</span>
              <span className="text-[10px] text-muted-foreground mt-1">Applications</span>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending</span>
              <span className="text-2xl font-black text-amber-500 mt-2">{metrics.pending}</span>
              <span className="text-[10px] text-amber-600/80 mt-1">In Pipeline</span>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Approved</span>
              <span className="text-2xl font-black text-emerald-500 mt-2">{metrics.approved}</span>
              <span className="text-[10px] text-emerald-600/80 mt-1">Sanctioned</span>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">Rejected</span>
              <span className="text-2xl font-black text-rose-500 mt-2">{metrics.rejected}</span>
              <span className="text-[10px] text-rose-600/80 mt-1">Declined</span>
            </div>

            <div className="rounded-2xl border border-slate-500/30 bg-slate-500/5 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">Cancelled</span>
              <span className="text-2xl font-black text-slate-500 mt-2">{metrics.cancelled}</span>
              <span className="text-[10px] text-slate-500 mt-1">By Applicant</span>
            </div>

            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">On Leave Today</span>
              <span className="text-2xl font-black text-indigo-500 mt-2">{metrics.onLeaveToday}</span>
              <span className="text-[10px] text-indigo-600/80 mt-1">Active Absence</span>
            </div>
          </div>

          {/* Admin Sanction Approval Queue Table */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-xs text-left space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Sanction Approval Queue
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Review and sanction pending leave and work-from-home application letters.
                </p>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                {leaves.filter(l => ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status)).length} Pending Review
              </span>
            </div>

            <div className="w-full min-w-0 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm border-collapse">
                <thead>
                  <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20 text-left whitespace-nowrap">
                    <th className="px-6 py-4 whitespace-nowrap">Applicant</th>
                    <th className="px-6 py-4 whitespace-nowrap">Leave Type</th>
                    <th className="px-6 py-4 whitespace-nowrap">Duration</th>
                    <th className="px-6 py-4 text-center whitespace-nowrap">Read Letter</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                  {(() => {
                    const pendingLeaves = leaves.filter(l => ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status));
                    if (pendingLeaves.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground whitespace-nowrap italic">
                            No pending leave or WFH requests requiring sanction.
                          </td>
                        </tr>
                      );
                    }
                    return pendingLeaves.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/10 transition-all text-xs whitespace-nowrap">
                        <td className="px-6 py-4 font-semibold whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={l.user}
                              className="h-9 w-9 sm:h-11 sm:w-11 rounded-full border border-[#E5E7EB] dark:border-border/50 shrink-0 object-cover"
                            />
                            <div>
                              <span className="font-bold text-foreground text-sm block leading-tight">{l.user?.name || 'Applicant'}</span>
                              <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                                {l.user?.employeeId || 'EM-000'} ({l.user?.role?.replace('_', ' ') || 'EMPLOYEE'})
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-extrabold font-mono uppercase shadow-2xs ${
                            (l.leaveType || l.type) === 'WFH'
                              ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
                              : (l.leaveType || l.type) === 'SICK'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : (l.leaveType || l.type) === 'EMERGENCY'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {l.leaveType || l.type || 'CASUAL'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-foreground text-sm">
                          {getDurationDisplay(l)}
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setViewingLetter(l)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3.5 py-1.5 rounded-xl border border-primary/20 transition-all active:scale-95 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Read Letter</span>
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={(e) => handleQuickApprove(e, l)}
                              className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md hover:scale-110 transition-all cursor-pointer"
                              title="Accept & Sanction Leave Application"
                            >
                              <Check className="h-4 w-4 stroke-[3]" />
                            </button>
                            <button
                              onClick={(e) => handleQuickReject(e, l)}
                              className="h-8 w-8 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-md hover:scale-110 transition-all cursor-pointer"
                              title="Decline Leave Application"
                            >
                              <X className="h-4 w-4 stroke-[3]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* USER-SIDE LEAVE MANAGEMENT & HISTORY TABLE */}

          {/* Filter Bar */}
          <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm space-y-3 print:hidden">
            {/* Row 1: Quick Filter Chips & Date Inputs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 text-xs font-bold scrollbar-thin shrink-0">
                <span className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Date Range:</span>
                </span>
                {QUICK_FILTERS.map((q) => {
                  const active = quickFilter === q.id;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleQuickFilterClick(q.id)}
                      className={`h-9 px-3.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center text-xs ${
                        active
                          ? 'bg-primary text-white font-extrabold shadow-2xs'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 font-semibold'
                      }`}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto">
                <div className="flex-1 lg:w-40">
                  <input
                    type="date"
                    value={fromDate}
                    placeholder="From Date"
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setQuickFilter('CUSTOM');
                      setCurrentPage(1);
                    }}
                    className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <span className="text-xs font-bold text-muted-foreground">to</span>
                <div className="flex-1 lg:w-40">
                  <input
                    type="date"
                    value={toDate}
                    placeholder="To Date"
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setQuickFilter('CUSTOM');
                      setCurrentPage(1);
                    }}
                    className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Status, Leave Type, Pay Type, Department, Search & Clear Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-border/40 items-center">
              <div>
                <select
                  value={statusTab}
                  onChange={(e) => { setStatusTab(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold cursor-pointer focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold cursor-pointer focus:ring-2 focus:ring-primary/20"
                >
                  {LEAVE_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={payTypeFilter}
                  onChange={(e) => { setPayTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold cursor-pointer focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">All Pay Types</option>
                  <option value="PAID">Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>

              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold cursor-pointer focus:ring-2 focus:ring-primary/20"
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d === 'ALL' ? 'All Departments' : d}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search Employee / ID..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end sm:col-span-2 lg:col-span-1">
                <button
                  onClick={handleClearFilters}
                  disabled={!(fromDate || toDate || quickFilter !== 'ALL' || statusTab !== 'ALL' || typeFilter !== 'ALL' || payTypeFilter !== 'ALL' || departmentFilter !== 'ALL' || search)}
                  className="h-9 px-4 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 disabled:opacity-40 flex items-center justify-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer w-full lg:w-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Clear Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* USER-SIDE LEAVE HISTORY TABLE (NO ACTION COLUMN) */}
          <div className="rounded-3xl border border-border/70 bg-card overflow-hidden shadow-sm">
            {paginatedLeaves.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-base font-bold text-foreground">No Leave Applications Found</p>
                <p className="text-xs">No leave records match your current date, department, or status filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/20 text-xs font-black text-muted-foreground uppercase tracking-wider">
                        <th className="py-4 px-6 min-w-[200px]">Applicant</th>
                        <th className="py-4 px-4">Leave Type</th>
                        <th className="py-4 px-4">Leave Duration</th>
                        <th className="py-4 px-4 w-72 max-w-[320px]">Reason</th>
                        <th className="py-4 px-5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 text-xs sm:text-sm">
                      {paginatedLeaves.map((leave) => {
                        const lType = leave.leaveType || leave.type || 'CASUAL';
                        const durationDisplay = getDurationDisplay(leave);
                        const statusVal = leave.status || 'PENDING';

                        return (
                          <tr
                            key={leave.id}
                            onClick={() => setSelectedLeave(leave)}
                            className="hover:bg-muted/30 transition-colors cursor-pointer group"
                          >
                            {/* Applicant */}
                            <td className="py-4 px-6 min-w-[200px]">
                              <div className="flex items-center gap-3">
                                <UserAvatar user={leave.user} className="h-9 w-9 rounded-full border border-primary/20 shrink-0" />
                                <div>
                                  <span className="font-bold text-foreground group-hover:text-primary transition-colors block text-sm whitespace-nowrap">
                                    {leave.user?.name || 'Applicant'}
                                  </span>
                                  <span className="text-xs text-muted-foreground block font-mono">
                                    {leave.user?.employeeId || 'EM-000'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Leave Type */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black font-mono uppercase border ${
                                lType === 'WFH'
                                  ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                                  : lType === 'SICK'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                  : lType === 'EMERGENCY'
                                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                  : 'bg-primary/10 text-primary border-primary/20'
                              }`}>
                                {lType}
                              </span>
                            </td>

                            {/* Leave Duration */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="font-bold text-foreground block">{durationDisplay}</span>
                              <span className="text-[11px] font-mono text-muted-foreground block mt-0.5">
                                {new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(leave.endDate || leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </td>

                            {/* Reason */}
                            <td
                              className="py-4 px-4 text-xs text-muted-foreground font-medium w-72 max-w-[320px] truncate whitespace-nowrap overflow-hidden text-ellipsis"
                              title={leave.reason || 'No details provided.'}
                            >
                              {leave.reason || 'No details provided.'}
                            </td>

                            {/* Status (Single Source of Truth) */}
                            <td className="py-4 px-5 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                statusVal === 'APPROVED'
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : statusVal === 'REJECTED'
                                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                  : statusVal === 'CANCELLED'
                                  ? 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              }`}>
                                {statusVal === 'APPROVED' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                {statusVal === 'REJECTED' && <XCircle className="h-3.5 w-3.5" />}
                                {statusVal === 'CANCELLED' && <Ban className="h-3.5 w-3.5" />}
                                {['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(statusVal) && <Clock className="h-3.5 w-3.5" />}
                                <span>
                                  {statusVal === 'PENDING_TL_APPROVAL'
                                    ? 'Pending TL'
                                    : statusVal === 'PENDING_ADMIN_APPROVAL'
                                    ? 'Pending Admin'
                                    : statusVal === 'PENDING'
                                    ? 'Pending'
                                    : statusVal}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-border/50 bg-muted/10 print:hidden text-xs font-semibold">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      Showing <strong className="text-foreground">{Math.min(filteredLeaves.length, (currentPage - 1) * pageSize + 1)}</strong> to{' '}
                      <strong className="text-foreground">{Math.min(filteredLeaves.length, currentPage * pageSize)}</strong> of{' '}
                      <strong className="text-foreground">{filteredLeaves.length}</strong> entries
                    </span>

                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-muted-foreground">Per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-card border border-border/60 rounded-lg px-2 py-1 text-xs text-foreground font-bold cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold text-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Read Letter Modal */}
      {viewingLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewingLetter(null)}>
          <div className="w-full max-w-lg rounded-3xl border border-border/70 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left space-y-4 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={viewingLetter.user} className="h-10 w-10 rounded-full" />
                <div>
                  <h3 className="text-base font-bold text-foreground">{viewingLetter.user?.name || 'Applicant'}</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {viewingLetter.user?.employeeId || 'EM-000'} • {viewingLetter.user?.role?.replace('_', ' ') || 'EMPLOYEE'}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingLetter(null)} className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-muted/20 p-4 rounded-2xl border border-border/50 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-foreground">
                <span>Application Type: <span className="text-primary font-mono">{viewingLetter.leaveType || viewingLetter.type || 'CASUAL'}</span></span>
                <span>Duration: <span>{getDurationDisplay(viewingLetter)}</span></span>
              </div>
              <div className="text-muted-foreground font-mono text-[11px]">
                Period: {new Date(viewingLetter.startDate).toLocaleDateString()} – {new Date(viewingLetter.endDate || viewingLetter.startDate).toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Application Reason / Letter Content</label>
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                {viewingLetter.reason || viewingLetter.letterContent || 'No letter details provided.'}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border/40">
              <button
                onClick={() => setViewingLetter(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
              >
                Close Letter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Details Modal (Clicking any history row) */}
      {selectedLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedLeave(null)}>
          <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left space-y-4 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={selectedLeave.user} className="h-10 w-10 rounded-full" />
                <div>
                  <h3 className="text-base font-bold text-foreground">{selectedLeave.user?.name || 'Applicant'}</h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selectedLeave.user?.employeeId || 'EM-000'} • {selectedLeave.user?.department || 'General'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedLeave(null); setActionError(null); setActionRemarks(''); }}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Leave Type</span>
                <span className="text-xs font-mono font-extrabold text-foreground block">
                  {selectedLeave.leaveType || selectedLeave.type || 'CASUAL'}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Pay Type</span>
                <span className={`text-xs font-mono font-extrabold block ${
                  (selectedLeave.payType || (['LOP', 'UNPAID', 'LOSS_OF_PAY'].includes((selectedLeave.leaveType || selectedLeave.type || 'CASUAL').toUpperCase()) ? 'UNPAID' : 'PAID')).toUpperCase() === 'UNPAID'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {(selectedLeave.payType || (['LOP', 'UNPAID', 'LOSS_OF_PAY'].includes((selectedLeave.leaveType || selectedLeave.type || 'CASUAL').toUpperCase()) ? 'UNPAID' : 'PAID')).toUpperCase()}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Duration</span>
                <span className="text-xs font-extrabold text-foreground block">
                  {getDurationDisplay(selectedLeave)}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-muted/30 border border-border/40 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Status</span>
                <span className="text-xs font-bold text-foreground block">
                  {selectedLeave.status}
                </span>
              </div>
            </div>

            {/* Approval Workflow Timeline */}
            <div className="space-y-2 pt-2 border-t border-border/40">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Approval Workflow Timeline</label>
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3 text-xs">
                {/* Step 1: Submission */}
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 mt-0.5">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground block">1. Leave Request Submitted</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Submitted on {new Date(selectedLeave.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Step 2: Team Leader Review */}
                <div className="flex items-start gap-3">
                  <div className={`p-1 rounded-full border mt-0.5 ${
                    selectedLeave.tlApprovalStatus === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
                      : selectedLeave.tlApprovalStatus === 'REJECTED' || (selectedLeave.status === 'REJECTED' && selectedLeave.tlApprovalStatus === 'PENDING')
                      ? 'bg-rose-500/20 text-rose-600 border-rose-500/30'
                      : selectedLeave.tlApprovalStatus === 'NOT_REQUIRED'
                      ? 'bg-muted text-muted-foreground border-border/60'
                      : 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                  }`}>
                    {selectedLeave.tlApprovalStatus === 'APPROVED' ? (
                      <Check className="h-3 w-3 stroke-[3]" />
                    ) : selectedLeave.tlApprovalStatus === 'REJECTED' || (selectedLeave.status === 'REJECTED' && selectedLeave.tlApprovalStatus === 'PENDING') ? (
                      <X className="h-3 w-3 stroke-[3]" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-foreground block">
                      2. Team Leader Review:{' '}
                      {selectedLeave.tlApprovalStatus === 'APPROVED'
                        ? 'Approved'
                        : selectedLeave.tlApprovalStatus === 'REJECTED'
                        ? 'Rejected'
                        : selectedLeave.tlApprovalStatus === 'NOT_REQUIRED'
                        ? 'N/A (Direct Admin Workflow)'
                        : 'Pending TL Approval'}
                    </span>
                    {selectedLeave.tlRemarks && (
                      <span className="text-[11px] text-muted-foreground block font-medium mt-0.5">
                        Remarks: "{selectedLeave.tlRemarks}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 3: Admin Final Sanction */}
                <div className="flex items-start gap-3">
                  <div className={`p-1 rounded-full border mt-0.5 ${
                    selectedLeave.adminApprovalStatus === 'APPROVED' || selectedLeave.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30'
                      : selectedLeave.adminApprovalStatus === 'REJECTED' || selectedLeave.status === 'REJECTED'
                      ? 'bg-rose-500/20 text-rose-600 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-600 border-amber-500/30'
                  }`}>
                    {selectedLeave.adminApprovalStatus === 'APPROVED' || selectedLeave.status === 'APPROVED' ? (
                      <Check className="h-3 w-3 stroke-[3]" />
                    ) : selectedLeave.adminApprovalStatus === 'REJECTED' || selectedLeave.status === 'REJECTED' ? (
                      <X className="h-3 w-3 stroke-[3]" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-foreground block">
                      3. Admin Final Sanction:{' '}
                      {selectedLeave.status === 'APPROVED'
                        ? 'Sanctioned & Approved'
                        : selectedLeave.status === 'REJECTED'
                        ? 'Rejected'
                        : selectedLeave.status === 'PENDING_TL_APPROVAL'
                        ? 'Awaiting TL Recommendation First'
                        : 'Pending Admin Final Approval'}
                    </span>
                    {selectedLeave.adminRemarks && (
                      <span className="text-[11px] text-muted-foreground block font-medium mt-0.5">
                        Remarks: "{selectedLeave.adminRemarks}"
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Application Reason */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Reason / Application Details</label>
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedLeave.reason || 'No detailed reason provided.'}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-border/40">
              <button
                onClick={() => { setSelectedLeave(null); setActionError(null); setActionRemarks(''); }}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedLeaveFilterSuite;
