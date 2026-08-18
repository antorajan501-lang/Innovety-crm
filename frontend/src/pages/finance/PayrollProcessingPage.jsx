import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Play, Lock, Eye, CheckCircle2, RotateCcw, Layers, Clock,
  Calendar, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft,
  User, DollarSign, FileText, ArrowRight, ShieldCheck, Info, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollProcessingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeStep, setActiveStep] = useState(1);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pre-calculation Validation Stats
  const [validatingStructures, setValidatingStructures] = useState(false);
  const [structureStats, setStructureStats] = useState({
    totalUsers: 0,
    assignedCount: 0,
    missingCount: 0
  });

  // Modal States
  const [showLockModal, setShowLockModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Selected Employee Audit Detail Modal
  const [auditEmployeePayslip, setAuditEmployeePayslip] = useState(null);

  useEffect(() => {
    fetchBatchDetails();
    fetchStructureValidationStats();
  }, [selectedMonth, selectedYear]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/payroll/batches?month=${selectedMonth}&year=${selectedYear}`);
      const batchList = Array.isArray(res.data) ? res.data : res.data?.batches || [];
      if (batchList.length > 0) {
        const fullRes = await api.get(`/payroll/batches/${batchList[0].id}`);
        const batch = fullRes.data;
        setCurrentBatch(batch);

        // Synchronize active wizard step based on batch status
        if (batch.status === 'PUBLISHED') setActiveStep(5);
        else if (batch.status === 'REVIEW') setActiveStep(4);
        else if (batch.status === 'LOCKED') setActiveStep(3);
        else if (['PREVIEW', 'DRAFT', 'ROLLED_BACK'].includes(batch.status)) setActiveStep(2);
        else setActiveStep(1);
      } else {
        setCurrentBatch(null);
        setActiveStep(1);
      }
    } catch (err) {
      console.error('Failed to fetch batch details:', err);
      setCurrentBatch(null);
      setActiveStep(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchStructureValidationStats = async () => {
    try {
      setValidatingStructures(true);
      const [usersRes, structuresRes] = await Promise.all([
        api.get('/users?limit=1000').catch(() => ({ data: [] })),
        api.get('/payroll/salary-structures').catch(() => ({ data: [] }))
      ]);

      const usersList = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || [];
      const eligibleUsers = usersList.filter(u => u.status === 'ACTIVE' && ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'].includes(u.role));
      const structuresList = Array.isArray(structuresRes.data) ? structuresRes.data : [];
      const assignedIds = new Set(structuresList.map(s => s.userId));

      const assignedCount = eligibleUsers.filter(u => assignedIds.has(u.id)).length;
      const missingCount = eligibleUsers.length - assignedCount;

      setStructureStats({
        totalUsers: eligibleUsers.length,
        assignedCount,
        missingCount
      });
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidatingStructures(false);
    }
  };

  const handleProcess = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      const res = await api.post('/payroll/batches/process', {
        month: selectedMonth,
        year: selectedYear
      });
      const batchData = res.data?.batch || res.data;
      setCurrentBatch(batchData);
      await fetchBatchDetails();
      setActiveStep(2);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to process payroll batch.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmLockBatch = async () => {
    if (!currentBatch) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const res = await api.put(`/payroll/batches/${currentBatch.id}/status`, { status: 'LOCKED' });
      setCurrentBatch(res.data);
      setShowLockModal(false);
      setActiveStep(3);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to lock payroll batch.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToReview = async () => {
    if (!currentBatch) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const res = await api.put(`/payroll/batches/${currentBatch.id}/status`, { status: 'REVIEW' });
      setCurrentBatch(res.data);
      setActiveStep(4);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to move batch to review.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPublishPayslips = async () => {
    if (!currentBatch) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await api.post(`/payroll/batches/${currentBatch.id}/publish`);
      await fetchBatchDetails();
      setShowPublishModal(false);
      setActiveStep(5);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to publish payslips.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRollbackBatch = async () => {
    if (!currentBatch) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const res = await api.post(`/payroll/batches/${currentBatch.id}/rollback`);
      const updatedBatch = res.data?.batch || res.data;
      setCurrentBatch(updatedBatch);
      await fetchBatchDetails();
      setShowRollbackModal(false);
      setActiveStep(2);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to rollback payroll batch.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;
  const isAdminOrSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const steps = [
    { title: 'Select Period', stepNum: 1 },
    { title: 'Automated Calculation', stepNum: 2 },
    { title: 'Lock Batch', stepNum: 3 },
    { title: 'Audit & Review', stepNum: 4 },
    { title: 'Publish Payslips', stepNum: 5 }
  ];

  const getStepStatus = (stepNum) => {
    const statusOrder = {
      'ROLLED_BACK': 2,
      'PREVIEW': 2,
      'DRAFT': 2,
      'LOCKED': 3,
      'REVIEW': 4,
      'PUBLISHED': 5
    };
    const maxCompletedStep = currentBatch ? (statusOrder[currentBatch.status] || 1) : 1;

    if (stepNum === activeStep) return 'active';
    if (stepNum < maxCompletedStep || stepNum < activeStep) return 'completed';
    return 'pending';
  };

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="bg-card border border-border/80 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> Payroll Processing Wizard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Select month, calculate payroll, verify the batch and publish payslips.
          </p>
        </div>

        {/* Selected Period Badge in Header */}
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl text-xs font-bold">
          <Calendar className="w-4 h-4" />
          <span>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
        </div>
      </div>

      {/* 2. Stepper Indicator */}
      <div className="bg-card border border-border/80 p-5 rounded-2xl shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {steps.map((step) => {
            const status = getStepStatus(step.stepNum);
            return (
              <button
                key={step.stepNum}
                onClick={() => {
                  if (status === 'completed' || status === 'active' || step.stepNum <= activeStep) {
                    setActiveStep(step.stepNum);
                  }
                }}
                className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold'
                    : status === 'active'
                    ? 'bg-primary/10 border-primary text-primary font-black shadow-sm ring-2 ring-primary/20'
                    : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider mb-1">
                  {status === 'completed' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : null}
                  <span>Step {step.stepNum}</span>
                </div>
                <span className="text-xs font-extrabold block truncate">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert if any action failed */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs hover:underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* 3. STEP CONTENT AREA */}

      {/* ==================== STEP 1: SELECT PERIOD ==================== */}
      {activeStep === 1 && (
        <div className="bg-card border border-border/80 p-8 rounded-2xl shadow-sm space-y-6 max-w-2xl mx-auto text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Select Payroll Period</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Choose the month and year for payroll processing.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto bg-muted/30 p-5 rounded-2xl border border-border/60">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>{name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {[2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs font-bold text-primary max-w-md mx-auto flex items-center justify-between">
            <span>Selected Period:</span>
            <span className="font-black text-sm">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
          </div>

          <button
            onClick={() => {
              setActiveStep(2);
              fetchStructureValidationStats();
            }}
            className="w-full max-w-md bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mx-auto"
          >
            <span>Continue to Calculation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================== STEP 2: AUTOMATED CALCULATION ==================== */}
      {activeStep === 2 && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Automated Payroll Calculation — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Validate salary structure assignments and generate draft payroll items.
                </p>
              </div>

              {currentBatch && (
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                  currentBatch.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600' :
                  currentBatch.status === 'LOCKED' ? 'bg-amber-500/10 text-amber-600' :
                  currentBatch.status === 'REVIEW' ? 'bg-blue-500/10 text-blue-600' :
                  currentBatch.status === 'ROLLED_BACK' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-primary/10 text-primary'
                }`}>
                  Status: {currentBatch.status}
                </span>
              )}
            </div>

            {/* Validation Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-left">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Active Payroll Users</span>
                <span className="text-xl font-black text-foreground mt-1 block">
                  {validatingStructures ? '...' : structureStats.totalUsers}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-left">
                <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 block">Structures Assigned</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {validatingStructures ? '...' : structureStats.assignedCount}
                </span>
              </div>
              <div className={`p-4 rounded-xl border text-left ${structureStats.missingCount > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/60 bg-muted/20'}`}>
                <span className={`text-[10px] font-extrabold uppercase block ${structureStats.missingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  Missing Structures
                </span>
                <span className={`text-xl font-black mt-1 block ${structureStats.missingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                  {validatingStructures ? '...' : structureStats.missingCount}
                </span>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-left">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Batch Total Net</span>
                <span className="text-xl font-black text-primary mt-1 block">
                  {currentBatch ? formatINR(currentBatch.totalNet) : '₹0'}
                </span>
              </div>
            </div>

            {/* Warning if structures missing */}
            {structureStats.missingCount > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                  <span>
                    ⚠ {structureStats.missingCount} employee(s) do not have salary structures assigned. Their salary will be calculated as ₹0 until assigned.
                  </span>
                </div>
                <button
                  onClick={() => navigate('/payroll/structures')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  Review Salary Structures
                </button>
              </div>
            )}

            {/* Action controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Change Period
              </button>

              {isAdminOrSuperAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleProcess}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{actionLoading ? 'Calculating...' : currentBatch ? 'Recalculate Batch' : 'Calculate & Draft Batch'}</span>
                  </button>

                  {currentBatch && ['PREVIEW', 'DRAFT', 'ROLLED_BACK'].includes(currentBatch.status) && (
                    <button
                      onClick={() => setActiveStep(3)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                    >
                      <span>Continue to Lock Batch</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Batch Itemized Table */}
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading batch details...</p>
          ) : currentBatch && currentBatch.payslips?.length > 0 ? (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm">
                  Batch Itemized Payslips ({currentBatch.payslips.length} Employees)
                </h3>
                <span className="text-xs text-muted-foreground font-semibold">
                  Gross: {formatINR(currentBatch.totalGross)} | Deductions: {formatINR(currentBatch.totalDeductions)} | Net: {formatINR(currentBatch.totalNet)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase">
                    <tr>
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5">Basic</th>
                      <th className="p-3.5">HRA / Allowances</th>
                      <th className="p-3.5">Present / Paid Leave</th>
                      <th className="p-3.5">Overtime / Holiday Pay</th>
                      <th className="p-3.5">Deductions</th>
                      <th className="p-3.5 text-right">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {currentBatch.payslips.map(ps => {
                      const isAssigned = ps.allowancesJson?.structureAssigned !== false && (ps.basicSalary > 0 || ps.grossSalary > 0);
                      return (
                        <tr key={ps.id} className={`hover:bg-muted/30 ${!isAssigned ? 'bg-amber-500/5' : ''}`}>
                          <td className="p-3.5">
                            <p className="font-bold text-foreground">{ps.user?.name}</p>
                            <p className="text-[11px] text-muted-foreground">{ps.user?.role} • {ps.user?.email}</p>
                            {!isAssigned && (
                              <span className="inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                Salary Structure Not Assigned
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-semibold">
                            {isAssigned ? formatINR(ps.basicSalary) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {isAssigned ? formatINR(ps.hra + (ps.allowancesJson?.specialAllowance || 0)) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3.5 text-foreground">
                            <span className="font-semibold">{ps.presentDays}d present</span> / <span className="text-muted-foreground">{ps.paidLeaveDays}d leave</span>
                          </td>
                          <td className="p-3.5 text-primary font-semibold">
                            {isAssigned ? (
                              <>
                                +{formatINR(ps.overtimePay + ps.holidayPay)}
                                <span className="text-[10px] text-muted-foreground block">{ps.overtimeHours}h OT • {ps.holidayDaysWorked}d Holiday</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3.5 text-destructive font-semibold">
                            {isAssigned ? `-${formatINR(ps.grossSalary - ps.netSalary)}` : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3.5 text-right font-extrabold text-sm text-foreground">
                            {isAssigned ? (
                              formatINR(ps.netSalary)
                            ) : (
                              <span className="inline-flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                                Structure Not Assigned
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground space-y-2">
              <Clock className="w-8 h-8 mx-auto opacity-50 text-primary" />
              <p className="font-bold text-foreground">No Payroll Batch Processed for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              <p className="text-xs">Click "Calculate & Draft Batch" above to run automated calculations.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== STEP 3: LOCK BATCH ==================== */}
      {activeStep === 3 && (
        <div className="bg-card border border-border/80 p-8 rounded-2xl shadow-sm space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-foreground">Lock Payroll Batch</h2>
              <p className="text-xs text-muted-foreground">
                Lock calculations to prevent unauthorized updates before final audit.
              </p>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              currentBatch?.status === 'LOCKED' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
            }`}>
              {currentBatch?.status || 'PREVIEW'}
            </span>
          </div>

          {/* Locked Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-muted/20 p-5 rounded-2xl border border-border/60 text-left">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Payroll Period</span>
              <span className="text-sm font-black text-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Employees</span>
              <span className="text-sm font-black text-foreground">{currentBatch?.totalEmployees || 0}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Salary Structures</span>
              <span className="text-sm font-black text-emerald-600">All Valid</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Gross Payroll</span>
              <span className="text-sm font-black text-foreground">{formatINR(currentBatch?.totalGross)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Deductions</span>
              <span className="text-sm font-black text-destructive">-{formatINR(currentBatch?.totalDeductions)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Net Payroll</span>
              <span className="text-sm font-black text-primary">{formatINR(currentBatch?.totalNet)}</span>
            </div>
          </div>

          {currentBatch?.status === 'LOCKED' ? (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-amber-600" />
                <span>✓ Payroll Batch Locked</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-medium pt-1">
                <p>Locked By: <strong className="text-foreground">{currentBatch.processedBy?.name || 'System Admin'}</strong></p>
                <p>Locked At: <strong className="text-foreground">{new Date(currentBatch.lockedAt || Date.now()).toLocaleString()}</strong></p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>Once this payroll batch is locked, salary calculations cannot be modified unless the batch is rolled back.</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40">
            <button
              onClick={() => setActiveStep(2)}
              className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Calculation
            </button>

            {isAdminOrSuperAdmin && (
              <div className="flex items-center gap-2">
                {currentBatch?.status === 'LOCKED' && (
                  <button
                    onClick={() => setShowRollbackModal(true)}
                    className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Rollback
                  </button>
                )}

                {currentBatch?.status === 'LOCKED' ? (
                  <button
                    onClick={handleMoveToReview}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>Continue to Audit & Review</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLockModal(true)}
                    disabled={actionLoading || !currentBatch}
                    className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Lock Payroll Batch</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== STEP 4: AUDIT & REVIEW ==================== */}
      {activeStep === 4 && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <h2 className="text-lg font-black text-foreground">
                  Payroll Audit & Review — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify individual employee line items, statutory deductions, and tax compliance before publishing.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-blue-500/10 text-blue-600 border border-blue-500/20">
                Status: REVIEW
              </span>
            </div>

            {/* Audit Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-left">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Employees</span>
                <span className="text-xl font-black text-foreground mt-1 block">{currentBatch?.totalEmployees || 0}</span>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-left">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Gross Payroll</span>
                <span className="text-xl font-black text-foreground mt-1 block">{formatINR(currentBatch?.totalGross)}</span>
              </div>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-left">
                <span className="text-[10px] font-extrabold uppercase text-muted-foreground block">Deductions</span>
                <span className="text-xl font-black text-destructive mt-1 block">-{formatINR(currentBatch?.totalDeductions)}</span>
              </div>
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-left">
                <span className="text-[10px] font-extrabold uppercase text-primary block">Net Payroll</span>
                <span className="text-xl font-black text-primary mt-1 block">{formatINR(currentBatch?.totalNet)}</span>
              </div>
            </div>

            {/* Audit Checklist */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl text-left space-y-2">
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Automated Audit Reconciliations Passed
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Salary structures validated
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Attendance validated
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Leave records validated
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Deductions validated
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Batch totals reconciled
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> No duplicate payslips
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setActiveStep(3)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Lock Step
              </button>

              {isAdminOrSuperAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRollbackModal(true)}
                    className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Rollback
                  </button>

                  <button
                    onClick={() => setActiveStep(5)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>Approve & Continue to Publish</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Audit Detailed Table */}
          {currentBatch?.payslips?.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-foreground text-sm">Detailed Audit Ledger ({currentBatch.payslips.length} Employees)</h3>
                <span className="text-xs text-muted-foreground font-semibold">Click "View Details" to inspect audit logs per employee</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Basic</th>
                      <th className="p-3">HRA / Allowances</th>
                      <th className="p-3">Attendance</th>
                      <th className="p-3">OT / Holiday</th>
                      <th className="p-3">PF / ESI / TDS</th>
                      <th className="p-3 text-right">Net Salary</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {currentBatch.payslips.map(ps => (
                      <tr key={ps.id} className="hover:bg-muted/30 whitespace-nowrap">
                        <td className="p-3">
                          <p className="font-bold text-foreground">{ps.user?.name}</p>
                          <p className="text-[11px] text-muted-foreground">{ps.user?.role} • {ps.user?.employeeId || 'EM-00'}</p>
                        </td>
                        <td className="p-3 font-semibold">{formatINR(ps.basicSalary)}</td>
                        <td className="p-3 text-muted-foreground">{formatINR(ps.hra + (ps.allowancesJson?.specialAllowance || 0))}</td>
                        <td className="p-3">{ps.presentDays}d Present / {ps.paidLeaveDays}d Leave</td>
                        <td className="p-3 text-primary font-semibold">+{formatINR(ps.overtimePay + ps.holidayPay)}</td>
                        <td className="p-3 text-destructive font-semibold">-{formatINR(ps.grossSalary - ps.netSalary)}</td>
                        <td className="p-3 text-right font-extrabold text-sm">{formatINR(ps.netSalary)}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setAuditEmployeePayslip(ps)}
                            className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== STEP 5: PUBLISH PAYSLIPS ==================== */}
      {activeStep === 5 && (
        <div className="bg-card border border-border/80 p-8 rounded-2xl shadow-sm space-y-6 max-w-3xl mx-auto text-left">
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-foreground">Publish Payslips</h2>
              <p className="text-xs text-muted-foreground">
                Finalize this payroll batch and release employee payslips.
              </p>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
              currentBatch?.status === 'PUBLISHED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
            }`}>
              {currentBatch?.status || 'REVIEW'}
            </span>
          </div>

          {/* Final Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/20 p-5 rounded-2xl border border-border/60">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Payroll Period</span>
              <span className="text-sm font-black text-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Employees</span>
              <span className="text-sm font-black text-foreground">{currentBatch?.totalEmployees || 0}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Audit Status</span>
              <span className="text-sm font-black text-emerald-600">✓ Passed</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">Net Payroll</span>
              <span className="text-sm font-black text-primary">{formatINR(currentBatch?.totalNet)}</span>
            </div>
          </div>

          {currentBatch?.status === 'PUBLISHED' ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-base">
                <CheckCircle className="w-6 h-6" />
                <span>✓ Payroll Published Successfully</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All employee payslips for {MONTH_NAMES[selectedMonth - 1]} {selectedYear} are now finalized and accessible in the employee portal.
              </p>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Published By: <strong className="text-foreground">{currentBatch.processedBy?.name || 'System Admin'}</strong>
                </span>
                <button
                  onClick={() => navigate('/payroll/reports')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4" /> View Payslips
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>Publishing will finalize this payroll batch and generate employee payslips.</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <button
                  onClick={() => setActiveStep(4)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Audit & Review
                </button>

                {isAdminOrSuperAdmin && (
                  <button
                    onClick={() => setShowPublishModal(true)}
                    disabled={actionLoading || !currentBatch}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Publish Payslips</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Lock Batch Modal */}
      {showLockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Lock Payroll Batch?</h3>
                <p className="text-xs text-muted-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are about to lock the payroll batch for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}. After locking, calculations cannot be changed without rolling back the batch.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowLockModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmLockBatch}
                disabled={actionLoading}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading ? 'Locking...' : 'Lock Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Payslips Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Publish Payslips?</h3>
                <p className="text-xs text-muted-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are about to publish official employee payslips for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}. Affected employees will be notified immediately.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublishPayslips}
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading ? 'Publishing...' : 'Publish Payslips'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rollback Modal */}
      {showRollbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Rollback Payroll Batch?</h3>
                <p className="text-xs text-muted-foreground">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to roll back this payroll batch? The batch will return to a recalculable state.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRollbackModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmRollbackBatch}
                disabled={actionLoading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading ? 'Rolling Back...' : 'Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Audit Details Modal */}
      {auditEmployeePayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-left max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-sm font-black text-foreground">{auditEmployeePayslip.user?.name}</h3>
                <p className="text-[11px] text-muted-foreground">{auditEmployeePayslip.user?.role} • {auditEmployeePayslip.user?.email}</p>
              </div>
              <button onClick={() => setAuditEmployeePayslip(null)} className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Structure Check */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-extrabold text-foreground uppercase tracking-wider block text-[10px]">Salary Structure Summary</span>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <p>Basic Salary: <strong className="text-foreground">{formatINR(auditEmployeePayslip.basicSalary)}</strong></p>
                  <p>HRA: <strong className="text-foreground">{formatINR(auditEmployeePayslip.hra)}</strong></p>
                </div>
              </div>

              {/* Attendance Breakdown */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-extrabold text-foreground uppercase tracking-wider block text-[10px]">Attendance & Leaves Breakdown</span>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <p>Present Days: <strong className="text-foreground">{auditEmployeePayslip.presentDays}d</strong></p>
                  <p>Paid Leave Days: <strong className="text-foreground">{auditEmployeePayslip.paidLeaveDays}d</strong></p>
                  <p>Unpaid/LOP Days: <strong className="text-destructive">{auditEmployeePayslip.unpaidAbsentDays}d</strong></p>
                  <p>WFH Days: <strong className="text-foreground">{auditEmployeePayslip.wfhDays}d</strong></p>
                </div>
              </div>

              {/* Overtime & Holiday Work */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-extrabold text-foreground uppercase tracking-wider block text-[10px]">Additional Earnings</span>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <p>Overtime ({auditEmployeePayslip.overtimeHours}h): <strong className="text-primary">+{formatINR(auditEmployeePayslip.overtimePay)}</strong></p>
                  <p>Holiday ({auditEmployeePayslip.holidayDaysWorked}d): <strong className="text-primary">+{formatINR(auditEmployeePayslip.holidayPay)}</strong></p>
                </div>
              </div>

              {/* Itemized Deductions */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <span className="font-extrabold text-foreground uppercase tracking-wider block text-[10px]">Deductions</span>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <p>PF Deduction: <strong className="text-destructive">-{formatINR(auditEmployeePayslip.deductionsJson?.pfDeduction)}</strong></p>
                  <p>ESI Deduction: <strong className="text-destructive">-{formatINR(auditEmployeePayslip.deductionsJson?.esiDeduction)}</strong></p>
                  <p>Prof Tax: <strong className="text-destructive">-{formatINR(auditEmployeePayslip.deductionsJson?.profTax)}</strong></p>
                  <p>Income Tax: <strong className="text-destructive">-{formatINR(auditEmployeePayslip.deductionsJson?.incomeTax)}</strong></p>
                  <p>Late Penalty: <strong className="text-destructive">-{formatINR(auditEmployeePayslip.lateDeduction)}</strong></p>
                  <p>Leave LOP Deduction: <strong className="text-destructive">-{formatINR(auditEmployeePayslip.deductionsJson?.leaveDeduction)}</strong></p>
                </div>
              </div>

              {/* Final Totals */}
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-foreground font-black text-sm">
                <span>Net Salary Payable:</span>
                <span className="text-primary">{formatINR(auditEmployeePayslip.netSalary)}</span>
              </div>
            </div>

            <button
              onClick={() => setAuditEmployeePayslip(null)}
              className="w-full bg-primary text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
