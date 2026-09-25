import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Search, Edit2, Archive, CheckCircle2,
  Clock, MapPin, Globe, Users, Laptop, AlertCircle, RefreshCw, X,
  Check, CheckSquare, Square
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import UserAvatar from '../common/UserAvatar';

const formatTimeTo12Hour = (time24) => {
  if (!time24) return '09:00 AM';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return '09:00 AM';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${period}`;
};

const parseWorkingHours = (hoursRef) => {
  if (!hoursRef) return { start: '09:00', end: '18:00' };
  const parts = hoursRef.split(/[-–—]/).map(s => s.trim());
  if (parts.length === 2) {
    const to24 = (timeStr) => {
      const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return timeStr;
      let [_, h, m, period] = match;
      let hour = parseInt(h, 10);
      if (period) {
        if (period.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }
      return `${String(hour).padStart(2, '0')}:${m}`;
    };
    return {
      start: to24(parts[0]) || '09:00',
      end: to24(parts[1]) || '18:00'
    };
  }
  return { start: '09:00', end: '18:00' };
};

const BranchManager = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, companies: scopeCompanies } = useCompanyScope();

  const [branches, setBranches] = useState([]);
  const [stats, setStats] = useState({ totalBranches: 0, activeBranches: 0, archivedBranches: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Available Companies for Super Admin / Admin
  const [organizations, setOrganizations] = useState([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [modalCompanyId, setModalCompanyId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: 'India',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE'
  });
  const [inheritedHours, setInheritedHours] = useState({ start: '09:00 AM', end: '06:00 PM' });

  // Member Assignment State in Modal
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Load organizations for Company select
  useEffect(() => {
    api.get('/organizations')
      .then((res) => {
        if (res.data?.data && Array.isArray(res.data.data)) {
          setOrganizations(res.data.data);
        } else if (Array.isArray(res.data)) {
          setOrganizations(res.data);
        } else if (scopeCompanies && scopeCompanies.length > 0) {
          setOrganizations(scopeCompanies);
        }
      })
      .catch((err) => {
        console.warn('Failed to load organizations from API, using scopeCompanies:', err);
        if (scopeCompanies && scopeCompanies.length > 0) {
          setOrganizations(scopeCompanies);
        }
      });
  }, [scopeCompanies]);

  const fetchBranches = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = {
        search,
        status: statusFilter,
        includeArchived: includeArchived ? 'true' : 'false'
      };
      if (selectedOrgId && selectedOrgId !== 'all') {
        params.organizationId = selectedOrgId;
      }

      const res = await api.get('/enterprise/branches', { params });
      if (res.data?.success) {
        setBranches(res.data.branches || []);
      }

      const statsRes = await api.get('/enterprise/branches/stats', {
        params: selectedOrgId && selectedOrgId !== 'all' ? { organizationId: selectedOrgId } : {}
      });
      if (statsRes.data?.success) {
        setStats(statsRes.data.stats || { totalBranches: 0, activeBranches: 0, archivedBranches: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load branch records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [selectedOrgId, statusFilter, includeArchived]);

  // Load users for the company selected inside the modal
  const fetchUsersForModalCompany = async (targetOrgId) => {
    if (!targetOrgId || targetOrgId === 'all') {
      setCompanyUsers([]);
      return;
    }
    setLoadingUsers(true);
    try {
      const res = await api.get('/users', {
        params: {
          organizationId: targetOrgId,
          limit: 150,
          excludeSuperAdmin: 'true'
        }
      });
      if (res.data?.users) {
        setCompanyUsers(res.data.users);
      } else {
        setCompanyUsers([]);
      }
    } catch (err) {
      console.error('Failed to load company users for branch assignment:', err);
      setCompanyUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchShiftForModalCompany = async (targetOrgId) => {
    if (!targetOrgId || targetOrgId === 'all') {
      setInheritedHours({ start: '09:00 AM', end: '06:00 PM' });
      return;
    }
    try {
      const res = await api.get('/shifts', { params: { organizationId: targetOrgId } });
      const shifts = res.data?.shifts || (Array.isArray(res.data) ? res.data : []);
      const defaultShift = shifts.find(s => s.name === 'Company Default' || s.isDefault) || shifts[0];
      if (defaultShift && defaultShift.startTime && defaultShift.endTime) {
        setInheritedHours({
          start: formatTimeTo12Hour(defaultShift.startTime),
          end: formatTimeTo12Hour(defaultShift.endTime)
        });
        return;
      }
    } catch (e) {
      // ignore
    }
    setInheritedHours({ start: '09:00 AM', end: '06:00 PM' });
  };

  useEffect(() => {
    const handleShiftChange = (e) => {
      const targetId = modalCompanyId || (selectedOrgId !== 'all' ? selectedOrgId : user?.organizationId);
      if (targetId) {
        fetchShiftForModalCompany(targetId);
      }
    };
    window.addEventListener('shift_updated', handleShiftChange);
    return () => window.removeEventListener('shift_updated', handleShiftChange);
  }, [modalCompanyId, selectedOrgId, user?.organizationId]);

  // When modal company changes, re-fetch users and clear existing selection
  const handleModalCompanyChange = (newOrgId) => {
    setModalCompanyId(newOrgId);
    setSelectedMemberIds([]);
    fetchUsersForModalCompany(newOrgId);
    fetchShiftForModalCompany(newOrgId);
  };

  const openCreateModal = () => {
    const defaultOrg = (selectedOrgId && selectedOrgId !== 'all')
      ? selectedOrgId
      : (user?.organizationId || (organizations[0]?.id || ''));

    setModalCompanyId(defaultOrg);
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      country: 'India',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE'
    });
    setUserSearch('');
    setSelectedMemberIds([]);
    setErrorMessage(null);
    setCreateModalOpen(true);
    fetchUsersForModalCompany(defaultOrg);
    fetchShiftForModalCompany(defaultOrg);
  };

  const openEditModal = async (branch) => {
    setSelectedBranch(branch);
    const branchOrgId = branch.organizationId || selectedOrgId || user?.organizationId || '';
    setModalCompanyId(branchOrgId);

    if (branch.workingHoursRef) {
      const parsedHours = parseWorkingHours(branch.workingHoursRef);
      setInheritedHours({
        start: formatTimeTo12Hour(parsedHours.start),
        end: formatTimeTo12Hour(parsedHours.end)
      });
    } else {
      fetchShiftForModalCompany(branchOrgId);
    }

    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      country: branch.country || 'India',
      timezone: branch.timezone || 'Asia/Kolkata',
      status: branch.status || 'ACTIVE'
    });

    setUserSearch('');
    setErrorMessage(null);
    setEditModalOpen(true);

    // Fetch existing users and pre-select assigned users
    try {
      setLoadingUsers(true);
      const res = await api.get('/users', {
        params: {
          organizationId: branchOrgId,
          limit: 150,
          excludeSuperAdmin: 'true'
        }
      });
      if (res.data?.users) {
        setCompanyUsers(res.data.users);
        const preselected = res.data.users
          .filter(u => u.branchId === branch.id || u.branch?.id === branch.id)
          .map(u => u.id);
        setSelectedMemberIds(preselected);
      }
    } catch (err) {
      console.error('Failed to load users for branch editing:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        organizationId: modalCompanyId,
        branchName: formData.name,
        branchCode: formData.code,
        name: formData.name,
        code: formData.code,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        timezone: formData.timezone,
        status: formData.status,
        members: selectedMemberIds
      };

      const res = await api.post('/enterprise/branches', payload);
      if (res.data?.success) {
        setCreateModalOpen(false);
        await fetchBranches();
      }
    } catch (err) {
      console.error('Create branch failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to create branch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        organizationId: modalCompanyId,
        name: formData.name,
        branchName: formData.name,
        code: formData.code,
        branchCode: formData.code,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        timezone: formData.timezone,
        status: formData.status,
        members: selectedMemberIds
      };

      const res = await api.patch(`/enterprise/branches/${selectedBranch.id}`, payload);
      if (res.data?.success) {
        setEditModalOpen(false);
        setSelectedBranch(null);
        await fetchBranches();
      }
    } catch (err) {
      console.error('Update branch failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to update branch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (branch) => {
    if (!window.confirm(`Are you sure you want to archive branch "${branch.name}"? Active employees will not be deleted.`)) {
      return;
    }
    try {
      await api.delete(`/enterprise/branches/${branch.id}`);
      await fetchBranches();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive branch.');
    }
  };

  // Filter company users by search query
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return companyUsers;
    return companyUsers.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const empId = (u.employeeId || '').toLowerCase();
      const dept = (u.department || '').toLowerCase();
      return name.includes(q) || empId.includes(q) || dept.includes(q);
    });
  }, [companyUsers, userSearch]);

  const handleToggleMember = (userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredUsers.map(u => u.id);
    setSelectedMemberIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleClearAll = () => {
    setSelectedMemberIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-foreground flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-primary" />
            Branch Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage company branches, local working hours reference, and employee physical distribution.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-white font-extrabold shadow-md shadow-primary/20 transition-all text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Branch
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Total Branches</p>
            <h4 className="text-2xl font-black text-foreground">{stats.totalBranches}</h4>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Active Operational</p>
            <h4 className="text-2xl font-black text-foreground">{stats.activeBranches}</h4>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Archived Branches</p>
            <h4 className="text-2xl font-black text-foreground">{stats.archivedBranches}</h4>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-3xl bg-card border border-border/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by branch name, code, or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchBranches()}
            className="w-full pl-9 pr-4 py-2 rounded-2xl text-xs bg-muted/30 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-2xl text-xs font-semibold bg-muted/30 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded accent-primary focus:ring-primary cursor-pointer"
            />
            Show Archived
          </label>

          <button
            onClick={fetchBranches}
            disabled={loading}
            className="p-2 rounded-2xl bg-muted/40 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all cursor-pointer"
            title="Refresh Branches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground text-xs font-bold">Loading branch directory...</div>
      ) : branches.length === 0 ? (
        <div className="p-12 rounded-3xl bg-card border border-border/80 text-center">
          <Building2 className="w-12 h-12 text-primary/40 mx-auto mb-3" />
          <h4 className="text-base font-extrabold text-foreground">No Branches Found</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Get started by adding your headquarters or regional branches to track assets and employees.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-3xl bg-card border transition-all hover:shadow-md flex flex-col justify-between ${
                b.isArchived
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-border/80 hover:border-primary/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                      {b.name}
                    </h3>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground mt-1 inline-block">
                      {b.code}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      b.isArchived
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : b.status === 'ACTIVE'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {b.isArchived ? 'ARCHIVED' : b.status}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground mt-4 font-medium">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{b.address || `${b.city || 'City not specified'}, ${b.country || 'India'}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Working Hours: <strong className="text-foreground">{b.workingHoursRef}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Timezone: {b.timezone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-muted-foreground font-semibold">
                  <span className="flex items-center gap-1.5 text-foreground font-bold">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    {b.employeeCount || 0} Members
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Laptop className="w-3.5 h-3.5" />
                    {b.assetCount || 0} Assets
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(b)}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    title="Edit Branch"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {!b.isArchived && (
                    <button
                      onClick={() => handleArchive(b)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      title="Archive Branch"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Branch Modal */}
      <AnimatePresence>
        {(createModalOpen || editModalOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden text-left"
            >
              {/* Sticky Modal Header */}
              <div className="sticky top-0 z-20 bg-card px-6 py-4 sm:px-8 sm:py-5 border-b border-border/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-foreground">
                      {createModalOpen ? 'Create New Branch' : 'Edit Branch Details'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Configure physical location, working hours, and assign employees
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCreateModalOpen(false);
                    setEditModalOpen(false);
                  }}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={createModalOpen ? handleCreate : handleEdit} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">
                  {errorMessage && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errorMessage}
                    </div>
                  )}

                  {/* Row 1: Company (Left) | Branch Code (Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-foreground mb-1.5">
                        Company *
                      </label>
                      <select
                        value={modalCompanyId}
                        onChange={(e) => handleModalCompanyChange(e.target.value)}
                        disabled={!isSuperAdmin}
                        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl bg-muted/30 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all ${
                          !isSuperAdmin ? 'opacity-80 cursor-not-allowed bg-muted/60' : 'cursor-pointer'
                        }`}
                      >
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.companyCode || org.code || 'ORG'})
                          </option>
                        ))}
                      </select>
                      {!isSuperAdmin && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Locked to your assigned company
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-foreground mb-1.5">
                        Branch Code *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. BR-BLR"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-mono uppercase rounded-2xl bg-muted/30 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Branch Name (Left) | Status (Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-foreground mb-1.5">
                        Branch Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Bangalore Tech Hub"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-muted/30 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-foreground mb-1.5">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl bg-muted/30 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
                      >
                        <option value="ACTIVE">Active Operational</option>
                        <option value="INACTIVE">Inactive / Paused</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Address (Left) | Time Zone (Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-foreground mb-1.5">
                        Physical Address
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Floor 4, Silicon Towers, Whitefield"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-muted/30 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-foreground mb-1.5">
                        Time Zone
                      </label>
                      <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl bg-muted/30 border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                        <option value="UTC">UTC (GMT +00:00)</option>
                        <option value="America/New_York">America/New York (EST/EDT)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 4: City */}
                  <div>
                    <label className="block text-xs font-extrabold text-foreground mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bangalore"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-muted/30 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                  </div>

                  {/* Row 5 (Full Width): Branch Members Assignment Section */}
                  <div className="pt-2 border-t border-border/60">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-xs font-extrabold text-foreground flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Branch Members
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                            {selectedMemberIds.length} Members Selected
                          </span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Assign employees belonging to this organization to the branch
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={handleSelectAllFiltered}
                          disabled={filteredUsers.length === 0}
                          className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Select All ({filteredUsers.length})
                        </button>
                        <span className="text-muted-foreground/40">|</span>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          disabled={selectedMemberIds.length === 0}
                          className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    {/* Member Search Input */}
                    <div className="relative mb-3">
                      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search employees by name, employee ID, or department..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-xs rounded-xl bg-muted/30 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      />
                    </div>

                    {/* Scrollable Members List */}
                    <div className="max-h-56 overflow-y-auto rounded-2xl border border-border/80 p-2 space-y-1.5 bg-muted/10">
                      {loadingUsers ? (
                        <div className="p-6 text-center text-xs font-bold text-muted-foreground">
                          Loading company roster...
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-6 text-center text-xs font-semibold text-muted-foreground">
                          {userSearch ? 'No employees matching your search' : 'No employees found in this company.'}
                        </div>
                      ) : (
                        filteredUsers.map((u) => {
                          const isSelected = selectedMemberIds.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => handleToggleMember(u.id)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                                isSelected
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'border-border/60 hover:border-primary/30 hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}} // handled by parent onClick
                                  className="rounded accent-primary focus:ring-primary cursor-pointer"
                                />
                                <UserAvatar user={u} size="sm" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-extrabold text-foreground truncate">
                                      {u.name}
                                    </p>
                                    <span className="text-[10px] font-mono text-muted-foreground">
                                      {u.employeeId}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {u.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {u.department && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                                    {u.department}
                                  </span>
                                )}
                                {u.branch?.name && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    Branch: {u.branch.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Sticky Modal Footer */}
                <div className="sticky bottom-0 z-20 bg-card px-6 py-4 sm:px-8 sm:py-4 border-t border-border/60 flex justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(false);
                      setEditModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-2xl text-xs font-extrabold bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : createModalOpen ? 'Create Branch' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BranchManager;
