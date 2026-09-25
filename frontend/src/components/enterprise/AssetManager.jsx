import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop, Smartphone, CreditCard, Headphones, Monitor, Plus, Search,
  Filter, CheckCircle2, AlertCircle, RefreshCw, X, ArrowUpRight, ArrowDownLeft, Building2, User
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';

const CATEGORY_ICONS = {
  LAPTOP: Laptop,
  DESKTOP: Monitor,
  PHONE: Smartphone,
  ID_CARD: CreditCard,
  ACCESSORIES: Headphones
};

const AssetManager = () => {
  const { selectedOrgId } = useCompanyScope();
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState({ total: 0, assigned: 0, available: 0, maintenance: 0, damaged: 0 });
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [targetAsset, setTargetAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Forms
  const [assetForm, setAssetForm] = useState({
    name: '',
    category: 'LAPTOP',
    brand: '',
    model: '',
    serialNumber: '',
    condition: 'EXCELLENT',
    branchId: '',
    cost: ''
  });

  const [assignForm, setAssignForm] = useState({
    userId: '',
    condition: 'EXCELLENT',
    remarks: ''
  });

  const [returnForm, setReturnForm] = useState({
    conditionOnReturn: 'Good',
    remarks: ''
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const [assetRes, statsRes, branchRes, userRes] = await Promise.all([
        api.get('/enterprise/assets', {
          params: {
            category: selectedCategory,
            branchId: selectedBranch,
            status: selectedStatus,
            search
          }
        }),
        api.get('/enterprise/assets/stats'),
        api.get('/enterprise/branches'),
        api.get('/users?limit=100')
      ]);

      if (assetRes.data?.success) setAssets(assetRes.data.assets || []);
      if (statsRes.data?.success) setStats(statsRes.data.stats || {});
      if (branchRes.data?.success) setBranches(branchRes.data.branches || []);
      if (userRes.data) setEmployees(userRes.data.users || userRes.data || []);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [selectedOrgId, selectedCategory, selectedBranch, selectedStatus]);

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/enterprise/assets', assetForm);
      if (res.data?.success) {
        setCreateModalOpen(false);
        setAssetForm({ name: '', category: 'LAPTOP', brand: '', model: '', serialNumber: '', condition: 'EXCELLENT', branchId: '', cost: '' });
        fetchAssets();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!targetAsset) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/enterprise/assets/${targetAsset.id}/assign`, assignForm);
      if (res.data?.success) {
        setAssignModalOpen(false);
        setTargetAsset(null);
        fetchAssets();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!targetAsset) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/enterprise/assets/${targetAsset.id}/return`, returnForm);
      if (res.data?.success) {
        setReturnModalOpen(false);
        setTargetAsset(null);
        fetchAssets();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to return asset.');
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
            <Laptop className="w-7 h-7 text-emerald-500" />
            Enterprise Asset Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track hardware inventory, branches, employee custody, and physical condition.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add New Asset
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Total Assets</p>
          <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.total || 0}</h4>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Assigned In-Use</p>
          <h4 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.assigned || 0}</h4>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Available in Stock</p>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.available || 0}</h4>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Maintenance / Repair</p>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{(stats.maintenance || 0) + (stats.damaged || 0)}</h4>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by asset ID, name, S/N..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchAssets()}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Categories</option>
            <option value="LAPTOP">Laptops</option>
            <option value="DESKTOP">Desktops</option>
            <option value="PHONE">Phones</option>
            <option value="ID_CARD">ID Cards</option>
            <option value="ACCESSORIES">Accessories</option>
          </select>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>

          <button onClick={fetchAssets} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading asset records...</div>
      ) : assets.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border text-center text-xs text-slate-400">
          No assets found matching current criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => {
            const IconComp = CATEGORY_ICONS[asset.category] || Laptop;
            return (
              <div
                key={asset.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{asset.name}</h4>
                        <span className="text-[11px] font-mono text-slate-400">{asset.assetId}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        asset.status === 'AVAILABLE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : asset.status === 'ASSIGNED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {asset.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mt-2">
                    <p><span className="text-slate-400">S/N:</span> {asset.serialNumber || 'N/A'}</p>
                    <p><span className="text-slate-400">Branch:</span> {asset.branch?.name || 'Headquarters'}</p>
                    <p><span className="text-slate-400">Condition:</span> <span className="font-semibold">{asset.condition || 'EXCELLENT'}</span></p>
                    {asset.assignedTo && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 mt-2">
                        <p className="text-slate-400 text-[10px] font-semibold uppercase">Assigned Custody</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{asset.assignedTo.name}</p>
                        <p className="text-[11px] text-slate-400">{asset.assignedTo.department}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  {asset.status === 'AVAILABLE' ? (
                    <button
                      onClick={() => {
                        setTargetAsset(asset);
                        setAssignModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Assign to Employee
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setTargetAsset(asset);
                        setReturnModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Mark Returned
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Asset Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Add New Company Asset</h3>
                <button onClick={() => setCreateModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <form onSubmit={handleCreateAsset} className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Asset Name *</label>
                  <input type="text" required placeholder="e.g. MacBook Pro 16 M3" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Category *</label>
                    <select value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800">
                      <option value="LAPTOP">Laptop</option>
                      <option value="DESKTOP">Desktop</option>
                      <option value="PHONE">Phone</option>
                      <option value="ID_CARD">ID Card</option>
                      <option value="ACCESSORIES">Accessories</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Condition</label>
                    <select value={assetForm.condition} onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800">
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="DAMAGED">Damaged</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Serial Number</label>
                    <input type="text" placeholder="e.g. C02G..." value={assetForm.serialNumber} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Branch</label>
                    <select value={assetForm.branchId} onChange={(e) => setAssetForm({ ...assetForm, branchId: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800">
                      <option value="">Default Branch</option>
                      {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                  </div>
                </div>
                <div className="pt-3 flex justify-end gap-2 border-t">
                  <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">Save Asset</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assign Modal */}
      <AnimatePresence>
        {assignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Assign Asset: {targetAsset?.name}</h3>
                <button onClick={() => setAssignModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <form onSubmit={handleAssign} className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Select Employee *</label>
                  <select required value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800">
                    <option value="">-- Choose Employee --</option>
                    {employees.map((u) => (<option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Assignment Remarks</label>
                  <input type="text" placeholder="e.g. Issued for client project" value={assignForm.remarks} onChange={(e) => setAssignForm({ ...assignForm, remarks: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="pt-3 flex justify-end gap-2 border-t">
                  <button type="button" onClick={() => setAssignModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium">Confirm Assignment</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {returnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Process Asset Return: {targetAsset?.name}</h3>
                <button onClick={() => setReturnModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <form onSubmit={handleReturn} className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Condition on Return</label>
                  <select value={returnForm.conditionOnReturn} onChange={(e) => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800">
                    <option value="Good">Good / Functional</option>
                    <option value="Minor Scratches">Minor Cosmetic Wear</option>
                    <option value="Damaged">Damaged / Needs Repair</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Return Remarks</label>
                  <input type="text" placeholder="e.g. Returned after project completion" value={returnForm.remarks} onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="pt-3 flex justify-end gap-2 border-t">
                  <button type="button" onClick={() => setReturnModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-medium">Mark Returned to Stock</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssetManager;
