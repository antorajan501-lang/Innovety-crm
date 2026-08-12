import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Settings,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Shield,
  RotateCcw,
  Clock,
  Briefcase,
  FileText,
  Sliders,
  Sparkles,
  Lock,
  Layers,
  Search,
  Check,
  X,
  Stethoscope,
  Award,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';

const LeavePolicySettings = () => {
  const [policy, setPolicy] = useState({
    allocationType: 'ANNUAL',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5.0,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  });

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [userBalances, setUserBalances] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [alert, setAlert] = useState({ type: '', text: '' });

  // Modals state
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeFormData, setTypeFormData] = useState({
    name: '',
    code: '',
    description: '',
    color: '#3B82F6',
    icon: 'Calendar',
    displayOrder: 0,
    isPaid: true,
    annualDays: 12,
    monthlyCreditDays: 1,
    allowCarryForward: false,
    requireDoc: false,
    allowHalfDay: true
  });

  // Manual adjustment modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedUserForAdjust, setSelectedUserForAdjust] = useState(null);
  const [adjustFormData, setAdjustFormData] = useState({
    leaveTypeId: '',
    adjustmentDays: 1,
    reason: ''
  });
  const [adjusting, setAdjusting] = useState(false);

  // Annual reset confirm modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchPolicyData = async () => {
    try {
      setLoading(true);
      const [polRes, balRes] = await Promise.all([
        api.get('/leave-policy'),
        api.get('/leave-policy/balances')
      ]);

      if (polRes.data?.policy) {
        setPolicy(polRes.data.policy);
      }
      setLeaveTypes(polRes.data?.leaveTypes || []);
      setUserBalances(balRes.data || []);
      setAlert({ type: '', text: '' });
    } catch (err) {
      console.error('Fetch leave policy error:', err);
      setAlert({ type: 'error', text: 'Failed to load global leave policy settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicyData();
  }, []);

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    setSavingPolicy(true);
    setAlert({ type: '', text: '' });

    try {
      const res = await api.put('/leave-policy', policy);
      setPolicy(res.data.policy);
      setAlert({ type: 'success', text: 'Global Leave Policy updated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', text: err.response?.data?.message || 'Failed to update leave policy.' });
    } finally {
      setSavingPolicy(false);
    }
  };

  // Auto-generate code e.g. "Marriage Leave" -> "ML"
  const handleNameChange = (e) => {
    const val = e.target.value;
    let autoCode = typeFormData.code;
    if (!editingType && val) {
      const words = val.trim().split(/\s+/);
      if (words.length >= 2) {
        autoCode = (words[0][0] + words[1][0]).toUpperCase();
      } else {
        autoCode = val.substring(0, 3).toUpperCase();
      }
    }
    setTypeFormData({ ...typeFormData, name: val, code: autoCode });
  };

  const openTypeModal = (lt = null) => {
    if (lt) {
      setEditingType(lt);
      setTypeFormData({
        name: lt.name,
        code: lt.code,
        description: lt.description || '',
        color: lt.color || '#3B82F6',
        icon: lt.icon || 'Calendar',
        displayOrder: lt.displayOrder || 0,
        isPaid: lt.isPaid,
        annualDays: lt.annualDays,
        monthlyCreditDays: lt.monthlyCreditDays,
        allowCarryForward: lt.allowCarryForward,
        requireDoc: lt.requireDoc,
        allowHalfDay: lt.allowHalfDay
      });
    } else {
      setEditingType(null);
      setTypeFormData({
        name: '',
        code: '',
        description: '',
        color: '#3B82F6',
        icon: 'Calendar',
        displayOrder: leaveTypes.length + 1,
        isPaid: true,
        annualDays: 12,
        monthlyCreditDays: 1,
        allowCarryForward: false,
        requireDoc: false,
        allowHalfDay: true
      });
    }
    setTypeModalOpen(true);
  };

  const handleSaveLeaveType = async (e) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api.put(`/leave-policy/types/${editingType.id}`, typeFormData);
        setAlert({ type: 'success', text: `Leave Type ${typeFormData.name} updated successfully!` });
      } else {
        await api.post('/leave-policy/types', typeFormData);
        setAlert({ type: 'success', text: `Leave Type ${typeFormData.name} created successfully!` });
      }
      setTypeModalOpen(false);
      fetchPolicyData();
    } catch (err) {
      setAlert({ type: 'error', text: err.response?.data?.message || 'Failed to save leave type.' });
    }
  };

  const handleToggleStatus = async (lt) => {
    try {
      const res = await api.put(`/leave-policy/types/${lt.id}/status`);
      setAlert({ type: 'success', text: res.data.message });
      fetchPolicyData();
    } catch (err) {
      setAlert({ type: 'error', text: 'Failed to toggle leave type status.' });
    }
  };

  const handleDeleteLeaveType = async (lt) => {
    if (lt.isSystem) {
      setAlert({ type: 'error', text: 'System default leave types cannot be deleted.' });
      return;
    }
    if (!window.confirm(`Are you sure you want to delete custom leave type "${lt.name}"?`)) return;

    try {
      await api.delete(`/leave-policy/types/${lt.id}`);
      setAlert({ type: 'success', text: `Leave Type ${lt.name} deleted.` });
      fetchPolicyData();
    } catch (err) {
      setAlert({ type: 'error', text: err.response?.data?.message || 'Failed to delete leave type.' });
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    if (!adjustFormData.leaveTypeId || !adjustFormData.reason) {
      setAlert({ type: 'error', text: 'Please fill all required adjustment fields.' });
      return;
    }
    setAdjusting(true);

    try {
      const payload = {
        userId: selectedUserForAdjust.userId,
        leaveTypeId: adjustFormData.leaveTypeId,
        adjustmentDays: adjustFormData.adjustmentDays,
        reason: adjustFormData.reason
      };

      await api.post('/leave-policy/adjust-balance', payload);
      setAlert({ type: 'success', text: 'User leave balance adjusted successfully!' });
      setAdjustModalOpen(false);
      fetchPolicyData();
    } catch (err) {
      setAlert({ type: 'error', text: err.response?.data?.message || 'Failed to adjust user leave balance.' });
    } finally {
      setAdjusting(false);
    }
  };

  const handleRunAnnualReset = async () => {
    setResetting(true);
    try {
      const res = await api.post('/leave-policy/annual-reset');
      setAlert({ type: 'success', text: res.data.message || 'Annual leave reset executed!' });
      setResetModalOpen(false);
      fetchPolicyData();
    } catch (err) {
      setAlert({ type: 'error', text: err.response?.data?.message || 'Failed to execute annual reset.' });
    } finally {
      setResetting(false);
    }
  };

  const filteredUserBalances = userBalances.filter(u =>
    u.leaveType?.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.leaveType?.code?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 p-4 sm:p-8 max-w-7xl mx-auto text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Calendar className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <span>Innoveity Global Leave Policy</span>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Single company-wide leave policy governing Interns, Employees, and Team Leaders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setResetModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Run Annual Reset</span>
          </button>
          <button
            onClick={() => openTypeModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Leave Type</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert.text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xs ${
            alert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alert.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert({ type: '', text: '' })} className="p-1 hover:opacity-75">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* SINGLE MERGED CARD: GLOBAL LEAVE POLICY */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-md text-left space-y-6">
        {/* Card Header with Save Button */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">Global Leave Policy</h2>
          </div>
          <button
            onClick={handleSavePolicy}
            disabled={savingPolicy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            <span>{savingPolicy ? 'Saving...' : 'Save Policy'}</span>
          </button>
        </div>

        {/* 1. Allocation Mode Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Allocation Mode *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              onClick={() => setPolicy({ ...policy, allocationType: 'ANNUAL' })}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                policy.allocationType === 'ANNUAL'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border/60 bg-muted/20 hover:border-border'
              }`}
            >
              <input
                type="radio"
                name="allocationType"
                value="ANNUAL"
                checked={policy.allocationType === 'ANNUAL'}
                onChange={() => {}}
                className="mt-1 text-primary focus:ring-primary"
              />
              <div>
                <h4 className="text-sm font-black text-foreground">Annual Allocation</h4>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Allocates total annual leave allowance immediately at the start of each year.
                </p>
              </div>
            </label>

            <label
              onClick={() => setPolicy({ ...policy, allocationType: 'MONTHLY' })}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                policy.allocationType === 'MONTHLY'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border/60 bg-muted/20 hover:border-border'
              }`}
            >
              <input
                type="radio"
                name="allocationType"
                value="MONTHLY"
                checked={policy.allocationType === 'MONTHLY'}
                onChange={() => {}}
                className="mt-1 text-primary focus:ring-primary"
              />
              <div>
                <h4 className="text-sm font-black text-foreground">Monthly Automated Credit</h4>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Credits configured monthly leave days automatically every 1st of the month.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Leave Types List Immediately Below Allocation Mode */}
        <div className="pt-6 border-t border-border/40 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Leave Types</h3>
              <p className="text-xs text-muted-foreground font-medium">
                Configure allowances, colors, and system status for company leave categories.
              </p>
            </div>
            <button
              onClick={() => openTypeModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Leave Type</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {leaveTypes.map((lt) => (
              <div
                key={lt.id}
                className={`p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-5 shadow-xs ${
                  lt.isActive ? 'bg-card border-border/80 hover:border-primary/50 hover:shadow-md' : 'bg-muted/30 border-border/40 opacity-60'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-4 w-4 rounded-full shrink-0 shadow-xs border border-white/20"
                        style={{ backgroundColor: lt.color }}
                      />
                      <span className="font-mono text-xs font-black text-foreground tracking-wider">{lt.code}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {lt.isSystem && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1" title="System default leave type">
                          <Lock className="h-3 w-3" /> System
                        </span>
                      )}
                      <button
                        onClick={() => handleToggleStatus(lt)}
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                          lt.isActive ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        }`}
                      >
                        {lt.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-foreground">{lt.name}</h3>
                    <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                      {lt.description || 'Configurable organizational leave category'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-3 text-center text-xs">
                    <div className="bg-muted/40 p-3 rounded-2xl border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-extrabold block uppercase tracking-wider">Annual Allowance</span>
                      <span className="font-black text-sm text-foreground mt-0.5 block">{lt.isPaid ? `${lt.annualDays} Days` : 'Unpaid'}</span>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-2xl border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-extrabold block uppercase tracking-wider">Monthly Credit</span>
                      <span className="font-black text-sm text-foreground mt-0.5 block">{lt.isPaid ? `${lt.monthlyCreditDays} Days` : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                  <button
                    onClick={() => openTypeModal(lt)}
                    className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    title="Edit Leave Type"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLeaveType(lt)}
                    disabled={lt.isSystem}
                    className={`p-2 rounded-xl transition-colors ${
                      lt.isSystem
                        ? 'text-muted-foreground/30 cursor-not-allowed'
                        : 'text-muted-foreground hover:bg-muted hover:text-rose-600 cursor-pointer'
                    }`}
                    title={lt.isSystem ? 'System defaults cannot be deleted' : 'Delete Leave Type'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* USER LEAVE BALANCES */}
      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-md text-left space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-base font-extrabold text-foreground">User Leave Balances</h2>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search user balances..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3">Leave Category</th>
                <th className="px-4 py-3 text-center">Allocated</th>
                <th className="px-4 py-3 text-center">Used</th>
                <th className="px-4 py-3 text-center">Pending</th>
                <th className="px-4 py-3 text-center">Available</th>
                <th className="px-4 py-3 text-center">Carry Forward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredUserBalances.map((b) => (
                <tr key={b.id} className="hover:bg-muted/20 transition-all">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.leaveType?.color || '#3B82F6' }} />
                      <div>
                        <span className="font-bold text-foreground block">{b.leaveType?.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{b.leaveType?.code}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-extrabold text-foreground">{b.allocated}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-rose-600">{b.used}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-amber-600">{b.pending}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-emerald-600">{b.available}</td>
                  <td className="px-4 py-3 text-center font-extrabold text-muted-foreground">{b.carryForward}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAVE TYPE MODAL */}
      {typeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-left max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <h3 className="text-base font-extrabold text-foreground">
                {editingType ? `Edit Leave Type: ${editingType.name}` : 'Create Dynamic Leave Type'}
              </h3>
              <button onClick={() => setTypeModalOpen(false)} className="p-1 rounded-xl text-muted-foreground hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLeaveType} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Leave Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marriage Leave"
                    value={typeFormData.name}
                    onChange={handleNameChange}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Leave Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ML"
                    value={typeFormData.code}
                    onChange={(e) => setTypeFormData({ ...typeFormData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs font-bold uppercase rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Leave category policy guidelines for HR..."
                  value={typeFormData.description}
                  onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Badge Color</label>
                  <input
                    type="color"
                    value={typeFormData.color}
                    onChange={(e) => setTypeFormData({ ...typeFormData, color: e.target.value })}
                    className="h-9 w-full rounded-xl border border-border bg-background cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Display Order</label>
                  <input
                    type="number"
                    value={typeFormData.displayOrder}
                    onChange={(e) => setTypeFormData({ ...typeFormData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Annual Allowance (Days)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={typeFormData.annualDays}
                    onChange={(e) => setTypeFormData({ ...typeFormData, annualDays: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-border bg-background outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Monthly Credit (Days)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={typeFormData.monthlyCreditDays}
                    onChange={(e) => setTypeFormData({ ...typeFormData, monthlyCreditDays: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-border bg-background outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeFormData.isPaid}
                    onChange={(e) => setTypeFormData({ ...typeFormData, isPaid: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Paid Leave</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeFormData.allowCarryForward}
                    onChange={(e) => setTypeFormData({ ...typeFormData, allowCarryForward: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Carry Forward</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeFormData.allowHalfDay}
                    onChange={(e) => setTypeFormData({ ...typeFormData, allowHalfDay: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Allow Half Day</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={typeFormData.requireDoc}
                    onChange={(e) => setTypeFormData({ ...typeFormData, requireDoc: e.target.checked })}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>Require Documents</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setTypeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Leave Type
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ANNUAL RESET CONFIRM MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-left">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">Execute Annual Leave Reset?</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Applies carry-forward limits, expires old balances, and initializes new annual leave credits for all users.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRunAnnualReset}
                disabled={resetting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {resetting ? 'Executing Reset...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavePolicySettings;
