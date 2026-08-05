import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserCheck, Plus, Search, Edit3, Trash2, ShieldCheck, Key,
  X, CheckCircle2, AlertCircle, RefreshCw, Lock, UserX
} from 'lucide-react';
import api from '../../../services/api';
import UserAvatar from '../../../components/common/UserAvatar';

const AdminManagement = () => {
  const [searchParams] = useSearchParams();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Form Fields for Create / Edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    department: 'Administration',
    designation: 'System Administrator',
    status: 'ACTIVE'
  });

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await api.get('/super-admin/admins');
      setAdmins(res.data || []);
    } catch (err) {
      console.error('Failed to fetch admin list:', err);
      showToast('error', 'Failed to retrieve admin accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    if (searchParams.get('action') === 'new') {
      handleOpenCreateModal();
    }
  }, [searchParams]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 3500);
  };

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: 'AdminPassword@123',
      department: 'Administration',
      designation: 'System Administrator',
      status: 'ACTIVE'
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (admin) => {
    setSelectedAdmin(admin);
    setFormData({
      name: admin.name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      password: '',
      department: admin.department || 'Administration',
      designation: admin.designation || 'System Administrator',
      status: admin.status || 'ACTIVE'
    });
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (admin) => {
    setSelectedAdmin(admin);
    setShowDeleteModal(true);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      showToast('error', 'Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/super-admin/admins', formData);
      showToast('success', `Admin account created successfully for ${res.data.name} (${res.data.employeeId})!`);
      setShowCreateModal(false);
      fetchAdmins();
    } catch (err) {
      console.error('Failed to create admin:', err);
      showToast('error', err.response?.data?.message || 'Failed to create admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.put(`/super-admin/admins/${selectedAdmin.id}`, formData);
      showToast('success', `Updated Admin account for ${formData.name}.`);
      setShowEditModal(false);
      fetchAdmins();
    } catch (err) {
      console.error('Failed to update admin:', err);
      showToast('error', err.response?.data?.message || 'Failed to update admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    try {
      setSubmitting(true);
      await api.delete(`/super-admin/admins/${selectedAdmin.id}`);
      showToast('success', `Admin account for ${selectedAdmin.name} deleted.`);
      setShowDeleteModal(false);
      fetchAdmins();
    } catch (err) {
      console.error('Failed to delete admin:', err);
      showToast('error', err.response?.data?.message || 'Failed to delete admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (admin) => {
    const nextStatus = admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/super-admin/admins/${admin.id}`, { status: nextStatus });
      showToast('success', `Admin ${admin.name} status set to ${nextStatus}.`);
      fetchAdmins();
    } catch (err) {
      console.error('Failed to toggle admin status:', err);
      showToast('error', 'Failed to update admin status.');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary border border-primary/20 mb-2">
            <UserCheck className="h-3.5 w-3.5" />
            <span>Administrator Management Module</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Admin Accounts Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Provision, update, disable, delete, and manage system Administrator accounts. All actions log audit entries.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-all shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Provision New Admin</span>
        </button>
      </div>

      {toast.text && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Admin Users Table */}
      <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-border/40 bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm border-collapse text-left">
          <thead>
            <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20 whitespace-nowrap">
              <th className="px-6 py-4 whitespace-nowrap">Admin Profile</th>
              <th className="px-6 py-4 whitespace-nowrap">Department & Designation</th>
              <th className="px-6 py-4 whitespace-nowrap">Status</th>
              <th className="px-6 py-4 whitespace-nowrap">Created Date</th>
              <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 text-xs">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading admin accounts...</span>
                  </div>
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  No Administrator accounts found. Click "Provision New Admin" to add one.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-muted/10 transition-all whitespace-nowrap">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={admin} className="h-9 w-9 shrink-0" />
                      <div>
                        <p className="font-bold text-foreground text-xs">{admin.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{admin.email} • {admin.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-semibold text-foreground">{admin.department || 'Administration'}</p>
                    <p className="text-[10px] text-muted-foreground">{admin.designation || 'System Administrator'}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${admin.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-rose-500/10 text-rose-600'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${admin.status === 'ACTIVE' ? 'bg-primary' : 'bg-rose-500'}`} />
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(admin)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        title="Edit Admin Account"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(admin)}
                        className={`p-1.5 rounded-lg transition-all ${admin.status === 'ACTIVE' ? 'text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10' : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'}`}
                        title={admin.status === 'ACTIVE' ? 'Disable Admin' : 'Activate Admin'}
                      >
                        {admin.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>

                      <button
                        onClick={() => handleOpenDeleteModal(admin)}
                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Admin Account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form onSubmit={handleCreateAdmin} className="w-full max-w-lg rounded-2xl border border-border/40 bg-card p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h3 className="text-base font-bold text-foreground">Provision New Admin Account</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground block">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alexander Pierce"
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@company.com"
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground block">
                  Initial Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter initial password"
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border/30 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover transition-all"
              >
                {submitting ? 'Creating...' : 'Provision Admin Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEditModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form onSubmit={handleUpdateAdmin} className="w-full max-w-lg rounded-2xl border border-border/40 bg-card p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h3 className="text-base font-bold text-foreground">Edit Admin ({selectedAdmin.employeeId})</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-foreground block">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border/30 pt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover transition-all"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      {showDeleteModal && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl space-y-4 text-left">
            <h3 className="text-base font-bold text-foreground">Confirm Delete Admin</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete Admin account <strong>{selectedAdmin.name}</strong> ({selectedAdmin.employeeId})? This action will generate an Audit Log.
            </p>

            <div className="flex justify-end gap-3 border-t border-border/30 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAdmin}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 transition-all"
              >
                {submitting ? 'Deleting...' : 'Delete Admin Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
