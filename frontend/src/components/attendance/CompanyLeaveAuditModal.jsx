import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Users,
  CalendarCheck,
  CalendarOff,
  Clock,
  Building2,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Calendar
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import UserAvatar from '../common/UserAvatar';

const getCurrentMonthISO = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const formatMonthDisplay = (monthISO) => {
  if (!monthISO) return '';
  const [yyyy, mm] = monthISO.split('-');
  const dateObj = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
  return dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const CompanyLeaveAuditModal = ({ isOpen, onClose, selectedOrgId: propOrgId }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { companies, selectedOrgId: scopeOrgId } = useCompanyScope();

  const [activeOrgId, setActiveOrgId] = useState(propOrgId || scopeOrgId || user?.organizationId || '');
  const [month, setMonth] = useState(getCurrentMonthISO());
  const [viewMode, setViewMode] = useState('PAID_UNPAID'); // 'PAID_UNPAID' | 'LEAVE_TYPE'
  const [search, setSearch] = useState('');

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Selected Employee Details Drawer
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (propOrgId) {
      setActiveOrgId(propOrgId);
    } else if (scopeOrgId) {
      setActiveOrgId(scopeOrgId);
    } else if (user?.organizationId) {
      setActiveOrgId(user.organizationId);
    }
  }, [propOrgId, scopeOrgId, user?.organizationId]);

  const fetchLeaveReport = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        month: month,
        ...(isSuperAdmin && activeOrgId ? { organizationId: activeOrgId } : {})
      };

      const res = await api.get('/attendance/leave-report', { params });
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to fetch leave report:', err);
      setError(err.response?.data?.message || 'Failed to load company leave audit report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaveReport();
    }
  }, [isOpen, month, activeOrgId]);

  if (!isOpen) return null;

  const companyName = reportData?.company || reportData?.organization?.name || 'Company';
  const rawEmployees = reportData?.employees || [];

  // Filter employees locally by search input
  const employees = rawEmployees.filter(emp => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(query) ||
      emp.employeeId?.toLowerCase().includes(query)
    );
  });

  // Get available leave types from backend response or fallback to defaults
  const availableLeaveTypes = reportData?.availableLeaveTypes || ["Casual", "Sick", "WFH"];

  // CSV Export
  const handleExportCSV = () => {
    if (!employees || employees.length === 0) return;
    let headers = [];
    let rows = [];

    if (viewMode === 'PAID_UNPAID') {
      headers = ['Member Name', 'Member ID', 'Paid Leave', 'Unpaid Leave'];
      rows = employees.map(e => [
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.employeeId || 'EM-1001'}"`,
        e.paid || 0,
        e.unpaid || 0
      ]);
    } else {
      headers = ['Member Name', 'Member ID', ...availableLeaveTypes];
      rows = employees.map(e => [
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.employeeId || 'EM-1001'}"`,
        ...availableLeaveTypes.map(type => e.leaveTypes?.[type] ?? e.leaveTypes?.[type.toLowerCase()] ?? 0)
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${companyName.replace(/\s+/g, '_')}_Leave_Report_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] rounded-3xl border border-border/80 bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden text-left my-auto">
        
        {/* MODAL HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 border-b border-border/60 bg-muted/20 gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 text-emerald-600 flex items-center justify-center font-extrabold shadow-sm shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">{companyName} Leave Report</h2>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-600/15 text-emerald-600 border border-emerald-600/30 uppercase tracking-wider">
                  Attendance Audit
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Monthly leave summary for active members
              </p>
            </div>
          </div>

          {/* Export & Close Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-foreground border border-border/70 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-foreground border border-border/70 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Print View"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* CONTROLS BAR: Super Admin Selector, Month Selector, View Toggle, Search */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              
              {/* Left Group: Super Admin Company Selector & Month Selector */}
              <div className="flex flex-wrap items-center gap-3.5">
                
                {/* Super Admin Company Selector - STRICTLY HIDDEN FOR ADMIN */}
                {isSuperAdmin && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="company-scope-select" className="text-xs font-extrabold text-foreground/80 flex items-center gap-1.5 shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Company:</span>
                    </label>
                    <select
                      id="company-scope-select"
                      value={activeOrgId}
                      onChange={(e) => setActiveOrgId(e.target.value)}
                      className="h-9 px-3 text-xs font-extrabold rounded-xl border border-border/70 bg-background text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {companies.map((c) => (
                        <option key={c.id || c._id} value={c.id || c._id}>
                          {c.name || c.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Month Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="month-selector" className="text-xs font-extrabold text-foreground/80 flex items-center gap-1.5 shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Month:</span>
                  </label>
                  <input
                    id="month-selector"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="h-9 px-3 text-xs font-extrabold rounded-xl border border-border/70 bg-background text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Right Group: View Toggle Segmented Control & Search */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* View Toggle */}
                <div className="inline-flex h-9 p-0.5 rounded-xl bg-muted/60 border border-border/50 text-xs font-bold items-center">
                  <button
                    type="button"
                    onClick={() => setViewMode('PAID_UNPAID')}
                    className={`h-8 px-3 rounded-lg transition-all cursor-pointer flex items-center ${
                      viewMode === 'PAID_UNPAID'
                        ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Paid / Unpaid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('LEAVE_TYPE')}
                    className={`h-8 px-3 rounded-lg transition-all cursor-pointer flex items-center ${
                      viewMode === 'LEAVE_TYPE'
                        ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Leave Type
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex items-center min-w-[200px]">
                  <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search member..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full pl-8 pr-3 text-xs font-semibold rounded-xl border border-border/70 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

              </div>

            </div>
          </div>

          {/* MAIN LEAVE REPORT TABLE */}
          <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/50 bg-muted/10 flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <span>Member Leave Breakdown ({formatMonthDisplay(month)})</span>
              </h4>
              <span className="text-[11px] font-bold text-muted-foreground">{employees.length} Members</span>
            </div>

            <div className="overflow-x-auto">
              {viewMode === 'PAID_UNPAID' ? (
                /* VIEW 1: PAID / UNPAID */
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground font-bold uppercase text-[10px] bg-muted/20">
                      <th className="px-6 py-3.5">Member</th>
                      <th className="px-6 py-3.5 text-center">Paid Leave</th>
                      <th className="px-6 py-3.5 text-center">Unpaid Leave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/25">
                    {loading ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                          <span className="text-xs font-semibold">Loading leave report...</span>
                        </td>
                      </tr>
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-muted-foreground font-medium">
                          No member leave records found for this period.
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setDrawerOpen(true);
                          }}
                          className="hover:bg-muted/15 transition-colors font-medium cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-extrabold text-foreground text-sm">{emp.name}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">{emp.employeeId || 'EM-1001'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-extrabold text-emerald-600 text-sm">
                            {emp.paid || 0}
                          </td>
                          <td className="px-6 py-4 text-center font-extrabold text-amber-600 text-sm">
                            {emp.unpaid || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                /* VIEW 2: LEAVE TYPE */
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground font-bold uppercase text-[10px] bg-muted/20">
                      <th className="px-6 py-3.5">Member</th>
                      {availableLeaveTypes.map(type => (
                        <th key={type} className="px-6 py-3.5 text-center">{type}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/25">
                    {loading ? (
                      <tr>
                        <td colSpan={1 + availableLeaveTypes.length} className="py-12 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
                          <span className="text-xs font-semibold">Loading leave report...</span>
                        </td>
                      </tr>
                    ) : employees.length === 0 ? (
                      <tr>
                        <td colSpan={1 + availableLeaveTypes.length} className="py-12 text-center text-muted-foreground font-medium">
                          No member leave records found for this period.
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setDrawerOpen(true);
                          }}
                          className="hover:bg-muted/15 transition-colors font-medium cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-extrabold text-foreground text-sm">{emp.name}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">{emp.employeeId || 'EM-1001'}</p>
                            </div>
                          </td>
                          {availableLeaveTypes.map(type => (
                            <td key={type} className="px-6 py-4 text-center font-extrabold text-foreground text-sm">
                              {emp.leaveTypes?.[type] ?? emp.leaveTypes?.[type.toLowerCase()] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* INDIVIDUAL EMPLOYEE LEAVE HISTORY SIDE DRAWER */}
      {drawerOpen && selectedEmployee && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card border-l border-border/80 h-full p-6 overflow-y-auto space-y-6 text-left shadow-2xl flex flex-col">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <UserAvatar user={selectedEmployee} className="h-10 w-10 text-sm" />
                <div>
                  <h3 className="text-base font-extrabold text-foreground">{selectedEmployee.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedEmployee.employeeId || 'EM-1001'} • {selectedEmployee.department || 'General'}</p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Leave Summary Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Paid Used</span>
                <p className="text-lg font-black text-emerald-600 mt-0.5">{selectedEmployee.paid || 0} <span className="text-[10px]">days</span></p>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Unpaid Used</span>
                <p className="text-lg font-black text-amber-600 mt-0.5">{selectedEmployee.unpaid || 0} <span className="text-[10px]">days</span></p>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-[10px] font-bold text-indigo-600 uppercase">Balance</span>
                <p className="text-lg font-black text-indigo-600 mt-0.5">{selectedEmployee.balance || 0} <span className="text-[10px]">days</span></p>
              </div>
            </div>

            {/* Leave History Timeline */}
            <div className="space-y-3 flex-1">
              <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>Approved Leave Timeline ({formatMonthDisplay(month)})</span>
              </h4>

              {(!selectedEmployee.leavesHistory || selectedEmployee.leavesHistory.length === 0) ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-medium rounded-2xl border border-dashed border-border/60">
                  No leave requests recorded for this month.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedEmployee.leavesHistory.map((req, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl border border-border/60 bg-card space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase ${
                          req.leaveType === 'CASUAL' ? 'bg-emerald-500/10 text-emerald-600' :
                          req.leaveType === 'SICK' ? 'bg-sky-500/10 text-sky-600' :
                          req.leaveType === 'EMERGENCY' ? 'bg-purple-500/10 text-purple-600' :
                          'bg-amber-500/10 text-amber-600'
                        }`}>
                          {req.leaveType} ({req.payType})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600' :
                          req.status === 'REJECTED' ? 'bg-rose-500/15 text-rose-600' :
                          'bg-amber-500/15 text-amber-600'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-foreground font-bold text-xs pt-1">
                        <span>{new Date(req.startDate).toLocaleDateString('en-GB')} {req.endDate && req.endDate !== req.startDate ? `to ${new Date(req.endDate).toLocaleDateString('en-GB')}` : ''}</span>
                        <span className="font-mono text-muted-foreground">{req.totalDays || 1} day(s)</span>
                      </div>
                      {req.reason && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 pt-0.5">{req.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyLeaveAuditModal;
