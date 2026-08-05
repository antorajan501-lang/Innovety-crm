import React, { useState, useEffect } from 'react';
import {
  Users, Search, RefreshCw, Eye, Lock, Unlock, Key, UserX,
  CheckCircle2, AlertCircle, X, UserCheck
} from 'lucide-react';
import api from '../../../services/api';
import UserAvatar from '../../../components/common/UserAvatar';

const UsersDirectory = () => {
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [roleCounts, setRoleCounts] = useState({
    ALL: 0, SUPER_ADMIN: 0, ADMIN: 0, TEAM_LEADER: 0, EMPLOYEE: 0, INTERN: 0
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Selected User
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [modalTab, setModalTab] = useState('profile'); // 'profile' or 'audit'

  // Reset Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passSubmitting, setPassSubmitting] = useState(false);

  // Checkbox selection state
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());

  // Toast / Alert Message
  const [toast, setToast] = useState({ type: '', text: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 15,
        search,
        role: roleFilter,
        status: statusFilter
      });

      const res = await api.get(`/super-admin/users?${params.toString()}`);
      setUsers(res.data.users || []);
      setTotalCount(res.data.totalCount || 0);
      if (res.data.roleCounts) {
        setRoleCounts(res.data.roleCounts);
      }
    } catch (err) {
      console.error('Failed to fetch users directory:', err);
      showToast('error', 'Failed to retrieve users directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 3500);
  };

  const handleOpenDetails = async (u) => {
    setSelectedUser(u);
    setModalTab('profile');
    setShowDetailsModal(true);

    try {
      setAuditLoading(true);
      const res = await api.get(`/super-admin/users/${u.id}/audit-history`);
      setAuditLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load user audit history:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleToggleStatus = async (u) => {
    const targetStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/super-admin/users/${u.id}/status`, { status: targetStatus });
      showToast('success', `User ${u.name} status updated to ${targetStatus}.`);
      fetchUsers();
      if (selectedUser?.id === u.id) {
        setSelectedUser(prev => ({ ...prev, status: targetStatus }));
      }
    } catch (err) {
      console.error('Failed to update user status:', err);
      showToast('error', 'Failed to update user status.');
    }
  };

  const handleUnlockAccount = async (u) => {
    try {
      await api.put(`/super-admin/users/${u.id}/unlock`);
      showToast('success', `Unlocked account for ${u.name}.`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to unlock account:', err);
      showToast('error', 'Failed to unlock user account.');
    }
  };

  const handleOpenPasswordReset = (u) => {
    setSelectedUser(u);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleExecutePasswordReset = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('error', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      setPassSubmitting(true);
      await api.put(`/super-admin/users/${selectedUser.id}/reset-password`, { newPassword });
      showToast('success', `Password reset successfully for ${selectedUser.name}.`);
      setShowPasswordModal(false);
    } catch (err) {
      console.error('Failed to reset password:', err);
      showToast('error', err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setPassSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

  const toggleSelectUser = (id) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300';
      case 'ADMIN':
        return 'bg-primary/10 text-primary';
      case 'TEAM_LEADER':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300';
      case 'EMPLOYEE':
        return 'bg-primary/10 text-primary';
      case 'INTERN':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-3.5 text-left">
      {/* 1. Header Card (Matching Screenshot Design) */}
      <div className="rounded-[24px] border border-border/40 bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Users Management</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Comprehensive directory of all system accounts, roles, access levels & user settings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Users (name, email, ID)..."
              className="w-full rounded-full border border-border/60 bg-muted/30 pl-10 pr-4 py-2 text-xs font-medium text-foreground focus:outline-none focus:bg-background focus:ring-2 focus:ring-primary/30"
            />
          </form>
        </div>
      </div>

      {toast.text && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* 2. Role Filter Pill Tabs Bar & Status Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-0.5">
        {/* Role Filter Card Pills */}
        <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Users', key: 'ALL' },
            { id: 'SUPER_ADMIN', label: 'Super Admins', key: 'SUPER_ADMIN' },
            { id: 'ADMIN', label: 'Admins', key: 'ADMIN' },
            { id: 'TEAM_LEADER', label: 'Team Leaders', key: 'TEAM_LEADER' },
            { id: 'EMPLOYEE', label: 'Employees', key: 'EMPLOYEE' },
            { id: 'INTERN', label: 'Interns', key: 'INTERN' },
          ].map((tab) => {
            const isActive = roleFilter === tab.id;
            const count = roleCounts[tab.key] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => { setRoleFilter(tab.id); setPage(1); }}
                className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-[#f1f5f9] dark:bg-slate-800 text-[#2d3748] dark:text-slate-200 hover:bg-[#e2e8f0] dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black min-w-[20px] text-center ${
                  isActive
                    ? 'bg-primary-hover text-white'
                    : 'bg-[#dce4ec] dark:bg-slate-700 text-[#4a5568] dark:text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Dropdown */}
        <div className="shrink-0 ml-auto md:ml-0">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-[#2d3748] dark:text-slate-200 focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* 3. Table Card Container */}
      <div className="w-full min-w-0 overflow-x-auto rounded-[24px] border border-border/40 bg-card p-2 sm:p-4 shadow-sm">
        <table className="w-full min-w-[950px] text-sm border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-extrabold text-muted-foreground/70 uppercase border-b border-border/30 bg-muted/10 whitespace-nowrap">
              <th className="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedUserIds.size === users.length}
                  onChange={toggleSelectAll}
                  className="rounded border-border accent-primary cursor-pointer"
                />
              </th>
              <th className="px-4 py-3.5 whitespace-nowrap">USER</th>
              <th className="px-4 py-3.5 whitespace-nowrap">EMPLOYEE ID</th>
              <th className="px-4 py-3.5 whitespace-nowrap">ROLE</th>
              <th className="px-4 py-3.5 whitespace-nowrap">DEPARTMENT / COLLEGE</th>
              <th className="px-4 py-3.5 whitespace-nowrap">STATUS</th>
              <th className="px-4 py-3.5 text-right whitespace-nowrap">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20 text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading users directory...</span>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  No users found matching search criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/10 transition-all whitespace-nowrap">
                  <td className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleSelectUser(u.id)}
                      className="rounded border-border accent-emerald-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={u} className="h-10 w-10 shrink-0" />
                      <div>
                        <p className="font-bold text-foreground text-xs">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-muted-foreground text-xs whitespace-nowrap">
                    {u.employeeId}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${getRoleBadge(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <p className="font-semibold text-foreground text-xs">
                      {u.department || u.college || 'Platform Administration'}
                    </p>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      u.status === 'ACTIVE'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    }`}>
                      {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenDetails(u)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        title="View Full Profile & Audit History"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleOpenPasswordReset(u)}
                        className="p-1.5 text-amber-600/80 hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-all"
                        title="Reset User Password"
                      >
                        <Key className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(u)}
                        className="p-1.5 text-rose-500/80 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                        title={u.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
                      >
                        {u.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details & Audit History Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={selectedUser} className="h-10 w-10 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-foreground">{selectedUser.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">{selectedUser.email} • {selectedUser.employeeId}</p>
                </div>
              </div>

              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Nav Tabs */}
            <div className="flex items-center gap-2 border-b border-border/30 pb-2">
              <button
                onClick={() => setModalTab('profile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modalTab === 'profile' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                User Profile
              </button>
              <button
                onClick={() => setModalTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${modalTab === 'audit' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Audit & Activity History ({auditLogs.length})
              </button>
            </div>

            {modalTab === 'profile' ? (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/30">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Role</span>
                  <p className="font-bold text-foreground">{selectedUser.role}</p>
                </div>
                <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/30">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Status</span>
                  <p className="font-bold text-foreground">{selectedUser.status}</p>
                </div>
                <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/30">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Phone Number</span>
                  <p className="font-semibold text-foreground">{selectedUser.phone || 'N/A'}</p>
                </div>
                <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/30">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Department / College</span>
                  <p className="font-semibold text-foreground">{selectedUser.department || selectedUser.college || 'N/A'}</p>
                </div>
                <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/30">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Designation</span>
                  <p className="font-semibold text-foreground">{selectedUser.designation || 'N/A'}</p>
                </div>
                <div className="space-y-1 bg-muted/20 p-3 rounded-xl border border-border/30">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Registered Date</span>
                  <p className="font-semibold text-foreground">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {auditLoading ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Loading audit history...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No activity history recorded for this user.</p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-muted/20 border border-border/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary text-[11px]">{log.action}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form onSubmit={handleExecutePasswordReset} className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <h3 className="text-base font-bold text-foreground">Reset Password for {selectedUser.name}</h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground block">
                New Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                required
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-border/30 pt-4">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passSubmitting}
                className="px-5 py-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover transition-all"
              >
                {passSubmitting ? 'Resetting...' : 'Confirm Reset Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UsersDirectory;
