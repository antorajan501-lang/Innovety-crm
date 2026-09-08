import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/common/UserAvatar';
import CompanyScopeSelector from '../../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import {
  Users,
  Edit2,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  History,
  X,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  Ban,
  Building2,
  Calendar
} from 'lucide-react';

import AssignSalaryStructureModal from '../../components/payroll/AssignSalaryStructureModal';

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

export default function SalaryStructuresPage() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || currentUser?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isTL = currentUser?.role === 'TEAM_LEADER';
  const isEmployee = currentUser?.role === 'EMPLOYEE' || currentUser?.role === 'INTERN';

  // Data States
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ASSIGNED' | 'UNASSIGNED'

  // Modal & Drawer States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerEmployee, setDrawerEmployee] = useState(null);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    userId: '',
    templateId: '',
    basicSalary: 0,
    hra: 0,
    da: 0,
    specialAllowance: 0,
    travelAllowance: 0,
    medicalAllowance: 0,
    otherAllowances: 0,
    bonus: 0,
    pfDeduction: 0,
    esiDeduction: 0,
    profTax: 0,
    incomeTax: 0,
    otherDeductions: 0,
    effectiveFrom: new Date().toISOString().split('T')[0],
    reason: 'Regular Assignment'
  });

  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const [empRes, tmplRes] = await Promise.all([
        api.get('/payroll/salary-structures/all', { params }),
        api.get('/payroll/templates', { params })
      ]);
      const empData = Array.isArray(empRes.data) ? empRes.data : [];
      const tmplData = Array.isArray(tmplRes.data) ? tmplRes.data : [];

      setEmployees(empData);
      setTemplates(tmplData);
    } catch (err) {
      console.error('Failed to load salary structures:', err);
      showToast('Failed to load employee salary structures.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setEmployees([]);
    setTemplates([]);
    if (orgsLoading) return;
    fetchData();
  }, [currentUser, targetOrg, currentUser?.organizationId, orgsLoading]);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open Drawer for Detailed View
  const handleOpenDrawer = (emp) => {
    setDrawerEmployee(emp);
  };

  // Open Modal for Assigning / Editing Structure
  const handleOpenEditModal = (emp = null) => {
    if (emp) {
      setSelectedUser(emp);
      const s = emp.salaryStructure;
      if (s) {
        // Editing existing assigned structure
        setFormData({
          userId: emp.id,
          templateId: s.templateId || '',
          basicSalary: s.basicSalary || 0,
          hra: s.hra || 0,
          da: s.da || 0,
          specialAllowance: s.specialAllowance || 0,
          travelAllowance: s.travelAllowance || 0,
          medicalAllowance: s.medicalAllowance || 0,
          otherAllowances: s.otherAllowances || 0,
          bonus: s.bonus || 0,
          pfDeduction: s.pfDeduction || 0,
          esiDeduction: s.esiDeduction || 0,
          profTax: s.profTax !== undefined ? s.profTax : 0,
          incomeTax: s.incomeTax || 0,
          otherDeductions: s.otherDeductions || 0,
          effectiveFrom: s.effectiveFrom ? new Date(s.effectiveFrom).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          reason: 'Salary Structure Revision'
        });
      } else {
        // New assignment -> Default to "Custom Salary Structure" with completely empty/zero fields
        setFormData({
          userId: emp.id,
          templateId: '',
          basicSalary: 0,
          hra: 0,
          da: 0,
          specialAllowance: 0,
          travelAllowance: 0,
          medicalAllowance: 0,
          otherAllowances: 0,
          bonus: 0,
          pfDeduction: 0,
          esiDeduction: 0,
          profTax: 0,
          incomeTax: 0,
          otherDeductions: 0,
          effectiveFrom: new Date().toISOString().split('T')[0],
          reason: 'Initial Structure Assignment'
        });
      }
    } else {
      const firstUnassigned = employees.find(e => !e.salaryStructure) || employees[0];
      if (firstUnassigned) {
        handleOpenEditModal(firstUnassigned);
        return;
      }
    }
    setShowModal(true);
  };

  // Helper to apply Template Values
  const applyTemplateValues = (tmpl, targetUserId = formData.userId) => {
    if (!tmpl) return;
    const basic = Number(tmpl.basicSalary) || 0;
    const gross = basic + Number(tmpl.hra || 0) + Number(tmpl.da || 0) + Number(tmpl.specialAllowance || 0) + Number(tmpl.travelAllowance || 0) + Number(tmpl.medicalAllowance || 0) + Number(tmpl.bonus || 0) + Number(tmpl.otherAllowances || 0);
    const pf = (basic * Number(tmpl.pfRatePercent || 12)) / 100;
    const esi = (gross * Number(tmpl.esiRatePercent || 0)) / 100;
    const tax = (gross * Number(tmpl.incomeTaxPercent || 0)) / 100;

    setFormData(prev => ({
      ...prev,
      userId: targetUserId,
      templateId: tmpl.id,
      basicSalary: basic,
      hra: tmpl.hra || 0,
      da: tmpl.da || 0,
      specialAllowance: tmpl.specialAllowance || 0,
      travelAllowance: tmpl.travelAllowance || 0,
      medicalAllowance: tmpl.medicalAllowance || 0,
      otherAllowances: tmpl.otherAllowances || 0,
      bonus: tmpl.bonus || 0,
      pfDeduction: pf,
      esiDeduction: esi,
      profTax: tmpl.profTax !== undefined ? tmpl.profTax : 200,
      incomeTax: tax,
      otherDeductions: tmpl.otherDeductions || 0,
      reason: prev.reason || `Applied Template: ${tmpl.name}`
    }));
  };

  // Handle Template Selection in Modal
  const handleTemplateSelect = (tmplId) => {
    if (!tmplId) {
      // Switch back to Custom Salary Structure -> Clear all salary fields to 0
      setFormData(prev => ({
        ...prev,
        templateId: '',
        basicSalary: 0,
        hra: 0,
        da: 0,
        specialAllowance: 0,
        travelAllowance: 0,
        medicalAllowance: 0,
        otherAllowances: 0,
        bonus: 0,
        pfDeduction: 0,
        esiDeduction: 0,
        profTax: 0,
        incomeTax: 0,
        otherDeductions: 0,
        reason: 'Custom Salary Structure Override'
      }));
      return;
    }

    const tmpl = templates.find(t => t.id === tmplId);
    if (tmpl) {
      applyTemplateValues(tmpl);
    }
  };

  // Reset to Selected Template
  const handleResetToTemplate = () => {
    if (formData.templateId) {
      const tmpl = templates.find(t => t.id === formData.templateId);
      if (tmpl) applyTemplateValues(tmpl);
    } else if (selectedUser?.salaryStructure?.template) {
      applyTemplateValues(selectedUser.salaryStructure.template);
    } else {
      // Clear fields if custom
      handleTemplateSelect('');
    }
  };

  // Live Salary Calculations
  const calculatedGross = useMemo(() => {
    return (
      Number(formData.basicSalary || 0) +
      Number(formData.hra || 0) +
      Number(formData.da || 0) +
      Number(formData.specialAllowance || 0) +
      Number(formData.travelAllowance || 0) +
      Number(formData.medicalAllowance || 0) +
      Number(formData.otherAllowances || 0) +
      Number(formData.bonus || 0)
    );
  }, [formData]);

  const calculatedDeductions = useMemo(() => {
    return (
      Number(formData.pfDeduction || 0) +
      Number(formData.esiDeduction || 0) +
      Number(formData.profTax || 0) +
      Number(formData.incomeTax || 0) +
      Number(formData.otherDeductions || 0)
    );
  }, [formData]);

  const calculatedNet = useMemo(() => {
    return Math.max(0, calculatedGross - calculatedDeductions);
  }, [calculatedGross, calculatedDeductions]);

  // Previous Net Pay comparison
  const previousNet = selectedUser?.salaryStructure?.netSalary || 0;
  const netDifference = calculatedNet - previousNet;

  // Submit Salary Structure Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!formData.userId) {
      showToast('Please select a valid employee.', 'error');
      return;
    }
    if (Number(formData.basicSalary) < 0) {
      showToast('Basic salary cannot be negative.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/payroll/salary-structures/save', formData);
      showToast(`Successfully saved salary structure for ${selectedUser?.name || 'employee'}.`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save salary structure:', err);
      showToast(err.response?.data?.message || 'Failed to save salary structure.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // View Revision History Modal
  const handleOpenRevisions = async (emp) => {
    setSelectedUser(emp);
    setShowRevisionHistory(true);
    try {
      setLoadingRevisions(true);
      const res = await api.get(`/payroll/salary-structures/revisions/${emp.id}`);
      setRevisions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch revisions:', err);
      setRevisions([]);
    } finally {
      setLoadingRevisions(false);
    }
  };

  // Filtering Logic
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.employeeId?.toLowerCase().includes(q);

      const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;

      const userDept = emp.department || 'General';
      const matchesDept = departmentFilter === 'ALL' || userDept.toLowerCase() === departmentFilter.toLowerCase();

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ASSIGNED' && emp.salaryStructure) ||
        (statusFilter === 'UNASSIGNED' && !emp.salaryStructure);

      return matchesSearch && matchesRole && matchesDept && matchesStatus;
    });
  }, [employees, searchTerm, roleFilter, departmentFilter, statusFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalCount = employees.length;
    const assignedCount = employees.filter(e => e.salaryStructure).length;
    const unassignedCount = totalCount - assignedCount;
    const totalPayrollCommitment = employees.reduce((sum, e) => sum + (e.salaryStructure?.netSalary || 0), 0);

    return { totalCount, assignedCount, unassignedCount, totalPayrollCommitment };
  }, [employees]);

  const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 ${notification.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
              : 'bg-success/10 border-success/20 text-success'
            }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border/70 p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  Employee Salary Structures
                </h1>
                {isSuperAdmin && (
                  <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    Read-Only
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                Assign templates, customize earnings & deductions, and manage salary revision histories.
              </p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 btn-primary font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Assign Structure</span>
          </button>
        )}
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">Total Workforce</span>
          <span className="text-2xl font-black text-foreground mt-2">{stats.totalCount}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Active Employees</span>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-primary tracking-wider">Assigned</span>
          <span className="text-2xl font-black text-primary mt-2">{stats.assignedCount}</span>
          <span className="text-[10px] text-primary/80 mt-0.5">Active Salary Structures</span>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-amber-700 dark:text-amber-400 tracking-wider">Pending Assignment</span>
          <span className="text-2xl font-black text-amber-500 mt-2">{stats.unassignedCount}</span>
          <span className="text-[10px] text-amber-600/80 mt-0.5">Requires Structure Setup</span>
        </div>

        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-indigo-700 dark:text-indigo-400 tracking-wider">Monthly Commitment</span>
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{formatINR(stats.totalPayrollCommitment)}</span>
          <span className="text-[10px] text-indigo-600/80 mt-0.5">Net Payroll Commitment</span>
        </div>
      </div>

      {/* 3. Search & Multi-Filter Toolbar */}
      <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Employee Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Name or Employee ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-muted/30 border border-border/60 rounded-xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 text-xs font-bold text-foreground cursor-pointer"
            >
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d === 'ALL' ? 'All Departments' : d}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 text-xs font-bold text-foreground cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              <option value="EMPLOYEE">Employees</option>
              <option value="TEAM_LEADER">Team Leaders</option>
              <option value="ADMIN">Admins</option>
              <option value="INTERN">Interns</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full h-9 bg-muted/30 border border-border/60 rounded-xl px-3 text-xs font-bold text-foreground cursor-pointer"
            >
              <option value="ALL">All Assignment Statuses</option>
              <option value="ASSIGNED">Assigned Structure</option>
              <option value="UNASSIGNED">Pending Structure</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Simplified Compact Employee Salary Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-muted-foreground font-medium">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-2" />
          <p className="text-sm font-semibold text-foreground">Loading employee salary structures...</p>
        </div>
      ) : (
        <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-black uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-5">Employee</th>
                  <th className="py-4 px-4">Employee ID & Dept</th>
                  <th className="py-4 px-4">Assigned Template</th>
                  <th className="py-4 px-4">Net Salary</th>
                  <th className="py-4 px-4">Effective Date</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs sm:text-sm">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 px-4 text-center text-muted-foreground space-y-2">
                      <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
                      <p className="text-base font-bold text-foreground">No Employee Records Found</p>
                      <p className="text-xs">Try adjusting your search or filter parameters.</p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => {
                    const s = emp.salaryStructure;
                    const hasStructure = Boolean(s);

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => handleOpenDrawer(emp)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        {/* Employee Name & Email */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={emp} className="h-9 w-9 rounded-full border border-primary/20 shrink-0" />
                            <div>
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors block text-sm whitespace-nowrap">
                                {emp.name}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono block">
                                {emp.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* ID & Dept */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-foreground block">
                            {emp.employeeId || 'EM-000'}
                          </span>
                          <span className="text-[11px] text-muted-foreground block font-semibold">
                            {emp.department || 'General'}
                          </span>
                        </td>

                        {/* Template Badge */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {hasStructure ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              <span>{s.template?.name || 'Custom Structure'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              Not Assigned
                            </span>
                          )}
                        </td>

                        {/* Net Pay Only */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {hasStructure ? (
                            <span className="text-sm font-black text-primary">
                              {formatINR(s.netSalary)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono">-</span>
                          )}
                        </td>

                        {/* Effective From */}
                        <td className="py-4 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {hasStructure && s.effectiveFrom
                            ? new Date(s.effectiveFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {/* Revision History Audit Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRevisions(emp);
                              }}
                              className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                              title="View Revision Audit History"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {/* Assign / Adjust Structure Button */}
                            {isAdmin ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(emp);
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${hasStructure
                                    ? 'bg-card hover:bg-muted text-foreground border border-border/70'
                                    : 'btn-primary'
                                  }`}
                              >
                                {hasStructure ? <Edit2 className="w-3.5 h-3.5 text-primary" /> : <Plus className="w-3.5 h-3.5 stroke-[3]" />}
                                <span>{hasStructure ? 'Adjust' : 'Assign'}</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrawer(emp);
                                }}
                                className="px-3 py-1.5 bg-card border border-border/70 text-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                              >
                                <span>View</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Employee Details Right-Side Drawer */}
      {drawerEmployee && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          onClick={() => setDrawerEmployee(null)}
        >
          <div
            className="bg-card border-l border-border/70 w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl space-y-5 animate-in slide-in-from-right duration-300 font-sans text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Employee Salary Details</span>
              </span>
              <button
                onClick={() => setDrawerEmployee(null)}
                className="p-1.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Employee Profile Info Card */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 flex items-center gap-4">
              <UserAvatar user={drawerEmployee} className="h-14 w-14 rounded-full border-2 border-primary/30 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-foreground text-lg leading-tight truncate">{drawerEmployee.name}</h3>
                  {drawerEmployee.salaryStructure && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                      {drawerEmployee.role}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground font-semibold">
                    {drawerEmployee.department || 'General'}
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    ID: {drawerEmployee.employeeId || 'EM-000'}
                  </span>
                </div>
              </div>
            </div>

            {/* Prominent Net Salary Highlight Card */}
            <div className="p-5 rounded-2xl bg-primary/10 border border-primary/30 space-y-1 shadow-sm">
              <span className="text-[11px] font-black uppercase tracking-wider text-primary block">
                Net Monthly Take-Home Pay
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-primary">
                  {drawerEmployee.salaryStructure ? formatINR(drawerEmployee.salaryStructure.netSalary) : 'Not Assigned'}
                </span>
                {drawerEmployee.salaryStructure && (
                  <span className="text-xs text-muted-foreground font-semibold">/ month</span>
                )}
              </div>
              {drawerEmployee.salaryStructure?.effectiveFrom && (
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  Effective From: {new Date(drawerEmployee.salaryStructure.effectiveFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>

            {drawerEmployee.salaryStructure ? (
              <>
                {/* Itemized Earnings Breakdown Card */}
                <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Annual Gross CTC</span>
                    </span>
                    <span className="text-xs font-black text-primary">
                      Gross: {formatINR(drawerEmployee.salaryStructure.grossSalary)}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-medium divide-y divide-border/30">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">Basic Salary</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.basicSalary)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.hra)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Dearness Allowance (DA)</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.da)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Special Allowance</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.specialAllowance)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Travel Allowance</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.travelAllowance)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Medical Allowance</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.medicalAllowance)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Bonus</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.bonus)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Other Allowances</span>
                      <span className="font-bold text-foreground">{formatINR(drawerEmployee.salaryStructure.otherAllowances)}</span>
                    </div>
                  </div>
                </div>

                {/* Itemized Deductions Breakdown Card */}
                <div className="p-4 rounded-2xl bg-card border border-border/70 space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                      <span>Deductions Breakdown</span>
                    </span>
                    <span className="text-xs font-black text-rose-500">
                      Total: {formatINR(
                        drawerEmployee.salaryStructure.pfDeduction +
                        drawerEmployee.salaryStructure.esiDeduction +
                        drawerEmployee.salaryStructure.profTax +
                        drawerEmployee.salaryStructure.incomeTax +
                        drawerEmployee.salaryStructure.otherDeductions
                      )}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-medium divide-y divide-border/30">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground">Provident Fund (PF)</span>
                      <span className="font-bold text-rose-500">{formatINR(drawerEmployee.salaryStructure.pfDeduction)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Employee State Insurance (ESI)</span>
                      <span className="font-bold text-rose-500">{formatINR(drawerEmployee.salaryStructure.esiDeduction)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Professional Tax (PT)</span>
                      <span className="font-bold text-rose-500">{formatINR(drawerEmployee.salaryStructure.profTax)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Income Tax (TDS)</span>
                      <span className="font-bold text-rose-500">{formatINR(drawerEmployee.salaryStructure.incomeTax)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Other Deductions</span>
                      <span className="font-bold text-rose-500">{formatINR(drawerEmployee.salaryStructure.otherDeductions)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center bg-muted/20 border border-border/60 rounded-2xl space-y-2 text-xs">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="font-bold text-foreground">No Salary Structure Assigned</p>
                <p className="text-muted-foreground">Click "Assign Salary Structure" below to setup pay components for this employee.</p>
              </div>
            )}

            {/* Quick Actions Footer inside Drawer */}
            <div className="pt-3 border-t border-border/50 space-y-2">
              {isAdmin && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const emp = drawerEmployee;
                      setDrawerEmployee(null);
                      handleOpenEditModal(emp);
                    }}
                    className="py-2.5 px-3 btn-primary rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{drawerEmployee.salaryStructure ? 'Edit Structure' : 'Assign Structure'}</span>
                  </button>

                  <button
                    onClick={() => {
                      const emp = drawerEmployee;
                      setDrawerEmployee(null);
                      handleOpenRevisions(emp);
                    }}
                    className="py-2.5 px-3 bg-card hover:bg-muted text-foreground border border-border/70 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Revision History</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => setDrawerEmployee(null)}
                className="w-full py-2 bg-muted/40 hover:bg-muted text-muted-foreground font-bold text-xs rounded-xl border border-border/60 cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Salary Customization & Assignment Modal Editor */}
      {showModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card border border-border/70 rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 text-left font-sans"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div className="flex items-center gap-3">
                <UserAvatar user={selectedUser} className="h-10 w-10 rounded-full border border-primary/20" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {selectedUser.salaryStructure ? 'Adjust Salary Structure' : 'Assign Salary Structure'} for {selectedUser.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selectedUser.employeeId || 'EM-000'} • {selectedUser.role} • {selectedUser.department || 'General'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-Only Notice for Super Admin / Non-Admin */}
            {!isAdmin && (
              <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                <Ban className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Read-Only Mode: Only Administrators can create or update salary structures.</span>
              </div>
            )}

            {/* Live Salary Summary Banner inside Modal */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span className="font-extrabold text-foreground">Structure Editor</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  Modifying compensation breakdown
                </span>

                {selectedUser.salaryStructure && netDifference !== 0 && (
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 border ${netDifference > 0
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                      }`}
                  >
                    {netDifference > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>
                      {netDifference > 0 ? '+' : ''}
                      {formatINR(netDifference)} ({((netDifference / (previousNet || 1)) * 100).toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Gross Salary</span>
                  <span className="text-base font-black text-foreground mt-0.5 block">{formatINR(calculatedGross)}</span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Total Deductions</span>
                  <span className="text-base font-black text-rose-500 mt-0.5 block">{formatINR(calculatedDeductions)}</span>
                </div>

                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="text-[10px] font-extrabold uppercase text-primary block">Net Monthly Salary</span>
                  <span className="text-lg font-black text-primary mt-0.5 block">{formatINR(calculatedNet)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Template Selector & Reset Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/60">
                <div className="flex-1">
                  <label className="font-bold text-foreground block mb-1">Apply Salary Template</label>
                  <select
                    disabled={!isAdmin}
                    value={formData.templateId}
                    onChange={e => handleTemplateSelect(e.target.value)}
                    className="w-full bg-muted/40 border border-border/60 rounded-xl px-3 py-2 text-foreground font-semibold disabled:opacity-60 cursor-pointer"
                  >
                    <option value="">Custom Salary Structure</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.targetRole})</option>
                    ))}
                  </select>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleResetToTemplate}
                    className="self-end sm:self-center h-9 px-3 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted text-foreground font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Reset earnings and deductions to template defaults"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Template</span>
                  </button>
                )}
              </div>

              {/* Earnings Components Section */}
              <div className="space-y-2">
                <div className="font-black text-foreground text-xs uppercase tracking-wider border-b border-border/40 pb-1.5 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>1. Earnings Components (₹)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Basic Salary *</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.basicSalary || ''}
                      onChange={e => setFormData({ ...formData, basicSalary: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 30000"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">HRA</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.hra || ''}
                      onChange={e => setFormData({ ...formData, hra: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 12000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">DA</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.da || ''}
                      onChange={e => setFormData({ ...formData, da: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 5000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Special Allowance</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.specialAllowance || ''}
                      onChange={e => setFormData({ ...formData, specialAllowance: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 5000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Travel Allowance</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.travelAllowance || ''}
                      onChange={e => setFormData({ ...formData, travelAllowance: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 3000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Medical Allowance</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.medicalAllowance || ''}
                      onChange={e => setFormData({ ...formData, medicalAllowance: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 2000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Other Allowances</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.otherAllowances || ''}
                      onChange={e => setFormData({ ...formData, otherAllowances: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 1000"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Bonus</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.bonus || ''}
                      onChange={e => setFormData({ ...formData, bonus: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 2500"
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Section */}
              <div className="space-y-2 pt-2">
                <div className="font-black text-foreground text-xs uppercase tracking-wider border-b border-border/40 pb-1.5 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  <span>2. Deductions Components (₹)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">PF Deduction</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.pfDeduction || ''}
                      onChange={e => setFormData({ ...formData, pfDeduction: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 3600"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">ESI Deduction</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.esiDeduction || ''}
                      onChange={e => setFormData({ ...formData, esiDeduction: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 300"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Professional Tax (PT)</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.profTax || ''}
                      onChange={e => setFormData({ ...formData, profTax: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 200"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Income Tax (TDS)</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.incomeTax || ''}
                      onChange={e => setFormData({ ...formData, incomeTax: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 1500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <label className="font-bold text-muted-foreground block mb-1">Other Deductions</label>
                    <input
                      disabled={!isAdmin}
                      type="number"
                      value={formData.otherDeductions || ''}
                      onChange={e => setFormData({ ...formData, otherDeductions: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>
              </div>

              {/* Revision & Effective Date */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Effective From Date *</label>
                    <input
                      disabled={!isAdmin}
                      type="date"
                      value={formData.effectiveFrom}
                      onChange={e => setFormData({ ...formData, effectiveFrom: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Revision / Assignment Reason *</label>
                    <input
                      disabled={!isAdmin}
                      type="text"
                      value={formData.reason}
                      onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. Annual Appraisal / Promotion"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 flex items-center justify-between border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-border rounded-xl font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                >
                  Close
                </button>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 btn-primary rounded-xl font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submitting ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Salary Revision History Audit Modal */}
      {showRevisionHistory && selectedUser && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowRevisionHistory(false)}
        >
          <div
            className="bg-card border border-border/70 rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-left font-sans"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={selectedUser} className="h-10 w-10 rounded-full border border-primary/20" />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Salary Revision History for {selectedUser.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {selectedUser.employeeId || 'EM-000'} • {selectedUser.department || 'General'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRevisionHistory(false)}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingRevisions ? (
              <p className="text-xs text-center py-8 text-muted-foreground">Loading revision history...</p>
            ) : revisions.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <History className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="font-bold text-foreground">No Revision History Found</p>
                <p>No past salary revisions recorded for this employee.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {revisions.map((rev) => {
                  const isInc = rev.changeAmount > 0;
                  const isDec = rev.changeAmount < 0;
                  const diff = rev.changeAmount;

                  return (
                    <div
                      key={rev.id}
                      className="p-4 rounded-2xl border border-border/60 bg-muted/20 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${isInc
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : isDec
                                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                  : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                              }`}
                          >
                            {rev.revisionType}
                          </span>
                          <span className="font-semibold text-muted-foreground">
                            {new Date(rev.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>

                        <span
                          className={`font-extrabold font-mono text-xs ${isInc ? 'text-primary' : isDec ? 'text-rose-500' : 'text-foreground'
                            }`}
                        >
                          {isInc ? '+' : ''}
                          {formatINR(rev.changeAmount)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 font-bold text-foreground">
                        <span>Previous: {formatINR(rev.previousSalary)}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-primary">New Net: {formatINR(rev.newSalary)}</span>
                      </div>

                      <div className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Reason: </span>
                        {rev.reason}
                      </div>

                      {rev.revisedBy && (
                        <div className="text-[10px] text-muted-foreground/80 font-mono">
                          Revised by: {rev.revisedBy.name} ({rev.revisedBy.role})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Dedicated Assign Salary Structure Modal (Single & Bulk Assignment) */}
      <AssignSalaryStructureModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        employees={employees}
        templates={templates}
        onSuccess={(msg) => {
          showToast(msg);
          fetchData();
        }}
      />
    </div>
  );
}
