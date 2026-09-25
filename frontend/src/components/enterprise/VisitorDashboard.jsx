import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, UserCheck, CheckCircle2, Clock, XCircle, Search,
  Plus, Printer, Building2, User, AlertCircle, RefreshCw, X, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';

const VisitorDashboard = () => {
  const { selectedOrgId } = useCompanyScope();
  const [visitors, setVisitors] = useState([]);
  const [stats, setStats] = useState({ totalToday: 0, currentlyInside: 0, pendingApproval: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    email: '',
    phone: '',
    companyName: '',
    purpose: '',
    hostId: '',
    idProofType: 'Aadhaar',
    idProofNumber: '',
    autoApprove: true
  });

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const [vRes, sRes, uRes] = await Promise.all([
        api.get('/enterprise/visitors/history', {
          params: { status: statusFilter, search }
        }),
        api.get('/enterprise/visitors/stats'),
        api.get('/users?limit=100')
      ]);

      if (vRes.data?.success) setVisitors(vRes.data.history || []);
      if (sRes.data?.success) setStats(sRes.data.stats || {});
      if (uRes.data) setEmployees(uRes.data.users || uRes.data || []);
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, [selectedOrgId, statusFilter]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/enterprise/visitors/register', visitorForm);
      if (res.data?.success) {
        setRegisterModalOpen(false);
        setVisitorForm({
          visitorName: '',
          email: '',
          phone: '',
          companyName: '',
          purpose: '',
          hostId: '',
          idProofType: 'Aadhaar',
          idProofNumber: '',
          autoApprove: true
        });
        fetchVisitors();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register visitor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async (visitorId) => {
    try {
      await api.post('/enterprise/visitors/check-in', { visitorId });
      fetchVisitors();
    } catch (err) {
      alert(err.response?.data?.message || 'Check-in failed.');
    }
  };

  const handleCheckOut = async (visitorId) => {
    try {
      await api.post('/enterprise/visitors/check-out', { visitorId });
      fetchVisitors();
    } catch (err) {
      alert(err.response?.data?.message || 'Check-out failed.');
    }
  };

  const openPassModal = async (visitorId) => {
    try {
      const res = await api.get(`/enterprise/visitors/${visitorId}/pass`);
      if (res.data?.success) {
        setSelectedPass(res.data.pass);
        setBadgeModalOpen(true);
      }
    } catch (err) {
      alert('Failed to generate pass view.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <QrCode className="w-7 h-7 text-emerald-500" />
            Smart Visitor Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Contactless QR check-in, dynamic visitor badges, and host arrival approvals.
          </p>
        </div>
        <button
          onClick={() => setRegisterModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Pre-Register Visitor
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Visits Today</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.totalToday || 0}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Currently On Premises</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.currentlyInside || 0}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending Host Approvals</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.pendingApproval || 0}</h4>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search visitor, host, company, or QR code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchVisitors()}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Visit Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved / Expected</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="CHECKED_OUT">Checked Out</option>
          </select>
          <button onClick={fetchVisitors} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Visitors Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3.5">Visitor &amp; Organization</th>
                <th className="px-5 py-3.5">Purpose &amp; Host</th>
                <th className="px-5 py-3.5">Badge &amp; QR</th>
                <th className="px-5 py-3.5">Check-In / Out</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading visitors...</td></tr>
              ) : visitors.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No visitor records found.</td></tr>
              ) : (
                visitors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{v.visitorName}</p>
                      <p className="text-[11px] text-slate-400">{v.companyName || 'Guest'} &bull; {v.phone || '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{v.purpose}</p>
                      <p className="text-[11px] text-slate-400">Host: {v.host?.name || 'Unassigned'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                        {v.badgeNumber || v.qrCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-500">
                      <p>In: {v.checkIn ? new Date(v.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                      <p>Out: {v.checkOut ? new Date(v.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          v.status === 'CHECKED_IN'
                            ? 'bg-blue-100 text-blue-700'
                            : v.status === 'CHECKED_OUT'
                            ? 'bg-slate-100 text-slate-600'
                            : v.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => openPassModal(v.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                        title="Print / View Badge"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {v.status === 'APPROVED' && (
                        <button
                          onClick={() => handleCheckIn(v.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px]"
                        >
                          Check In
                        </button>
                      )}

                      {v.status === 'CHECKED_IN' && (
                        <button
                          onClick={() => handleCheckOut(v.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-medium text-[11px]"
                        >
                          Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pre-Register Modal */}
      <AnimatePresence>
        {registerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Pre-Register Visitor</h3>
                <button onClick={() => setRegisterModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <form onSubmit={handleRegister} className="space-y-3 mt-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Visitor Full Name *</label>
                    <input type="text" required placeholder="e.g. Ramesh Chandra" value={visitorForm.visitorName} onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Company / Organization</label>
                    <input type="text" placeholder="e.g. TechCorp Solutions" value={visitorForm.companyName} onChange={(e) => setVisitorForm({ ...visitorForm, companyName: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Email</label>
                    <input type="email" placeholder="ramesh@techcorp.com" value={visitorForm.email} onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Mobile Phone</label>
                    <input type="text" placeholder="+91 98765 43210" value={visitorForm.phone} onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Host Employee *</label>
                  <select required value={visitorForm.hostId} onChange={(e) => setVisitorForm({ ...visitorForm, hostId: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800">
                    <option value="">-- Select Host Employee --</option>
                    {employees.map((u) => (<option key={u.id} value={u.id}>{u.name} ({u.department})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Visit Purpose *</label>
                  <input type="text" required placeholder="e.g. Business Proposal & Architecture Review" value={visitorForm.purpose} onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })} className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800" />
                </div>
                <div className="pt-3 flex justify-end gap-2 border-t">
                  <button type="button" onClick={() => setRegisterModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">Issue QR Pass</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Badge Pass Modal */}
      <AnimatePresence>
        {badgeModalOpen && selectedPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border p-6 shadow-2xl text-center">
              <div className="border-b pb-3 mb-4">
                <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">INNOVEITY SMART VISITOR PASS</span>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mt-1">{selectedPass.visitorName}</h3>
                <p className="text-xs text-slate-400">{selectedPass.companyName || 'Guest'}</p>
              </div>

              {/* QR Simulator Box */}
              <div className="w-44 h-44 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-emerald-500/40 p-4 flex flex-col items-center justify-center">
                <QrCode className="w-24 h-24 text-slate-800 dark:text-slate-200 mb-2" />
                <span className="text-[10px] font-mono text-slate-500">{selectedPass.qrCode}</span>
              </div>

              <div className="my-4 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p><span className="text-slate-400">Host:</span> <span className="font-semibold">{selectedPass.host?.name}</span></p>
                <p><span className="text-slate-400">Badge ID:</span> <span className="font-mono font-bold text-emerald-600">{selectedPass.badgeNumber}</span></p>
                <p><span className="text-slate-400">Purpose:</span> {selectedPass.purpose}</p>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" /> Print Badge Pass
                </button>
                <button onClick={() => setBadgeModalOpen(false)} className="px-4 py-2 rounded-xl border text-xs">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisitorDashboard;
