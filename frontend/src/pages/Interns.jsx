import React, { useState, useEffect } from 'react';
import api, { getUploadUrl } from '../services/api';
import UserAvatar from '../components/common/UserAvatar';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Lock,
  Download,
  Upload,
  MoreVertical,
  X,
  CheckCircle,
  AlertCircle,
  Edit2,
  Eye,
  Mail,
  Phone,
  Calendar,
  Clock,
  GraduationCap,
  Building2,
  UserCheck
} from 'lucide-react';

const Interns = () => {
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsModalUser, setDetailsModalUser] = useState(null);

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    college: '',
    department: '',
    joiningDate: '',
    role: 'INTERN'
  });

  const [importText, setImportText] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users', {
        params: {
          page,
          search,
          role: 'INTERN',
          status: statusFilter,
          limit: 15
        }
      });
      setUsers(res.data.users);
      setTotalCount(res.data.meta.totalCount);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to fetch users registry.' });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/users', formData);
      setCreateModalOpen(false);
      setFormData({
        name: '',
        email: '',
        phone: '',
        dob: '',
        college: '',
        department: '',
        joiningDate: '',
        role: 'INTERN'
      });
      setAlertMsg({ type: 'success', text: 'User onboarded successfully! Welcome email is being dispatched.' });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to onboard user.' });
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/users/${selectedUser.id}`, { ...formData, role: 'INTERN' });
      setEditModalOpen(false);
      setSelectedUser(null);
      setAlertMsg({ type: 'success', text: 'User details updated.' });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to edit user details.' });
      setLoading(false);
    }
  };

  const handleDeleteUser = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User Account',
      message: 'Are you sure you want to delete this user? This action is permanent.',
      onConfirm: async () => {
        try {
          await api.delete(`/users/${id}`);
          setAlertMsg({ type: 'success', text: 'User account removed.' });
          fetchUsers();
        } catch (err) {
          setAlertMsg({ type: 'error', text: 'Failed to delete user.' });
        }
      }
    });
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.put(`/users/${id}/status`, { status: nextStatus });
      setAlertMsg({ type: 'success', text: `User status set to ${nextStatus}.` });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Failed to toggle status.' });
    }
  };

  const handleResetPassword = async (id) => {
    try {
      const res = await api.put(`/users/${id}/reset-password`);
      setAlertMsg({
        type: 'success',
        text: `Password reset to default DOB format. Temporary: "${res.data.tempPassword}"`
      });
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to reset password.' });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Bulk Delete Accounts',
      message: `Are you sure you want to delete the ${selectedIds.length} selected user accounts? This action is permanent.`,
      onConfirm: async () => {
        try {
          await api.post('/users/bulk-delete', { ids: selectedIds });
          setSelectedIds([]);
          setAlertMsg({ type: 'success', text: 'Selected accounts deleted.' });
          fetchUsers();
        } catch (err) {
          setAlertMsg({ type: 'error', text: 'Bulk delete operations failed.' });
        }
      }
    });
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    try {
      // Parse CSV text to JSON list
      const lines = importText.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const parsedUsers = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = lines[i].split(',').map(c => c.trim());
        const userObj = {};
        headers.forEach((header, idx) => {
          userObj[header] = columns[idx];
        });
        userObj['role'] = 'INTERN';
        parsedUsers.push(userObj);
      }

      setLoading(true);
      const res = await api.post('/users/bulk-import', { usersList: parsedUsers });
      setImportModalOpen(false);
      setImportText('');
      setAlertMsg({
        type: 'success',
        text: `Import completed. Created: ${res.data.createdCount}. Skipped: ${res.data.skipped.length}.`
      });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: 'Invalid CSV format or values. Ensure columns match: name,email,dob,role,phone,college,department' });
      setLoading(false);
    }
  };

  const triggerExport = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users', {
        params: {
          role: 'INTERN',
          status: statusFilter,
          search: search,
          limit: 1000
        }
      });
      const exportList = res.data.users || users;

      const headers = ['Employee ID', 'Full Name', 'Email', 'Phone', 'College', 'Department', 'Role', 'Status', 'Joining Date', 'Created At'];
      const csvRows = exportList.map(u => [
        `"${(u.employeeId || '').replace(/"/g, '""')}"`,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.phone || '').replace(/"/g, '""')}"`,
        `"${(u.college || '').replace(/"/g, '""')}"`,
        `"${(u.department || '').replace(/"/g, '""')}"`,
        `"${(u.role || '').replace(/"/g, '""')}"`,
        `"${(u.status || '').replace(/"/g, '""')}"`,
        `"${u.joiningDate ? new Date(u.joiningDate).toLocaleDateString() : ''}"`,
        `"${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}"`
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `interns_registry_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setLoading(false);
      setAlertMsg({ type: 'success', text: `Successfully exported ${exportList.length} intern records to CSV.` });
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Failed to export CSV file.' });
      setLoading(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      dob: user.dob ? user.dob.split('T')[0] : '',
      college: user.college || '',
      department: user.department || '',
      joiningDate: user.joiningDate ? user.joiningDate.split('T')[0] : '',
      role: 'INTERN'
    });
    setEditModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Alert Header Banner */}
      {alertMsg.text && (
        <div className={`flex items-center gap-2 p-4 rounded-xl border ${alertMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
          {alertMsg.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-xs font-semibold">{alertMsg.text}</span>
          <button className="ml-auto" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Control Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-2xl border border-border/40 shadow-premium">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID, name, email..."
            className="w-full pl-9 bg-muted/40 focus:bg-card"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-muted/40">
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <button onClick={triggerExport} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button onClick={() => setImportModalOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
          </button>

          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Intern</span>
          </button>

          {selectedIds.length > 0 && (
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white shadow-md">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Registry Table */}
      <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card shadow-premium">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="px-6 py-4">
                <input
                  type="checkbox"
                  checked={users.length > 0 && selectedIds.length === users.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(users.map(u => u.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded border-border text-primary focus:ring-primary"
                />
              </th>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Intern Name</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4">College</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
                      <GraduationCap className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">No Interns Registered</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The Intern Registry is currently empty. Click below to add a new intern record.
                    </p>
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add New Intern</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-muted/30 cursor-pointer transition-all h-16"
                  onClick={() => setDetailsModalUser(item)}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, item.id]);
                        } else {
                          setSelectedIds(selectedIds.filter(id => id !== item.id));
                        }
                      }}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-xs text-primary">
                    {item.employeeId}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={item.profilePic}
                        name={item.name}
                        className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/40 shadow-sm"
                      />
                      <span className="font-semibold text-foreground hover:text-primary transition-colors">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground max-w-[180px] truncate">{item.email}</td>
                  <td className="px-6 py-4 text-xs font-medium text-foreground">{item.department || 'N/A'}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground max-w-[160px] truncate">{item.college || 'N/A'}</td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleStatus(item.id, item.status)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${item.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span>{item.status}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetailsModalUser(item)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-colors" title="View Details Card">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleResetPassword(item.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Reset password">
                        <Lock className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEditModal(item)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit Record">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteUser(item.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" title="Delete Record">
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

      {/* Pagination Controls */}
      <div className="flex justify-between items-center px-2">
        <span className="text-xs text-muted-foreground">Total records: {totalCount}</span>
        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 bg-card border rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-muted"
          >
            Prev
          </button>
          <button
            disabled={users.length < 15}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 bg-card border rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-muted"
          >
            Next
          </button>
        </div>
      </div>

      {/* Onboard Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Onboard New Intern</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setCreateModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Email Address *</label>
                  <input type="email" name="email" required value={formData.email} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Date of Birth *</label>
                  <input type="date" name="dob" required value={formData.dob} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">College Name</label>
                  <input type="text" name="college" value={formData.college} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Department</label>
                  <input type="text" name="department" value={formData.department} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Joining Date</label>
                  <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} className="w-full" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Onboard Intern
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Edit User Details</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => {
                setEditModalOpen(false);
                setSelectedUser(null);
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Full Name *</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Email Address *</label>
                  <input type="email" name="email" required value={formData.email} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Date of Birth</label>
                  <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">College Name</label>
                  <input type="text" name="college" value={formData.college} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Department</label>
                  <input type="text" name="department" value={formData.department} onChange={handleInputChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Joining Date</label>
                  <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} className="w-full" />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Bulk Import Interns (CSV)</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setImportModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="mt-4 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">CSV Text Data</label>
                <textarea
                  rows={8}
                  placeholder="name,email,dob,role,phone,college,department&#10;John Doe,john@example.com,2000-08-15,INTERN,12345678,MIT,CS&#10;Jane Smith,jane@example.com,1998-05-12,TEAM_LEADER,,IIT,EE"
                  className="w-full border border-border p-3 text-xs bg-muted/40 font-mono rounded-lg outline-none"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Execute Bulk Import
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <h3 className="text-base font-bold text-foreground">{confirmModal.title}</h3>
            <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{confirmModal.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="rounded-xl px-4 py-2 text-xs font-semibold hover:bg-muted border border-border/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmModal.onConfirm) {
                    await confirmModal.onConfirm();
                  }
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className="rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-danger-hover active:scale-95 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Card Modal / Panel */}
      {detailsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-border/40 bg-card p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Intern Details Profile Card</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailsModalUser.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                  {detailsModalUser.status}
                </span>
              </div>
              <button
                className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => setDetailsModalUser(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Avatar & Main Info */}
            <div className="mt-6 flex flex-col items-center text-center pb-6 border-b border-border/40">
              <img
                src={detailsModalUser.profilePic ? getUploadUrl(detailsModalUser.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${detailsModalUser.name}`}
                className="h-20 w-20 rounded-2xl object-cover border-2 border-primary/20 shadow-md mb-3"
                alt={detailsModalUser.name}
              />
              <h3 className="text-lg font-bold text-foreground">{detailsModalUser.name}</h3>
              <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-md mt-1">
                {detailsModalUser.employeeId}
              </span>
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Intern Registry Account
              </p>
            </div>

            {/* Complete Profile Details Grid */}
            <div className="py-6 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact & Personal Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/20 border border-border/20 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                    <Mail className="h-3.5 w-3.5 text-primary" /> Email Address
                  </span>
                  <span className="font-semibold text-foreground truncate block">{detailsModalUser.email}</span>
                </div>

                <div className="bg-muted/20 border border-border/20 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                    <Phone className="h-3.5 w-3.5 text-primary" /> Phone Number
                  </span>
                  <span className="font-semibold text-foreground">{detailsModalUser.phone || 'Not provided'}</span>
                </div>

                <div className="bg-muted/20 border border-border/20 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Date of Birth (DOB)
                  </span>
                  <span className="font-semibold text-foreground">
                    {detailsModalUser.dob ? new Date(detailsModalUser.dob).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                <div className="bg-muted/20 border border-border/20 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Joining Date
                  </span>
                  <span className="font-semibold text-foreground">
                    {detailsModalUser.joiningDate ? new Date(detailsModalUser.joiningDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pt-2">Academic & Department Info</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/20 border border-border/20 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" /> College / Institution
                  </span>
                  <span className="font-semibold text-foreground">{detailsModalUser.college || 'N/A'}</span>
                </div>

                <div className="bg-muted/20 border border-border/20 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mb-1">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> Department
                  </span>
                  <span className="font-semibold text-foreground">{detailsModalUser.department || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-border/40 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  const u = detailsModalUser;
                  setDetailsModalUser(null);
                  openEditModal(u);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => {
                  const u = detailsModalUser;
                  setDetailsModalUser(null);
                  handleResetPassword(u.id);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Reset Password</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interns;
