import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck, UserMinus, ShieldCheck, CheckCircle2, AlertTriangle,
  Clock, Award, Laptop, FileText, Calendar, Plus, X, Search, RefreshCw,
  Archive, AlertCircle, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';

const EmployeeLifecycle = () => {
  const { selectedOrgId } = useCompanyScope();
  const [activeTab, setActiveTab] = useState('onboarding'); // 'onboarding' | 'offboarding' | 'directory'
  const [roster, setRoster] = useState({ activeEmployees: [], archivedEmployees: [], totalEmployees: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [lifecycleDetails, setLifecycleDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Modals
  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [offboardModalOpen, setOffboardModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Onboard Form
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE',
    department: 'Engineering',
    baseSalary: '45000'
  });

  // Offboard Form
  const [offboardForm, setOffboardForm] = useState({
    userId: '',
    checklistNotes: '',
    finalSettlementNotes: ''
  });

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const res = await api.get('/enterprise/lifecycle/roster');
      if (res.data?.success) {
        setRoster(res.data.roster);
      }
    } catch (err) {
      console.error('Failed to fetch lifecycle roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [selectedOrgId]);

  const viewLifecycleDetails = async (userId) => {
    setDetailsLoading(true);
    try {
      const res = await api.get(`/enterprise/lifecycle/status/${userId}`);
      if (res.data?.success) {
        setLifecycleDetails(res.data.status);
      }
    } catch (err) {
      console.error('Failed to fetch lifecycle details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/enterprise/lifecycle/onboard', {
        employeeData: onboardForm
      });
      if (res.data?.success) {
        setSuccessMsg(`Successfully onboarded ${res.data.user?.name}! Shift, leave balance, and payroll initialized.`);
        setOnboardModalOpen(false);
        setOnboardForm({ name: '', email: '', role: 'EMPLOYEE', department: 'Engineering', baseSalary: '45000' });
        fetchRoster();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to onboard employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOffboard = async (e) => {
    e.preventDefault();
    if (!offboardForm.userId) {
      setErrorMsg('Please select an employee to offboard.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/enterprise/lifecycle/offboard', offboardForm);
      if (res.data?.success) {
        setSuccessMsg(`Offboarded ${res.data.user?.name}. Login disabled and assets returned.`);
        setOffboardModalOpen(false);
        setOffboardForm({ userId: '', checklistNotes: '', finalSettlementNotes: '' });
        fetchRoster();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to offboard employee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-emerald-500" />
            Employee Lifecycle Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Automated onboarding provisioning &amp; compliant offboarding with historical snapshot preservation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setOnboardModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md shadow-emerald-500/20 transition-all"
          >
            <UserCheck className="w-4 h-4" />
            Onboard Employee
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setOffboardModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-md shadow-amber-500/20 transition-all"
          >
            <UserMinus className="w-4 h-4" />
            Initiate Offboarding
          </button>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Workforce</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{roster.activeCount || 0}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Provisioned</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{roster.totalEmployees || 0}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Archived Profiles</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{roster.archivedCount || 0}</h4>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('onboarding')}
          className={`pb-3 px-1 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'onboarding'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Onboarding Hub &amp; Checklists
        </button>
        <button
          onClick={() => setActiveTab('offboarding')}
          className={`pb-3 px-1 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'offboarding'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <UserMinus className="w-4 h-4" />
          Offboarding &amp; Exit Management
        </button>
      </div>

      {/* Tab Content: Onboarding Hub */}
      {activeTab === 'onboarding' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-500" />
                Recently Onboarded Employees
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {roster.recentOnboarded?.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => viewLifecycleDetails(emp.id)}
                    className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                        {emp.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{emp.name}</h4>
                        <p className="text-xs text-slate-400">{emp.employeeId} &bull; {emp.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                        ACTIVE
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lifecycle Details Drawer/Panel */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-500" />
              Onboarding Checklist Status
            </h3>
            {detailsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading checklist details...</div>
            ) : lifecycleDetails ? (
              <div className="space-y-4 text-xs">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{lifecycleDetails.name}</h4>
                  <p className="text-slate-400">{lifecycleDetails.employeeId} &bull; {lifecycleDetails.department}</p>
                  <p className="text-slate-500 mt-1">Assigned Shift: <span className="font-semibold text-emerald-600">{lifecycleDetails.shift}</span></p>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">System Provisioning Steps:</p>
                  {lifecycleDetails.checklist?.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                      <CheckCircle2 className={`w-4 h-4 ${item.completed ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <span className={item.completed ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-400'}>
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Click on any employee to view their onboarding checklist and provisioned shift status.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Offboarding & Exit Management */}
      {activeTab === 'offboarding' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Enterprise Data Preservation Guarantee</h4>
              <p className="mt-0.5">
                When an employee is offboarded, their login access is disabled, profile status is archived, and assigned assets are unlinked.
                In accordance with enterprise HRMS compliance, <strong>all historical attendance punches, payroll records, and approved leave records are strictly preserved</strong>.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              Archived &amp; Departed Employees
            </h3>
            {roster.recentOffboarded?.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No employees have been archived yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {roster.recentOffboarded?.map((emp) => (
                  <div key={emp.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{emp.name}</h4>
                      <p className="text-xs text-slate-400">{emp.employeeId} &bull; {emp.department}</p>
                      {emp.customData?.offboardingNotes && (
                        <p className="text-xs text-slate-500 mt-0.5 italic">Note: {emp.customData.offboardingNotes}</p>
                      )}
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      ARCHIVED (READ-ONLY)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onboard Modal */}
      <AnimatePresence>
        {onboardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-500" />
                  Onboard New Employee
                </h3>
                <button onClick={() => setOnboardModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleOnboard} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={onboardForm.name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                    placeholder="e.g. Arjun Kapoor"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={onboardForm.email}
                    onChange={(e) => setOnboardForm({ ...onboardForm, email: e.target.value })}
                    placeholder="e.g. arjun@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                    <input
                      type="text"
                      value={onboardForm.department}
                      onChange={(e) => setOnboardForm({ ...onboardForm, department: e.target.value })}
                      placeholder="e.g. Engineering"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Monthly Salary (₹)</label>
                    <input
                      type="number"
                      value={onboardForm.baseSalary}
                      onChange={(e) => setOnboardForm({ ...onboardForm, baseSalary: e.target.value })}
                      placeholder="e.g. 45000"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1 text-slate-500">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Automated Provisioning Actions:</p>
                  <p>&bull; Assigns Company Default Shift</p>
                  <p>&bull; Allocates Annual Leave Balances</p>
                  <p>&bull; Creates Standard Payroll Salary Structure</p>
                  <p>&bull; Generates Welcome Checklist &amp; Audit Log</p>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOnboardModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    {submitting ? 'Provisioning...' : 'Complete Onboarding'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Offboard Modal */}
      <AnimatePresence>
        {offboardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <UserMinus className="w-5 h-5 text-amber-500" />
                  Initiate Employee Offboarding
                </h3>
                <button onClick={() => setOffboardModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleOffboard} className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Departing Employee *</label>
                  <select
                    required
                    value={offboardForm.userId}
                    onChange={(e) => setOffboardForm({ ...offboardForm, userId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">-- Choose Employee --</option>
                    {roster.recentOnboarded?.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeId}) - {emp.department}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Checklist &amp; Asset Handover Notes</label>
                  <textarea
                    rows="3"
                    value={offboardForm.checklistNotes}
                    onChange={(e) => setOffboardForm({ ...offboardForm, checklistNotes: e.target.value })}
                    placeholder="All issued laptops and badges returned in functional condition..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 space-y-1 text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">System Exit Automation Steps:</p>
                  <p>&bull; Returns all assigned assets to AVAILABLE inventory</p>
                  <p>&bull; Disables user login access</p>
                  <p>&bull; Sets status to ARCHIVED (historical attendance &amp; payroll preserved)</p>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setOffboardModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    {submitting ? 'Archiving Profile...' : 'Confirm Offboarding'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeLifecycle;
