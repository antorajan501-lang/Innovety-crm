import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Plus, Edit2, Trash2, CheckCircle2, ShieldCheck, Layers, X, DollarSign, AlertCircle } from 'lucide-react';
import CompanyScopeSelector from '../../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../../context/CompanyScopeContext';

import { useAuth } from '../../context/AuthContext';

export default function SalaryTemplatesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetRole: 'EMPLOYEE',
    basicSalary: 25000,
    hra: 10000,
    da: 5000,
    specialAllowance: 5000,
    travelAllowance: 3000,
    medicalAllowance: 2000,
    otherAllowances: 0,
    bonus: 0,
    pfRatePercent: 12.0,
    esiRatePercent: 0.75,
    profTax: 200,
    incomeTaxPercent: 5.0,
    otherDeductions: 0
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const res = await api.get('/payroll/templates', { params });
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load salary templates:', err);
      setErrorMessage('Failed to load salary templates.');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setTemplates([]);
    if (orgsLoading) return;
    fetchTemplates();
  }, [user, targetOrg, user?.organizationId, orgsLoading]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      targetRole: 'EMPLOYEE',
      basicSalary: 25000,
      hra: 10000,
      da: 5000,
      specialAllowance: 5000,
      travelAllowance: 3000,
      medicalAllowance: 2000,
      otherAllowances: 0,
      bonus: 0,
      pfRatePercent: 12.0,
      esiRatePercent: 0.75,
      profTax: 200,
      incomeTaxPercent: 5.0,
      otherDeductions: 0
    });
    setShowModal(true);
  };

  const handleOpenEdit = (t) => {
    setEditingId(t.id);
    setFormData({
      name: t.name,
      description: t.description || '',
      targetRole: t.targetRole || 'EMPLOYEE',
      basicSalary: t.basicSalary,
      hra: t.hra,
      da: t.da,
      specialAllowance: t.specialAllowance,
      travelAllowance: t.travelAllowance,
      medicalAllowance: t.medicalAllowance,
      otherAllowances: t.otherAllowances,
      bonus: t.bonus,
      pfRatePercent: t.pfRatePercent,
      esiRatePercent: t.esiRatePercent,
      profTax: t.profTax,
      incomeTaxPercent: t.incomeTaxPercent,
      otherDeductions: t.otherDeductions
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const targetOrg = selectedOrgIdRef.current || selectedOrgId;
      const payload = {
        ...formData,
        organizationId: targetOrg
      };
      const params = targetOrg ? { organizationId: targetOrg } : {};
      if (editingId) {
        await api.put(`/payroll/templates/${editingId}`, payload, { params });
      } else {
        await api.post('/payroll/templates', payload, { params });
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save salary template.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete salary template "${name || 'this template'}"? This action cannot be undone.`)) return;
    try {
      const targetOrg = selectedOrgIdRef.current || selectedOrgId;
      const params = targetOrg ? { organizationId: targetOrg } : {};
      await api.delete(`/payroll/templates/${id}`, { params });
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete template.');
    }
  };

  const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" /> Salary Structure Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure standardized salary components by role for quick assignment across <strong className="text-primary">{selectedCompany?.name || 'the selected company'}</strong>.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2 btn-primary rounded-xl font-bold text-sm transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={fetchTemplates} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-300 rounded-lg text-xs font-bold transition-colors">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading templates...</p>
      ) : templates.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground space-y-3">
          <Layers className="w-8 h-8 mx-auto opacity-50 text-primary" />
          <p className="font-bold text-foreground">No salary templates found for {selectedCompany?.name || 'this company'}.</p>
          <p className="text-xs">Click "Create Template" above to add a new salary structure template for {selectedCompany?.name || 'this company'}.</p>
          <button onClick={handleOpenCreate} className="mt-2 inline-flex items-center gap-2 px-4 py-2 btn-primary rounded-xl font-bold text-xs">
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => {
            const gross = t.basicSalary + t.hra + t.da + t.specialAllowance + t.travelAllowance + t.medicalAllowance + t.otherAllowances + t.bonus;
            const pf = (t.basicSalary * t.pfRatePercent) / 100;
            const esi = (gross * t.esiRatePercent) / 100;
            const tax = (gross * t.incomeTaxPercent) / 100;
            const totalDeductions = pf + esi + t.profTax + tax + t.otherDeductions;
            const net = Math.max(0, gross - totalDeductions);

            return (
              <div key={t.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase">
                        {t.targetRole}
                      </span>
                      <h3 className="text-lg font-extrabold text-foreground mt-2">{t.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description || 'Standard role compensation'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenEdit(t)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Basic Salary:</span><span className="font-semibold text-foreground">{formatINR(t.basicSalary)}</span></div>
                    <div className="flex justify-between"><span>HRA + DA:</span><span className="font-semibold text-foreground">{formatINR(t.hra + t.da)}</span></div>
                    <div className="flex justify-between"><span>Allowances & Bonus:</span><span className="font-semibold text-foreground">{formatINR(t.specialAllowance + t.travelAllowance + t.medicalAllowance + t.bonus)}</span></div>
                    <div className="flex justify-between"><span>PF ({t.pfRatePercent}%) + Tax ({t.incomeTaxPercent}%):</span><span className="font-semibold text-foreground">{formatINR(pf + tax + t.profTax)}</span></div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Estimated Net Pay</span>
                    <p className="text-lg font-black text-primary">{formatINR(net)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{t._count?.structures || 0} user(s) assigned</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">{editingId ? 'Edit Salary Template' : 'Create Salary Template'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Template Name</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground" placeholder="e.g. Senior Developer Template" />
                </div>
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Target Role</label>
                  <select value={formData.targetRole} onChange={e => setFormData({ ...formData, targetRole: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground">
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="TEAM_LEADER">TEAM_LEADER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="INTERN">INTERN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground" placeholder="e.g. Standard employee role compensation package" />
              </div>

              <div className="pt-2 font-bold text-foreground border-b border-border pb-1">Earnings Components</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="text-muted-foreground block mb-1">Basic Salary (₹)</label><input type="number" value={formData.basicSalary} onChange={e => setFormData({ ...formData, basicSalary: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 25000" /></div>
                <div><label className="text-muted-foreground block mb-1">HRA (₹)</label><input type="number" value={formData.hra} onChange={e => setFormData({ ...formData, hra: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 10000" /></div>
                <div><label className="text-muted-foreground block mb-1">DA (₹)</label><input type="number" value={formData.da} onChange={e => setFormData({ ...formData, da: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 5000" /></div>
                <div><label className="text-muted-foreground block mb-1">Special Allowance</label><input type="number" value={formData.specialAllowance} onChange={e => setFormData({ ...formData, specialAllowance: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 5000" /></div>
                <div><label className="text-muted-foreground block mb-1">Travel Allowance</label><input type="number" value={formData.travelAllowance} onChange={e => setFormData({ ...formData, travelAllowance: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 3000" /></div>
                <div><label className="text-muted-foreground block mb-1">Medical Allowance</label><input type="number" value={formData.medicalAllowance} onChange={e => setFormData({ ...formData, medicalAllowance: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 2000" /></div>
              </div>

              <div className="pt-2 font-bold text-foreground border-b border-border pb-1">Deductions & Statutory Rates</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="text-muted-foreground block mb-1">PF Rate (%)</label><input type="number" step="0.1" value={formData.pfRatePercent} onChange={e => setFormData({ ...formData, pfRatePercent: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 12.0" /></div>
                <div><label className="text-muted-foreground block mb-1">ESI Rate (%)</label><input type="number" step="0.01" value={formData.esiRatePercent} onChange={e => setFormData({ ...formData, esiRatePercent: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 0.75" /></div>
                <div><label className="text-muted-foreground block mb-1">Prof Tax (₹)</label><input type="number" value={formData.profTax} onChange={e => setFormData({ ...formData, profTax: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 200" /></div>
                <div><label className="text-muted-foreground block mb-1">Income Tax Rate (%)</label><input type="number" step="0.1" value={formData.incomeTaxPercent} onChange={e => setFormData({ ...formData, incomeTaxPercent: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2 text-foreground" placeholder="e.g. 5.0" /></div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-xl font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 btn-primary rounded-xl font-bold">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
