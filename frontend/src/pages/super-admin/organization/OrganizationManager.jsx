import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Building2, Award, Plus, Search, Edit2, Trash2, ShieldCheck,
  CheckCircle2, XCircle, ArrowUp, ArrowDown, RefreshCw, AlertTriangle, Layers, Clock, Users,
  X, Settings, FileText, ChevronRight, Save
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import UserAvatar from '../../../components/common/UserAvatar';

const OrganizationManager = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('positions');

  // Temporary Staging Editor State for Department Management
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptCode, setEditDeptCode] = useState('');
  const [originalDeptMemberIds, setOriginalDeptMemberIds] = useState([]);
  const [stagedAssignedMembers, setStagedAssignedMembers] = useState([]);
  const [stagedUnassignedMembers, setStagedUnassignedMembers] = useState([]);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [assignedMemberSearch, setAssignedMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ open: false, dept: null, memberCount: 0 });

  // State for Positions
  const [positions, setPositions] = useState([]);
  const [posLoading, setPosLoading] = useState(true);
  const [posSearch, setPosSearch] = useState('');
  const [posStatusFilter, setPosStatusFilter] = useState('ALL');
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [posForm, setPosForm] = useState({
    name: '',
    code: '',
    level: 1,
    description: '',
    color: '#4F46E5',
    textColor: '#FFFFFF',
    icon: 'Award',
    status: 'ACTIVE'
  });

  // State for Organization Tree data (Branches, Depts, Shifts, EmpTypes)
  const [treeData, setTreeData] = useState(null);
  const [treeLoading, setTreeLoading] = useState(true);

  // Common Modals for masters
  const [masterModal, setMasterModal] = useState({ open: false, type: '', data: null });
  const [masterForm, setMasterForm] = useState({ name: '', code: '', city: '', description: '', startTime: '09:30', endTime: '18:30' });

  const [selectedUserIdsForNewDept, setSelectedUserIdsForNewDept] = useState([]);
  const [createDeptSearchQuery, setCreateDeptSearchQuery] = useState('');
  const [addMemberSearchQuery, setAddMemberSearchQuery] = useState('');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');

  // Notifications
  const [alert, setAlert] = useState(null);

  const fetchPositions = async () => {
    try {
      setPosLoading(true);
      const res = await api.get('/positions');
      setPositions(res.data || []);
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to load positions.');
    } finally {
      setPosLoading(false);
    }
  };

  const fetchTree = async () => {
    try {
      setTreeLoading(true);
      const res = await api.get('/organization/tree');
      setTreeData(res.data || {});
    } catch (err) {
      console.error('Failed to fetch org tree:', err);
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    fetchTree();
  }, []);

  const showAlert = (type, text) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  // Temporary Staging Editor Handlers
  const fetchDeptMembers = async (deptId) => {
    try {
      setMembersLoading(true);
      const res = await api.get(`/organization/departments/${deptId}/members`);
      const initialAssigned = res.data?.members || [];
      const initialUnassigned = res.data?.availableUsers || [];

      setOriginalDeptMemberIds(initialAssigned.map(u => u.id));
      setStagedAssignedMembers(initialAssigned);
      setStagedUnassignedMembers(initialUnassigned);
    } catch (err) {
      console.error('Failed to fetch department members:', err);
    } finally {
      setMembersLoading(false);
    }
  };

  const openManageDepartmentModal = (dept) => {
    setSelectedDepartment(dept);
    setEditDeptName(dept.name);
    setEditDeptCode(dept.code);
    setAddMemberSearch('');
    setAssignedMemberSearch('');
    fetchDeptMembers(dept.id);
  };

  const handleRemoveStagedMember = (userToMove) => {
    setStagedAssignedMembers(prev => prev.filter(u => u.id !== userToMove.id));
    setStagedUnassignedMembers(prev => {
      if (prev.some(u => u.id === userToMove.id)) return prev;
      return [...prev, userToMove].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleAddStagedMember = (userToMove) => {
    setStagedUnassignedMembers(prev => prev.filter(u => u.id !== userToMove.id));
    setStagedAssignedMembers(prev => {
      if (prev.some(u => u.id === userToMove.id)) return prev;
      return [...prev, userToMove].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleDeleteDepartmentClick = () => {
    if (!selectedDepartment) return;
    const memberCount = stagedAssignedMembers.length;

    if (memberCount > 0) {
      setDeleteConfirmModal({
        open: true,
        dept: selectedDepartment,
        memberCount
      });
    } else {
      executeDeleteDepartment(selectedDepartment.id);
    }
  };

  const executeDeleteDepartment = async (deptId) => {
    try {
      setSaveLoading(true);
      const res = await api.delete(`/organization/departments/${deptId}`);
      showAlert('success', res.data?.message || 'Department deleted successfully.');
      setSelectedDepartment(null);
      setDeleteConfirmModal({ open: false, dept: null, memberCount: 0 });
      fetchTree();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete department.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveAllDeptChanges = async () => {
    if (!editDeptName.trim() || !editDeptCode.trim()) {
      showAlert('error', 'Department Name and Code are required.');
      return;
    }

    setSaveLoading(true);
    try {
      if (editDeptName.trim() !== selectedDepartment.name || editDeptCode.trim().toUpperCase() !== selectedDepartment.code) {
        await api.put(`/organization/departments/${selectedDepartment.id}`, {
          name: editDeptName.trim(),
          code: editDeptCode.trim().toUpperCase()
        });
      }

      const currentStagedIds = stagedAssignedMembers.map(u => u.id);
      const membersToRemove = originalDeptMemberIds.filter(id => !currentStagedIds.includes(id));
      const membersToAdd = currentStagedIds.filter(id => !originalDeptMemberIds.includes(id));

      for (const userId of membersToRemove) {
        await api.delete(`/organization/departments/${selectedDepartment.id}/members/${userId}`);
      }

      if (membersToAdd.length > 0) {
        await api.post(`/organization/departments/${selectedDepartment.id}/members`, {
          userIds: membersToAdd
        });
      }

      showAlert('success', `Department "${editDeptName.trim()}" updated successfully.`);
      setSelectedDepartment(null);
      fetchTree();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to save department changes.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Position Handlers
  const handleOpenPosModal = (pos = null) => {
    if (pos) {
      setEditingPos(pos);
      setPosForm({
        name: pos.name,
        code: pos.code,
        level: pos.level,
        description: pos.description || '',
        color: pos.color || '#4F46E5',
        textColor: pos.textColor || '#FFFFFF',
        icon: pos.icon || 'Award',
        status: pos.status || 'ACTIVE'
      });
    } else {
      setEditingPos(null);
      const nextLevel = positions.length > 0 ? Math.max(...positions.map(p => p.level)) + 1 : 1;
      setPosForm({
        name: '',
        code: `POS-${String(nextLevel).padStart(3, '0')}`,
        level: nextLevel,
        description: '',
        color: '#4F46E5',
        textColor: '#FFFFFF',
        icon: 'Award',
        status: 'ACTIVE'
      });
    }
    setPosModalOpen(true);
  };

  const handleSavePos = async (e) => {
    e.preventDefault();
    try {
      if (editingPos) {
        await api.put(`/positions/${editingPos.id}`, posForm);
        showAlert('success', `Position "${posForm.name}" updated successfully.`);
      } else {
        await api.post('/positions', posForm);
        showAlert('success', `Position "${posForm.name}" created successfully.`);
      }
      setPosModalOpen(false);
      fetchPositions();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to save position.');
    }
  };

  const handleTogglePosStatus = async (pos) => {
    try {
      const nextStatus = pos.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/positions/${pos.id}/status`, { status: nextStatus });
      showAlert('success', `Position status set to ${nextStatus}.`);
      fetchPositions();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to toggle status.');
    }
  };

  const handleDeletePos = async (pos) => {
    if (pos.totalEmployees > 0) {
      showAlert('error', `Cannot delete "${pos.name}". It is assigned to ${pos.totalEmployees} active employee(s). Please reassign them first.`);
      return;
    }
    if (pos.status !== 'INACTIVE') {
      showAlert('error', `Cannot delete active position "${pos.name}". Deactivate it first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete inactive position "${pos.name}"?`)) return;

    try {
      await api.delete(`/positions/${pos.id}`);
      showAlert('success', `Position "${pos.name}" deleted.`);
      fetchPositions();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete position.');
    }
  };

  const handleMovePosLevel = async (index, direction) => {
    const listToReorder = filteredPositions.length === positions.length ? positions : filteredPositions;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= listToReorder.length) return;

    const newPositions = [...listToReorder];
    const temp = newPositions[index];
    newPositions[index] = newPositions[targetIdx];
    newPositions[targetIdx] = temp;

    const items = newPositions.map((p, idx) => ({ id: p.id, level: idx + 1 }));

    try {
      const res = await api.put('/positions/reorder', { items });
      if (Array.isArray(res.data)) {
        setPositions(res.data);
      } else {
        fetchPositions();
      }
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to reorder positions.');
      fetchPositions();
    }
  };

  // Master Handlers
  const handleSaveMaster = async (e) => {
    e.preventDefault();
    try {
      if (masterModal.type === 'DEPARTMENT') {
        await api.post('/organization/departments', {
          name: masterForm.name,
          code: masterForm.code,
          memberUserIds: selectedUserIdsForNewDept
        });
        showAlert('success', `Department "${masterForm.name}" created successfully.`);
      }
      setMasterModal({ open: false, type: '', data: null });
      setSelectedUserIdsForNewDept([]);
      fetchTree();
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to create department');
    }
  };

  const filteredPositions = positions.filter(pos => {
    const matchQuery = pos.name.toLowerCase().includes(posSearch.toLowerCase()) ||
                       pos.code.toLowerCase().includes(posSearch.toLowerCase());
    const matchStatus = posStatusFilter === 'ALL' || pos.status === posStatusFilter;
    return matchQuery && matchStatus;
  });

  const displayDepartments = (treeData?.departments || []).filter(
    d => d.name !== 'Unassigned' && d.code !== 'DEP-UNASSIGNED'
  );

  return (
    <div className="space-y-6 text-left pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-extrabold text-primary border border-primary/20 mb-3">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Platform Control Center • Organization Architecture</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary">
              Organization Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-medium max-w-2xl">
              Centralized HRMS & ERP management hub for Positions, Hierarchy Levels, Departments, and Work Shifts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { fetchPositions(); fetchTree(); }}
              className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Tree</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border/60 mt-6 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'positions'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Positions & Hierarchy ({positions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'departments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Departments ({displayDepartments.length})</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-md ${
            alert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
          }`}
        >
          <span>{alert.text}</span>
          <button onClick={() => setAlert(null)} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* TAB 1: POSITIONS & HIERARCHY */}
      {activeTab === 'positions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-2xl border border-border/60 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search positions or codes..."
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-border/60 bg-muted/30 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none w-48 sm:w-64"
                />
              </div>

              <select
                value={posStatusFilter}
                onChange={(e) => setPosStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-border/60 bg-muted/30 focus:bg-background cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            {user?.role === 'SUPER_ADMIN' && (
              <button
                onClick={() => handleOpenPosModal()}
                className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white px-4 py-2 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Position</span>
              </button>
            )}
          </div>

          {/* Positions Table */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            {posLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredPositions.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground font-semibold">
                No positions found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-extrabold tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-3.5 px-4">Level</th>
                      <th className="py-3.5 px-4">Position Title</th>
                      <th className="py-3.5 px-4">Code</th>
                      <th className="py-3.5 px-4">Badge Preview</th>
                      <th className="py-3.5 px-4">Employees</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {filteredPositions.map((pos, idx) => (
                      <tr key={pos.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 font-bold text-foreground">
                            <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs">
                              {pos.level}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-foreground">{pos.name}</div>
                          {pos.description && <div className="text-[11px] text-muted-foreground">{pos.description}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-primary">{pos.code}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs"
                            style={{ backgroundColor: pos.color, color: pos.textColor || '#FFFFFF' }}
                          >
                            <Award className="h-3.5 w-3.5" />
                            <span>{pos.name}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-foreground font-bold text-[11px]">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{pos.totalEmployees} Assigned</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleTogglePosStatus(pos)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-transform active:scale-95 ${
                              pos.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}
                          >
                            {pos.status === 'ACTIVE' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            <span>{pos.status}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              disabled={idx === 0}
                              onClick={() => handleMovePosLevel(idx, 'UP')}
                              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 cursor-pointer"
                              title="Move Level Up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              disabled={idx === filteredPositions.length - 1}
                              onClick={() => handleMovePosLevel(idx, 'DOWN')}
                              className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-30 cursor-pointer"
                              title="Move Level Down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenPosModal(pos)}
                              className="p-1.5 rounded-lg border border-border hover:bg-muted text-primary cursor-pointer"
                              title="Edit Position"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePos(pos)}
                              className="p-1.5 rounded-lg border border-border hover:bg-red-500/10 text-red-500 cursor-pointer"
                              title="Delete Position (Only inactive with 0 employees)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/60 shadow-sm">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">Organization Departments</h3>
              <p className="text-xs text-muted-foreground font-medium">Manage organization departments, members, and department heads.</p>
            </div>
            <button
              onClick={() => {
                setMasterForm({ name: '', code: '', description: '' });
                setMasterModal({ open: true, type: 'DEPARTMENT', data: null });
              }}
              className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold cursor-pointer transition-all shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Department</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayDepartments.map(dept => (
              <div
                key={dept.id}
                onClick={() => openManageDepartmentModal(dept)}
                className="p-5 rounded-2xl border border-border/60 bg-card space-y-3 shadow-xs hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span>{dept.name}</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{dept.code}</span>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>{dept._count?.users || dept.users?.length || 0} Members</span>
                  </span>
                  <span className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] font-extrabold">Active</span>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-primary pt-1 group-hover:translate-x-1 transition-transform">
                  <span>Manage Department & Members</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BRANCHES */}
      {activeTab === 'branches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/60 shadow-sm">
            <h3 className="text-sm font-extrabold text-foreground">Office Locations & Branches</h3>
            <button
              onClick={() => {
                setMasterForm({ name: '', code: '', city: 'Bangalore' });
                setMasterModal({ open: true, type: 'BRANCH', data: null });
              }}
              className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-white px-4 py-2 text-xs font-bold cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Branch</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {treeData?.branches?.map(b => (
              <div key={b.id} className="p-5 rounded-2xl border border-border/60 bg-card space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-foreground">{b.name}</span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">{b.code}</span>
                </div>
                <div className="text-xs text-muted-foreground font-medium">City: {b.city || 'Bangalore'}, India</div>
                <div className="pt-2 border-t border-border/40 text-[11px] font-bold text-muted-foreground">
                  Assigned Staff: {b._count?.users || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* CREATE / EDIT POSITION MODAL */}
      <AnimatePresence>
        {posModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">
                      {editingPos ? 'Edit Position' : 'Create Custom Position'}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">Configure hierarchy level, code, and badge design</p>
                  </div>
                </div>
                <button onClick={() => setPosModalOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSavePos} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Position Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Engineer"
                      value={posForm.name}
                      onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-muted/30 focus:bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Position Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. POS-SNR"
                      value={posForm.code}
                      onChange={(e) => setPosForm({ ...posForm, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-border bg-muted/30 focus:bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Hierarchy Level (1..N) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={posForm.level}
                      onChange={(e) => setPosForm({ ...posForm, level: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-border bg-muted/30 focus:bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Badge Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={posForm.color}
                        onChange={(e) => setPosForm({ ...posForm, color: e.target.value })}
                        className="h-8 w-12 rounded cursor-pointer border border-border"
                      />
                      <span className="text-xs font-mono font-bold text-muted-foreground">{posForm.color}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Responsibilities and rank description..."
                    value={posForm.description}
                    onChange={(e) => setPosForm({ ...posForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-muted/30 focus:bg-background"
                  />
                </div>

                {/* Badge Preview */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Badge Live Preview</span>
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm"
                      style={{ backgroundColor: posForm.color, color: posForm.textColor }}
                    >
                      <Award className="h-4 w-4" />
                      <span>{posForm.name || 'Position Preview'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => setPosModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md cursor-pointer"
                  >
                    {editingPos ? 'Save Changes' : 'Create Position'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MASTER CREATION MODAL (ADD DEPARTMENT) */}
      <AnimatePresence>
        {masterModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-left max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-sm font-extrabold text-foreground">Add New Department</h3>
                <button onClick={() => setMasterModal({ open: false, type: '', data: null })} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMaster} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quality Assurance"
                    value={masterForm.name}
                    onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Department Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. QA"
                    value={masterForm.code}
                    onChange={(e) => setMasterForm({ ...masterForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-border bg-background"
                  />
                </div>

                {/* Member Assignment Section (Unassigned Users Only) */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-muted-foreground font-bold">Assign Members</span>
                    <span className="text-[10px] text-primary font-bold">
                      {treeData?.unassignedUsers?.length || 0} Available
                    </span>
                  </div>

                  {(!treeData?.unassignedUsers || treeData.unassignedUsers.length === 0) ? (
                    <div className="p-4 text-center bg-muted/20 rounded-2xl border border-dashed border-border/60 space-y-1">
                      <p className="text-xs font-bold text-foreground">No unassigned members available.</p>
                      <p className="text-[11px] text-muted-foreground">All users are already assigned to departments.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search members by name, employee ID, role..."
                          value={createDeptSearchQuery}
                          onChange={(e) => setCreateDeptSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-xl border border-border/60 bg-muted/20"
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 border border-border/40 p-2 rounded-xl bg-muted/20">
                        {treeData.unassignedUsers
                          .filter(u => {
                            const q = createDeptSearchQuery.toLowerCase();
                            return (u.name || '').toLowerCase().includes(q) ||
                                   (u.email || '').toLowerCase().includes(q) ||
                                   (u.employeeId || '').toLowerCase().includes(q) ||
                                   (u.role || '').toLowerCase().includes(q);
                          })
                          .map(u => {
                            const isSelected = selectedUserIdsForNewDept.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                  isSelected ? 'bg-primary/10 border-primary/40 shadow-xs' : 'bg-card border-border/40 hover:bg-muted/40'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedUserIdsForNewDept(prev => [...prev, u.id]);
                                      } else {
                                        setSelectedUserIdsForNewDept(prev => prev.filter(id => id !== u.id));
                                      }
                                    }}
                                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                  />
                                  <UserAvatar user={u} className="h-8 w-8" />
                                  <div>
                                    <p className="text-xs font-bold text-foreground">{u.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono font-semibold">{u.employeeId || 'No ID'}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  {u.role || u.position?.name}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setMasterModal({ open: false, type: '', data: null });
                      setSelectedUserIdsForNewDept([]);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md">
                    Create Department
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SINGLE-PAGE DEPARTMENT MANAGEMENT MODAL */}
      <AnimatePresence>
        {selectedDepartment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 text-left max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                    <Briefcase className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">Department Management</h3>
                    <p className="text-xs text-muted-foreground font-medium">Manage department details, assigned staff, and new member additions.</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDepartment(null)}
                  className="p-1 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Section 1 — Department Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Department Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-2xl border border-border/60">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Department Name *</label>
                    <input
                      type="text"
                      required
                      value={editDeptName}
                      onChange={(e) => setEditDeptName(e.target.value)}
                      placeholder="e.g. Software Engineering"
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">Department Code *</label>
                    <input
                      type="text"
                      required
                      value={editDeptCode}
                      onChange={(e) => setEditDeptCode(e.target.value.toUpperCase())}
                      placeholder="e.g. DEPT-ENG"
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 — Assigned Members */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Assigned Members ({stagedAssignedMembers.length})
                  </h4>
                  {stagedAssignedMembers.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filter assigned members..."
                        value={assignedMemberSearch}
                        onChange={(e) => setAssignedMemberSearch(e.target.value)}
                        className="pl-7 pr-2.5 py-1 text-xs font-medium rounded-xl border border-border/60 bg-muted/20 w-48"
                      />
                    </div>
                  )}
                </div>

                {membersLoading ? (
                  <div className="flex h-24 items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : stagedAssignedMembers.length === 0 ? (
                  <div className="p-4 text-center bg-muted/20 rounded-2xl border border-dashed border-border/60">
                    <p className="text-xs font-bold text-foreground">No members assigned to this department.</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Select members from the section below to add them.</p>
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {stagedAssignedMembers
                      .filter(u => {
                        const q = assignedMemberSearch.toLowerCase();
                        return (u.name || '').toLowerCase().includes(q) ||
                               (u.employeeId || '').toLowerCase().includes(q) ||
                               (u.role || '').toLowerCase().includes(q) ||
                               (u.position?.name || '').toLowerCase().includes(q);
                      })
                      .map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-card hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={u} className="h-8 w-8" />
                            <div>
                              <p className="text-xs font-bold text-foreground">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground">{u.employeeId || 'No ID'} • <span className="font-semibold text-primary">{u.role}</span></p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {u.position?.name || u.role}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStagedMember(u)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                              title="Remove member (moves to Add Members list below)"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Section 3 — Add Members */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Add Members
                  </h4>
                  <span className="text-[10px] font-bold text-primary">
                    {stagedUnassignedMembers.length} Available
                  </span>
                </div>

                {stagedUnassignedMembers.length === 0 ? (
                  <div className="p-4 text-center bg-muted/20 rounded-2xl border border-dashed border-border/60">
                    <p className="text-xs font-bold text-foreground">No unassigned members available.</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">All users are currently assigned to departments.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search unassigned members by name, employee ID, role..."
                        value={addMemberSearch}
                        onChange={(e) => setAddMemberSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-xl border border-border/60 bg-muted/20"
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 border border-border/40 p-2 rounded-xl bg-muted/20">
                      {stagedUnassignedMembers
                        .filter(u => {
                          const q = addMemberSearch.toLowerCase();
                          return (u.name || '').toLowerCase().includes(q) ||
                                 (u.employeeId || '').toLowerCase().includes(q) ||
                                 (u.role || '').toLowerCase().includes(q) ||
                                 (u.position?.name || '').toLowerCase().includes(q);
                        })
                        .map(u => (
                          <div
                            key={u.id}
                            onClick={() => handleAddStagedMember(u)}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-card hover:bg-primary/10 hover:border-primary/40 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => {}}
                                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                              />
                              <UserAvatar user={u} className="h-8 w-8" />
                              <div>
                                <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono font-semibold">{u.employeeId || 'No ID'}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {u.role || u.position?.name}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4 — Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={handleDeleteDepartmentClick}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Department</span>
                </button>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDepartment(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={handleSaveAllDeptChanges}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saveLoading ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE DEPARTMENT CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Delete Department</h3>
                  <p className="text-xs text-muted-foreground font-medium">Reassignment Confirmation</p>
                </div>
              </div>

              <div className="space-y-3 bg-muted/20 p-4 rounded-2xl border border-border/60 text-xs font-medium text-foreground">
                <p className="font-extrabold text-foreground">
                  This department contains {deleteConfirmModal.memberCount} member(s).
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  If you continue, all members in this department will be moved to <strong className="text-primary font-bold">Unassigned</strong>.
                </p>
                <p className="font-bold text-foreground pt-1">
                  Do you want to continue?
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal({ open: false, dept: null, memberCount: 0 })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => executeDeleteDepartment(deleteConfirmModal.dept.id)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{saveLoading ? 'Deleting...' : 'Delete & Move Members'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default OrganizationManager;
