import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Calendar, Plus, Trash2, ShieldCheck, X } from 'lucide-react';
import CompanyScopeSelector from '../../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import { useAuth } from '../../context/AuthContext';

export default function HolidayCalendarPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: 'COMPANY',
    isWorkingHoliday: false,
    payMultiplier: 2.0,
    remarks: ''
  });

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const res = await api.get('/payroll/holidays', { params });
      setHolidays(res.data || []);
    } catch (err) {
      console.error('Failed to load holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setHolidays([]);
    if (orgsLoading) return;
    fetchHolidays();
  }, [user, targetOrg, user?.organizationId, orgsLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payroll/holidays', formData);
      setShowModal(false);
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add holiday.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday entry?')) return;
    try {
      await api.delete(`/payroll/holidays/${id}`);
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete holiday.');
    }
  };

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" /> Holiday Calendar & Pay Multipliers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure company & national holidays. Working on holidays automatically triggers pay multipliers (e.g. 2.0x).
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ title: '', date: '', type: 'COMPANY', isWorkingHoliday: false, payMultiplier: 2.0, remarks: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 btn-primary rounded-xl font-bold text-sm shadow-md transition-all"
        >
          <Plus className="w-4 h-4" /> Add Holiday Entry
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading holiday calendar...</p>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase">
                <tr>
                  <th className="p-4">Holiday Title</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Working Holiday</th>
                  <th className="p-4">Pay Multiplier</th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-muted-foreground font-semibold">
                      No holiday calendar entries found. Click "Add Holiday Entry" above to add company holidays.
                    </td>
                  </tr>
                ) : (
                  holidays.map(h => (
                    <tr key={h.id} className="hover:bg-muted/30">
                      <td className="p-4 font-bold text-foreground">{h.title}</td>
                      <td className="p-4 font-semibold text-foreground">
                        {new Date(h.date).toISOString().split('T')[0]}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          h.type === 'NATIONAL' ? 'bg-secondary/10 text-secondary' :
                          h.type === 'WEEKEND' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {h.type}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">
                        {h.isWorkingHoliday ? (
                          <span className="text-success font-semibold">Yes (Working Allowed)</span>
                        ) : (
                          <span className="text-muted-foreground">No (Office Closed)</span>
                        )}
                      </td>
                      <td className="p-4 font-extrabold text-primary text-sm">
                        {h.payMultiplier}x Daily Pay
                      </td>
                      <td className="p-4 text-muted-foreground">{h.remarks || '-'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-destructive transition-colors ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">Add Holiday Calendar Entry</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Holiday Title</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground" placeholder="e.g. Independence Day" />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Date</label>
                <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground" />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Holiday Type</label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground">
                  <option value="NATIONAL">NATIONAL</option>
                  <option value="COMPANY">COMPANY</option>
                  <option value="WEEKEND">WEEKEND</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Pay Multiplier (e.g. 2.0 = 2x Daily Pay)</label>
                <input type="number" step="0.1" value={formData.payMultiplier} onChange={e => setFormData({ ...formData, payMultiplier: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground" placeholder="e.g. 2.0" />
              </div>
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Remarks</label>
                <input type="text" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} className="w-full bg-muted/50 border border-border rounded-xl p-2.5 text-foreground" placeholder="e.g. Official company holiday celebration" />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-border">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-xl font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 btn-primary rounded-xl font-bold">Add Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
