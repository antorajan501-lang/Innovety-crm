import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { getUploadUrl, downloadFile } from '../services/api';
import UserAvatar from '../components/common/UserAvatar';
import ConfirmModal from '../components/common/ConfirmModal';
import CandidateTypeFields from '../components/common/CandidateTypeFields';
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
  MessageSquare,
  Calendar,
  Clock,
  GraduationCap,
  Building2,
  UserCheck,
  RotateCcw,
  FileText
} from 'lucide-react';

import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }
};

const Interns = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const urlSearch = new URLSearchParams(location.search).get('search') || '';

  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const sParam = new URLSearchParams(location.search).get('search') || '';
    setSearch(sParam);
  }, [location.search]);

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
    role: 'INTERN',
    candidateType: '',
    degree: '',
    currentYearSemester: '',
    graduationYear: '',
    internshipRole: '',
    internshipDuration: '',
    highestQualification: '',
    keySkills: '',
    companyName: '',
    designation: '',
    totalExperience: '',
    resume: '',
    resumeFile: null
  });

  const [importText, setImportText] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deleteTriggerRef = useRef(null);

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
      setUsers(res.data.users || []);
      setTotalCount(res.data.meta?.totalCount || 0);
      setAlertMsg({ type: '', text: '' });
      setLoading(false);
    } catch (err) {
      console.error('Fetch intern registry error:', err);
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
    if (e.updatedData) {
      setFormData(e.updatedData);
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, resumeFile: file });
    }
  };

  const resetFormData = () => ({
    name: '',
    email: '',
    phone: '',
    dob: '',
    college: '',
    department: '',
    joiningDate: '',
    role: 'INTERN',
    candidateType: '',
    degree: '',
    currentYearSemester: '',
    graduationYear: '',
    internshipRole: '',
    internshipDuration: '',
    highestQualification: '',
    keySkills: '',
    companyName: '',
    designation: '',
    totalExperience: '',
    resume: '',
    resumeFile: null
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const fd = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'resumeFile' || key === 'resume') return;
        if (formData[key] !== null && formData[key] !== undefined) {
          fd.append(key, formData[key]);
        }
      });
      if (formData.resumeFile) fd.append('resume', formData.resumeFile);
      await api.post('/users', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCreateModalOpen(false);
      setFormData(resetFormData());
      setAlertMsg({ type: 'success', text: 'Intern account onboarded successfully.' });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to onboard intern.' });
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const fd = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === 'resumeFile' || key === 'resume') return;
        if (formData[key] !== null && formData[key] !== undefined) {
          fd.append(key, formData[key]);
        }
      });
      fd.append('role', 'INTERN');
      if (formData.resumeFile) fd.append('resume', formData.resumeFile);
      const res = await api.put(`/users/${selectedUser.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditModalOpen(false);
      setSelectedUser(null);
      const successMsg = res.data.dobPasswordReset
        ? 'Date of Birth updated successfully. The user\'s initial password has been reset based on the new DOB.'
        : 'User details updated.';
      setAlertMsg({ type: 'success', text: successMsg });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to edit user details.' });
      setLoading(false);
    }
  };

  const handleDeleteUser = (id, e) => {
    deleteTriggerRef.current = e?.currentTarget || document.activeElement;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Record',
      message: 'Are you sure you want to permanently delete this record? This action cannot be undone.',
      onConfirm: async () => {
        try {
          setDeleteLoading(true);
          const res = await api.delete(`/users/${id}`);
          setAlertMsg({ type: 'success', text: res.data?.message || 'Record deleted successfully.' });
          await fetchUsers();
        } catch (err) {
          console.error('Delete user error:', err);
          setAlertMsg({ type: 'error', text: 'Failed to delete record. Please try again.' });
        } finally {
          setDeleteLoading(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
      role: 'INTERN',
      candidateType: user.candidateType || '',
      degree: user.degree || '',
      currentYearSemester: user.currentYearSemester || '',
      graduationYear: user.graduationYear || '',
      internshipRole: user.internshipRole || '',
      internshipDuration: user.internshipDuration || '',
      highestQualification: user.highestQualification || '',
      keySkills: user.keySkills || '',
      companyName: user.companyName || '',
      designation: user.designation || '',
      totalExperience: user.totalExperience || '',
      resume: user.resume || '',
      resumeFile: null
    });
    setEditModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Alert Header Banner */}
      {alertMsg.text && (
        <div className={`flex items-center gap-2 p-4 rounded-xl border ${alertMsg.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
          {alertMsg.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-xs font-semibold">{alertMsg.text}</span>
          <button className="ml-auto" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Control Actions Bar */}
      <div className="glass-card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-white/70 dark:border-white/10 shadow-lg">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID, name, email..."
            className="w-full pl-9 bg-white/50 dark:bg-slate-800/40 text-xs py-2 rounded-xl border border-white/80 dark:border-slate-700/60 focus:bg-white dark:focus:bg-slate-800 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-muted/40 text-xs px-3 py-2 rounded-xl">
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

          <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Intern</span>
          </button>

          {selectedIds.length > 0 && (
            <button onClick={handleBulkDelete} className="flex items-center gap-1.5 rounded-xl bg-danger px-3.5 py-2 text-xs font-semibold text-white shadow-md">
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Registry Table */}
      <div className="w-full min-w-0 overflow-x-auto glass-card border border-white/70 dark:border-white/10 shadow-lg">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-white/40 dark:bg-slate-800/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              <th className="px-4 py-4 whitespace-nowrap">
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
              <th className="px-4 py-4 whitespace-nowrap">ID</th>
              <th className="px-4 py-4 whitespace-nowrap">Intern Name</th>
              <th className="px-4 py-4 whitespace-nowrap">Email</th>
              <th className="px-4 py-4 whitespace-nowrap">Department</th>
              <th className="px-4 py-4 whitespace-nowrap">College</th>
              <th className="px-4 py-4 whitespace-nowrap">Status</th>
              <th className="px-4 py-4 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="text-xs font-semibold text-muted-foreground">Loading intern registry...</span>
                  </div>
                </td>
              </tr>
            ) : alertMsg.type === 'error' && users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center whitespace-nowrap">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 mb-4 shadow-sm">
                      <AlertCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">Failed to Load Interns</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alertMsg.text || 'Failed to load intern records. Please check your network connection and try again.'}
                    </p>
                    <button
                      onClick={fetchUsers}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-hover transition-all"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Retry Loading</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center whitespace-nowrap">
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
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-hover transition-all"
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
                  className="hover:bg-muted/30 cursor-pointer transition-all h-16 whitespace-nowrap"
                  onClick={() => setDetailsModalUser(item)}
                >
                  <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                  <td className="px-4 py-4 font-mono font-bold text-xs text-primary whitespace-nowrap">
                    {item.employeeId}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={item.profilePic}
                        name={item.name}
                        className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/40 shadow-sm"
                      />
                      <span className="font-semibold text-foreground hover:text-primary transition-colors">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground max-w-[180px] truncate whitespace-nowrap" title={item.email}>{item.email}</td>
                  <td className="px-4 py-4 text-xs font-medium text-foreground max-w-[140px] truncate whitespace-nowrap" title={item.department}>{item.department || 'N/A'}</td>
                  <td className="px-4 py-4 text-xs text-muted-foreground max-w-[140px] truncate whitespace-nowrap" title={item.college}>{item.college || 'N/A'}</td>
                  <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleStatus(item.id, item.status)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition-all ${item.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'ACTIVE' ? 'bg-primary' : 'bg-red-500'}`} />
                      <span>{item.status}</span>
                    </button>
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                      <button onClick={(e) => handleDeleteUser(item.id, e)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger focus:ring-2 focus:ring-danger focus:outline-none" title="Delete Record">
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

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
                  <label className="text-xs font-semibold text-muted-foreground">Department</label>
                  <input type="text" name="department" value={formData.department} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Joining Date</label>
                  <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} className="w-full" />
                </div>
              </div>

              <CandidateTypeFields
                formData={formData}
                onChange={handleInputChange}
                onFileChange={handleFileChange}
                isEdit={false}
              />

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

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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
                  <label className="text-xs font-semibold text-muted-foreground">Department</label>
                  <input type="text" name="department" value={formData.department} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Joining Date</label>
                  <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} className="w-full" />
                </div>
              </div>

              <CandidateTypeFields
                formData={formData}
                onChange={handleInputChange}
                onFileChange={handleFileChange}
                isEdit={true}
              />

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

      {/* Accessible Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        loading={deleteLoading}
        triggerElement={deleteTriggerRef.current}
      />

      {/* User Details Card Modal / Panel */}
      {detailsModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-border/40 bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Intern Details Profile Card</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailsModalUser.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                  {detailsModalUser.status}
                </span>
              </div>
              <button
                className="rounded-lg p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => setDetailsModalUser(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Compact Horizontal Profile Header Banner */}
            <div className="my-3 p-3.5 rounded-2xl bg-muted/30 border border-border/30 flex items-center gap-4">
              <UserAvatar
                user={detailsModalUser}
                className="h-14 w-14 rounded-2xl border-2 border-primary/20 shadow-sm shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">{detailsModalUser.name}</h3>
                  <span className="text-[11px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                    {detailsModalUser.employeeId}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  Intern Registry Account
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => { setDetailsModalUser(null); navigate(`/chat?dm=${detailsModalUser.id}`); }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Message</span>
                </button>
                <a
                  href={`mailto:${detailsModalUser.email}`}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-foreground text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Email</span>
                </a>
              </div>
            </div>

            {/* Compact Profile Details Grid */}
            <div className="space-y-3 py-1">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Contact & Personal Details</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-0.5">
                      <Mail className="h-3 w-3 text-primary" /> Email
                    </span>
                    <span className="font-semibold text-foreground truncate block text-xs">{detailsModalUser.email}</span>
                  </div>

                  <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-0.5">
                      <Phone className="h-3 w-3 text-primary" /> Phone
                    </span>
                    <span className="font-semibold text-foreground text-xs">{detailsModalUser.phone || 'N/A'}</span>
                  </div>

                  <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-0.5">
                      <Calendar className="h-3 w-3 text-primary" /> DOB
                    </span>
                    <span className="font-semibold text-foreground text-xs">
                      {detailsModalUser.dob ? new Date(detailsModalUser.dob).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-0.5">
                      <Clock className="h-3 w-3 text-primary" /> Joining Date
                    </span>
                    <span className="font-semibold text-foreground text-xs">
                      {detailsModalUser.joiningDate ? new Date(detailsModalUser.joiningDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Academic & Department Info</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-0.5">
                      <GraduationCap className="h-3 w-3 text-primary" /> College / Institution
                    </span>
                    <span className="font-semibold text-foreground text-xs">{detailsModalUser.college || detailsModalUser.companyName || 'N/A'}</span>
                  </div>

                  <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 mb-0.5">
                      <Building2 className="h-3 w-3 text-primary" /> Department
                    </span>
                    <span className="font-semibold text-foreground text-xs">{detailsModalUser.department || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Candidate Type Details Section */}
              {detailsModalUser.candidateType && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Candidate Profile</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">{detailsModalUser.candidateType}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {detailsModalUser.degree && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Degree</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.degree}</span>
                      </div>
                    )}
                    {detailsModalUser.currentYearSemester && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Current Year / Sem</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.currentYearSemester}</span>
                      </div>
                    )}
                    {detailsModalUser.graduationYear && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Graduation Year</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.graduationYear}</span>
                      </div>
                    )}
                    {detailsModalUser.internshipRole && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Internship Role</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.internshipRole}</span>
                      </div>
                    )}
                    {detailsModalUser.internshipDuration && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Internship Duration</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.internshipDuration}</span>
                      </div>
                    )}
                    {detailsModalUser.highestQualification && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Highest Qualification</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.highestQualification}</span>
                      </div>
                    )}
                    {detailsModalUser.keySkills && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl col-span-2">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Key Skills</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.keySkills}</span>
                      </div>
                    )}
                    {detailsModalUser.companyName && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Company</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.companyName}</span>
                      </div>
                    )}
                    {detailsModalUser.designation && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Designation</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.designation}</span>
                      </div>
                    )}
                    {detailsModalUser.totalExperience && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Total Experience</span>
                        <span className="font-semibold text-foreground text-xs">{detailsModalUser.totalExperience}</span>
                      </div>
                    )}
                    {detailsModalUser.resume && (
                      <div className="bg-muted/20 border border-border/20 p-2.5 rounded-xl col-span-2">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Resume</span>
                        <button
                          type="button"
                          onClick={() => downloadFile(detailsModalUser.resume)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold transition-all"
                        >
                          <FileText className="h-3.5 w-3.5" /> Download Resume
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 mt-2 border-t border-border/40 flex items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const u = detailsModalUser;
                  setDetailsModalUser(null);
                  openEditModal(u);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
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
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover"
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
