import React, { useState, useMemo, useEffect } from 'react';
import api from '../../services/api';
import UserAvatar from '../common/UserAvatar';
import {
  X,
  Users,
  User,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  Building2,
  Filter
} from 'lucide-react';

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

export default function AssignSalaryStructureModal({
  isOpen,
  onClose,
  employees = [],
  templates = [],
  onSuccess
}) {
  if (!isOpen) return null;

  // Assignment Type Mode: 'SINGLE' | 'BULK'
  const [assignmentType, setAssignmentType] = useState('SINGLE');

  // Single Employee Selection
  const [singleUserId, setSingleUserId] = useState('');

  // Bulk Candidate Filtering & Selection
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateDeptFilter, setCandidateDeptFilter] = useState('ALL');
  const [candidateRoleFilter, setCandidateRoleFilter] = useState('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Template & Component Form States
  const [templateId, setTemplateId] = useState('');
  const [formData, setFormData] = useState({
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
  const [errorMsg, setErrorMsg] = useState(null);

  // Default Single Employee Selection to first unassigned or first employee
  useEffect(() => {
    if (employees.length > 0 && !singleUserId) {
      const firstUnassigned = employees.find(e => !e.salaryStructure) || employees[0];
      if (firstUnassigned) setSingleUserId(firstUnassigned.id);
    }
  }, [employees, singleUserId]);

  // Filtered Candidates for Bulk Selection
  const filteredCandidates = useMemo(() => {
    return employees.filter(emp => {
      const q = candidateSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.employeeId?.toLowerCase().includes(q);

      const userDept = emp.department || 'General';
      const matchesDept = candidateDeptFilter === 'ALL' || userDept.toLowerCase() === candidateDeptFilter.toLowerCase();
      const matchesRole = candidateRoleFilter === 'ALL' || emp.role === candidateRoleFilter;

      return matchesSearch && matchesDept && matchesRole;
    });
  }, [employees, candidateSearch, candidateDeptFilter, candidateRoleFilter]);

  // Bulk Selection Handlers
  const isAllCandidatesSelected = useMemo(() => {
    if (filteredCandidates.length === 0) return false;
    return filteredCandidates.every(emp => selectedUserIds.includes(emp.id));
  }, [filteredCandidates, selectedUserIds]);

  const handleToggleSelectAll = () => {
    if (isAllCandidatesSelected) {
      // Unselect filtered candidates
      const filteredIds = filteredCandidates.map(e => e.id);
      setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered candidates
      const filteredIds = filteredCandidates.map(e => e.id);
      setSelectedUserIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleToggleCandidate = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Selected single employee object
  const selectedSingleUser = useMemo(() => {
    return employees.find(e => e.id === singleUserId);
  }, [employees, singleUserId]);

  // Apply Template Helper
  const applyTemplate = (tmpl) => {
    if (!tmpl) {
      setTemplateId('');
      setFormData(prev => ({
        ...prev,
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

    const basic = Number(tmpl.basicSalary) || 0;
    const gross = basic + Number(tmpl.hra || 0) + Number(tmpl.da || 0) + Number(tmpl.specialAllowance || 0) + Number(tmpl.travelAllowance || 0) + Number(tmpl.medicalAllowance || 0) + Number(tmpl.bonus || 0) + Number(tmpl.otherAllowances || 0);
    const pfRate = (tmpl.pfRatePercent !== undefined && tmpl.pfRatePercent !== null && tmpl.pfRatePercent !== '')
      ? Number(tmpl.pfRatePercent)
      : 12;
    const pf = (basic * pfRate) / 100;
    const esi = (gross * Number(tmpl.esiRatePercent || 0)) / 100;
    const tax = (gross * Number(tmpl.incomeTaxPercent || 0)) / 100;

    setTemplateId(tmpl.id);
    setFormData(prev => ({
      ...prev,
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
      reason: `Applied Template: ${tmpl.name}`
    }));
  };

  const handleTemplateChange = (tId) => {
    if (!tId) {
      applyTemplate(null);
      return;
    }
    const tmpl = templates.find(t => t.id === tId);
    if (tmpl) applyTemplate(tmpl);
  };

  const handleResetForm = () => {
    setTemplateId('');
    setSelectedUserIds([]);
    setFormData({
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
    setErrorMsg(null);
  };

  // Live Calculations
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

  // Aggregate Commitment for Bulk Assignment Mode
  const targetEmployeeCount = assignmentType === 'SINGLE' ? (singleUserId ? 1 : 0) : selectedUserIds.length;
  const totalAggregateCommitment = calculatedNet * targetEmployeeCount;

  const selectedTemplateObj = useMemo(() => {
    return templates.find(t => t.id === templateId);
  }, [templates, templateId]);

  // Submit Form Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const targetUserIds = assignmentType === 'SINGLE'
      ? (singleUserId ? [singleUserId] : [])
      : selectedUserIds;

    if (targetUserIds.length === 0) {
      setErrorMsg(assignmentType === 'SINGLE' ? 'Please select a target employee.' : 'Please select at least one employee for bulk assignment.');
      return;
    }

    if (Number(formData.basicSalary) < 0) {
      setErrorMsg('Basic Salary cannot be negative.');
      return;
    }

    try {
      setSubmitting(true);
      if (assignmentType === 'SINGLE') {
        await api.post('/payroll/salary-structures/save', {
          ...formData,
          userId: singleUserId,
          templateId: templateId || null
        });
      } else {
        await api.post('/payroll/salary-structures/bulk-save', {
          ...formData,
          userIds: selectedUserIds,
          templateId: templateId || null
        });
      }

      onSuccess(
        assignmentType === 'SINGLE'
          ? `Successfully assigned structure to ${selectedSingleUser?.name || 'employee'}.`
          : `Successfully assigned structure to ${selectedUserIds.length} employees.`
      );
      onClose();
    } catch (err) {
      console.error('Save assignment error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to assign salary structure.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border/70 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left font-sans space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                Assign Salary Structure
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
                Assign a custom structure or salary template to single or multiple workforce employees.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Mode, Selection, Components */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Assignment Type Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-foreground tracking-wider block">
                  1. Assignment Type Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAssignmentType('SINGLE')}
                    className={`p-3.5 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      assignmentType === 'SINGLE'
                        ? 'btn-primary shadow-md'
                        : 'bg-muted/30 hover:bg-muted text-muted-foreground border-border/60'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Single Employee</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignmentType('BULK')}
                    className={`p-3.5 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      assignmentType === 'BULK'
                        ? 'btn-primary shadow-md'
                        : 'bg-muted/30 hover:bg-muted text-muted-foreground border-border/60'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Multiple Employees (Bulk)</span>
                  </button>
                </div>
              </div>

              {/* 2. Employee Selection Section */}
              {assignmentType === 'SINGLE' ? (
                <div className="space-y-2 p-4 rounded-2xl bg-muted/20 border border-border/60">
                  <label className="text-xs font-bold text-foreground block">Select Employee</label>
                  <select
                    value={singleUserId}
                    onChange={e => setSingleUserId(e.target.value)}
                    className="w-full bg-card border border-border/60 rounded-xl px-3 py-2 text-xs font-bold text-foreground cursor-pointer"
                  >
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employeeId || 'EM-000'}) — {e.role} ({e.department || 'General'})
                      </option>
                    ))}
                  </select>

                  {selectedSingleUser && (
                    <div className="mt-3 p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3">
                      <UserAvatar user={selectedSingleUser} className="h-10 w-10 rounded-full border border-primary/20 shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-foreground block">{selectedSingleUser.name}</span>
                        <span className="text-muted-foreground font-mono block text-[11px]">
                          {selectedSingleUser.employeeId} • {selectedSingleUser.role} • {selectedSingleUser.department || 'General'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" />
                      <span>Select Candidates for Bulk Assignment</span>
                    </label>

                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20">
                      Selected: {selectedUserIds.length}
                    </span>
                  </div>

                  {/* Candidate Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search candidate..."
                        value={candidateSearch}
                        onChange={e => setCandidateSearch(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 bg-card border border-border/60 rounded-xl text-xs"
                      />
                    </div>

                    <select
                      value={candidateDeptFilter}
                      onChange={e => setCandidateDeptFilter(e.target.value)}
                      className="bg-card border border-border/60 rounded-xl px-2 py-1.5 text-xs font-semibold"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d === 'ALL' ? 'All Depts' : d}</option>
                      ))}
                    </select>

                    <select
                      value={candidateRoleFilter}
                      onChange={e => setCandidateRoleFilter(e.target.value)}
                      className="bg-card border border-border/60 rounded-xl px-2 py-1.5 text-xs font-semibold"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="EMPLOYEE">Employees</option>
                      <option value="TEAM_LEADER">Team Leaders</option>
                      <option value="INTERN">Interns</option>
                      <option value="ADMIN">Admins</option>
                    </select>
                  </div>

                  {/* Select All Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs font-bold">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="flex items-center gap-2 text-primary hover:text-primary-hover cursor-pointer"
                    >
                      {isAllCandidatesSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      <span>Select All Filtered ({filteredCandidates.length})</span>
                    </button>
                  </div>

                  {/* Candidate Checkbox List */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/30">
                    {filteredCandidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4 text-center">No matching employees found.</p>
                    ) : (
                      filteredCandidates.map(emp => {
                        const selected = selectedUserIds.includes(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => handleToggleCandidate(emp.id)}
                            className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                              selected
                                ? 'bg-primary/10 border-primary/30 text-foreground font-bold'
                                : 'bg-card border-border/50 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-xs">
                              {selected ? (
                                <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <UserAvatar user={emp} className="h-7 w-7 rounded-full shrink-0" />
                              <div>
                                <span className="font-bold text-foreground block leading-tight">{emp.name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {emp.employeeId} • {emp.department || 'General'}
                                </span>
                              </div>
                            </div>

                            {emp.salaryStructure && (
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                                Assigned
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* 3. Salary Template Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  3. Select Salary Template
                </label>
                <select
                  value={templateId}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="w-full bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5 text-xs font-bold text-foreground cursor-pointer"
                >
                  <option value="">Custom Salary Structure (Default)</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.targetRole})</option>
                  ))}
                </select>
              </div>

              {/* 4. Earnings Components */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Earnings Components (₹)</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Basic Salary *</label>
                    <input
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
                      type="number"
                      value={formData.bonus || ''}
                      onChange={e => setFormData({ ...formData, bonus: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 2500"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Deductions Components */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-black uppercase text-foreground tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  <span>Deductions Components (₹)</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">PF Deduction</label>
                    <input
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
                      type="number"
                      value={formData.incomeTax || ''}
                      onChange={e => setFormData({ ...formData, incomeTax: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 1500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="font-bold text-muted-foreground block mb-1">Other Deductions</label>
                    <input
                      type="number"
                      value={formData.otherDeductions || ''}
                      onChange={e => setFormData({ ...formData, otherDeductions: e.target.value })}
                      className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Live Summary, Effective Date, Preview & Confirmation */}
            <div className="lg:col-span-5 space-y-5">
              {/* Live Summary Panel */}
              <div className="p-5 rounded-2xl bg-muted/30 border border-border/60 space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span>Live Salary Summary Panel</span>
                </span>

                <div className="space-y-2 text-xs divide-y divide-border/40">
                  <div className="flex items-center justify-between pt-1 font-semibold">
                    <span className="text-muted-foreground">Gross Salary</span>
                    <span className="font-bold text-foreground text-sm">{formatINR(calculatedGross)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 font-semibold">
                    <span className="text-muted-foreground">Total Deductions</span>
                    <span className="font-bold text-rose-500 text-sm">{formatINR(calculatedDeductions)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-sm font-black">
                    <span className="text-primary font-extrabold">Net Monthly Salary</span>
                    <span className="text-lg text-primary font-black">{formatINR(calculatedNet)}</span>
                  </div>
                </div>
              </div>

              {/* Effective Date & Reason */}
              <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-3 text-xs">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Effective From Date *</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={e => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Assignment / Revision Reason</label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full bg-muted/30 border border-border/60 rounded-xl p-2 font-semibold text-foreground"
                    placeholder="e.g. Bulk Q3 Restructuring"
                  />
                </div>
              </div>

              {/* Bulk Preview & Confirmation Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/30 space-y-3 text-xs shadow-sm">
                <span className="text-xs font-black uppercase tracking-wider text-primary block">
                  Assignment Confirmation Preview
                </span>

                <div className="space-y-1.5 divide-y divide-border/30 text-xs font-medium">
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">Template</span>
                    <span className="font-bold text-foreground">{selectedTemplateObj?.name || 'Custom Salary Structure'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-muted-foreground">Selected Target</span>
                    <span className="font-bold text-foreground">
                      {assignmentType === 'SINGLE' ? selectedSingleUser?.name || '1 Employee' : `${selectedUserIds.length} Employees`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-muted-foreground">Net Pay per Employee</span>
                    <span className="font-bold text-primary">{formatINR(calculatedNet)}</span>
                  </div>

                  {assignmentType === 'BULK' && (
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-muted-foreground">Total Aggregate Commitment</span>
                      <span className="font-black text-secondary">{formatINR(totalAggregateCommitment)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-muted-foreground">Effective Date</span>
                    <span className="font-mono font-semibold text-foreground">{formData.effectiveFrom}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold text-center">
                  {assignmentType === 'SINGLE'
                    ? `Assign this structure to ${selectedSingleUser?.name || 'the employee'}?`
                    : `Assign this template to ${selectedUserIds.length} selected employees?`}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting || targetEmployeeCount === 0}
                  className="w-full py-3 btn-primary rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span>Processing Assignment...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {assignmentType === 'SINGLE'
                          ? 'Assign Structure'
                          : `Commit Bulk Assignment (${selectedUserIds.length})`}
                      </span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="py-2.5 px-3 bg-muted/40 hover:bg-muted text-muted-foreground font-bold text-xs rounded-xl border border-border/60 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Form</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-3 border border-border/70 hover:bg-muted text-foreground font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
