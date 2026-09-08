import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Settings, Save, ShieldCheck } from 'lucide-react';
import CompanyScopeSelector from '../../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../../context/CompanyScopeContext';

import { useAuth } from '../../context/AuthContext';

export default function PayrollSettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Loaded database settings for selected company
  const [savedSettings, setSavedSettings] = useState(null);

  // Form input state (empty string by default so placeholders show)
  const [formData, setFormData] = useState({
    cycleStartDay: '',
    payDay: '',
    currency: '',
    overtimeHourlyRate: '',
    holidayPayMultiplier: '',
    weekendPayMultiplier: '',
    lateDeductionRule: 'FLAT_RATE',
    lateDeductionRate: '',
    minimumWorkingHours: '',
    payslipTemplate: 'STANDARD',
    companyName: '',
    companyAddress: '',
    authorizedSignature: ''
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const res = await api.get('/payroll/settings', { params });
      if (res.data) {
        setSavedSettings(res.data);
        setFormData(prev => ({
          ...prev,
          lateDeductionRule: res.data.lateDeductionRule || 'FLAT_RATE',
          payslipTemplate: res.data.payslipTemplate || 'STANDARD'
        }));
      }
    } catch (err) {
      console.error('Failed to load payroll settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setSavedSettings(null);
    setFormData({
      cycleStartDay: '',
      payDay: '',
      currency: '',
      overtimeHourlyRate: '',
      holidayPayMultiplier: '',
      weekendPayMultiplier: '',
      lateDeductionRule: 'FLAT_RATE',
      lateDeductionRate: '',
      minimumWorkingHours: '',
      payslipTemplate: 'STANDARD',
      companyName: '',
      companyAddress: '',
      authorizedSignature: ''
    });
    if (orgsLoading) return;
    fetchSettings();
  }, [user, targetOrg, user?.organizationId, orgsLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);

      const targetOrg = selectedOrgIdRef.current || selectedOrgId;

      // Merge user inputs with saved database values (preserves saved settings if input is empty)
      const payload = {
        organizationId: targetOrg,
        cycleStartDay: formData.cycleStartDay !== '' ? Number(formData.cycleStartDay) : Number(savedSettings?.cycleStartDay || 1),
        payDay: formData.payDay !== '' ? Number(formData.payDay) : Number(savedSettings?.payDay || 30),
        currency: formData.currency !== '' ? formData.currency.trim() : (savedSettings?.currency || 'INR'),
        overtimeHourlyRate: formData.overtimeHourlyRate !== '' ? Number(formData.overtimeHourlyRate) : Number(savedSettings?.overtimeHourlyRate || 150),
        holidayPayMultiplier: formData.holidayPayMultiplier !== '' ? Number(formData.holidayPayMultiplier) : Number(savedSettings?.holidayPayMultiplier || 2.0),
        weekendPayMultiplier: formData.weekendPayMultiplier !== '' ? Number(formData.weekendPayMultiplier) : Number(savedSettings?.weekendPayMultiplier || 1.5),
        lateDeductionRule: formData.lateDeductionRule || savedSettings?.lateDeductionRule || 'FLAT_RATE',
        lateDeductionRate: formData.lateDeductionRate !== '' ? Number(formData.lateDeductionRate) : Number(savedSettings?.lateDeductionRate || 100),
        halfDayDeductionRate: savedSettings?.halfDayDeductionRate || 0.5,
        minimumWorkingHours: formData.minimumWorkingHours !== '' ? Number(formData.minimumWorkingHours) : Number(savedSettings?.minimumWorkingHours || 8.0),
        roundingRule: savedSettings?.roundingRule || 'ROUND_HALF_UP',
        payslipTemplate: formData.payslipTemplate || savedSettings?.payslipTemplate || 'STANDARD',
        companyName: formData.companyName !== '' ? formData.companyName.trim() : (savedSettings?.companyName || selectedCompany?.name || 'Company Workspace'),
        companyAddress: formData.companyAddress !== '' ? formData.companyAddress.trim() : (savedSettings?.companyAddress || selectedCompany?.address || 'Corporate Headquarters'),
        authorizedSignature: formData.authorizedSignature !== '' ? formData.authorizedSignature.trim() : (savedSettings?.authorizedSignature || 'HR Manager')
      };

      const res = await api.put('/payroll/settings', payload);
      setSavedSettings(res.data);
      
      // Reset form input values back to empty strings so placeholders continue displaying updated values
      setFormData({
        cycleStartDay: '',
        payDay: '',
        currency: '',
        overtimeHourlyRate: '',
        holidayPayMultiplier: '',
        weekendPayMultiplier: '',
        lateDeductionRule: res.data.lateDeductionRule || 'FLAT_RATE',
        lateDeductionRate: '',
        minimumWorkingHours: '',
        payslipTemplate: res.data.payslipTemplate || 'STANDARD',
        companyName: '',
        companyAddress: '',
        authorizedSignature: ''
      });

      alert(`Payroll Settings for ${selectedCompany?.name || 'Selected Company'} saved successfully!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save payroll settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-5xl mx-auto">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Company Payroll Configurations ({selectedCompany?.name || 'Selected Scope'})
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set salary cycle dates, deduction rules, overtime rates, and company payslip headers for {selectedCompany?.name || 'this organization'}.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading payroll settings for {selectedCompany?.name || 'company'}...</p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6 text-xs">
          <div className="pt-2 font-bold text-foreground text-sm border-b border-border pb-2">Salary Cycle & Timing</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Cycle Start Day (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.cycleStartDay}
                onChange={e => setFormData({ ...formData, cycleStartDay: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.cycleStartDay ? `Eg. ${savedSettings.cycleStartDay}` : "Eg. 1"}
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Pay Date (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.payDay}
                onChange={e => setFormData({ ...formData, payDay: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.payDay ? `Eg. ${savedSettings.payDay}` : "Eg. 30"}
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Currency Code</label>
              <input
                type="text"
                value={formData.currency}
                onChange={e => setFormData({ ...formData, currency: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.currency ? `Eg. ${savedSettings.currency}` : "Eg. INR"}
              />
            </div>
          </div>

          <div className="pt-2 font-bold text-foreground text-sm border-b border-border pb-2">Overtime & Holiday Rules</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Overtime Hourly Rate (₹)</label>
              <input
                type="number"
                step="0.01"
                value={formData.overtimeHourlyRate}
                onChange={e => setFormData({ ...formData, overtimeHourlyRate: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.overtimeHourlyRate ? `Eg. ${savedSettings.overtimeHourlyRate}` : "Eg. 150"}
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Holiday Pay Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={formData.holidayPayMultiplier}
                onChange={e => setFormData({ ...formData, holidayPayMultiplier: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.holidayPayMultiplier ? `Eg. ${savedSettings.holidayPayMultiplier}` : "Eg. 2.0"}
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Weekend Pay Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={formData.weekendPayMultiplier}
                onChange={e => setFormData({ ...formData, weekendPayMultiplier: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.weekendPayMultiplier ? `Eg. ${savedSettings.weekendPayMultiplier}` : "Eg. 1.5"}
              />
            </div>
          </div>

          <div className="pt-2 font-bold text-foreground text-sm border-b border-border pb-2">Deductions & Working Hours</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Late Deduction Rule</label>
              <select
                value={formData.lateDeductionRule}
                onChange={e => setFormData({ ...formData, lateDeductionRule: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground font-semibold"
              >
                <option value="FLAT_RATE">Flat Rate Deduction (₹)</option>
                <option value="PERCENTAGE">Percentage Deduction (%)</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Late Deduction Rate</label>
              <input
                type="number"
                step="0.01"
                value={formData.lateDeductionRate}
                onChange={e => setFormData({ ...formData, lateDeductionRate: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.lateDeductionRate ? `Eg. ${savedSettings.lateDeductionRate}` : "Eg. 100"}
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Minimum Working Hours</label>
              <input
                type="number"
                step="0.5"
                value={formData.minimumWorkingHours}
                onChange={e => setFormData({ ...formData, minimumWorkingHours: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.minimumWorkingHours ? `Eg. ${savedSettings.minimumWorkingHours}` : "Eg. 8"}
              />
            </div>
          </div>

          <div className="pt-2 font-bold text-foreground text-sm border-b border-border pb-2">Company Branding & Payslip Customization</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Company Display Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.companyName ? `Eg. ${savedSettings.companyName}` : "Eg. Innoveity Workspace"}
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">Authorized HR Signatory</label>
              <input
                type="text"
                value={formData.authorizedSignature}
                onChange={e => setFormData({ ...formData, authorizedSignature: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.authorizedSignature ? `Eg. ${savedSettings.authorizedSignature}` : "Eg. HR Manager"}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-muted-foreground block mb-1">Company Address (Appears on Payslips)</label>
              <textarea
                rows="2"
                value={formData.companyAddress}
                onChange={e => setFormData({ ...formData, companyAddress: e.target.value })}
                className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground placeholder:text-muted-foreground/60"
                placeholder={savedSettings?.companyAddress ? `Eg. ${savedSettings.companyAddress}` : "Eg. Corporate Headquarters"}
              ></textarea>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 btn-primary rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving Settings...' : 'Save Company Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
