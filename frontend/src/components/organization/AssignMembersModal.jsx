import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, CheckSquare, Square, X, Check, Building2,
  Briefcase, AlertCircle, RefreshCw, UserCheck, ShieldCheck,
  ChevronDown, Filter, HelpCircle
} from 'lucide-react';
import api, { getUploadUrl } from '../../services/api';

// Helper to convert 24h HH:mm to 12h format
const format12Hour = (timeStr) => {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${mStr || '00'} ${period}`;
};

/**
 * EmployeeAvatar Component
 * Resolves avatar image URLs (relative & absolute) with onError fallback.
 * If image is missing or fails to load, displays a circular avatar with
 * the employee's initial in mint/teal styling (44px size).
 */
const EmployeeAvatar = ({ user }) => {
  const [imgError, setImgError] = useState(false);

  const rawSrc = user?.profileImage || user?.profilePhoto || user?.profilePic || user?.avatar || user?.avatarUrl;
  const initial = user?.name?.trim() ? user.name.trim().charAt(0).toUpperCase() : 'U';

  const formattedSrc = useMemo(() => {
    if (!rawSrc || typeof rawSrc !== 'string') return null;
    return getUploadUrl(rawSrc);
  }, [rawSrc]);

  useEffect(() => {
    setImgError(false);
  }, [rawSrc]);

  if (formattedSrc && !imgError) {
    return (
      <div className="h-11 w-11 rounded-full overflow-hidden bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
        <img
          src={formattedSrc}
          alt={user.name || 'Employee'}
          className="h-full w-full object-cover rounded-full"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="h-11 w-11 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-black text-sm flex items-center justify-center shrink-0 uppercase select-none shadow-xs"
      title={user.name || 'Employee'}
    >
      <span>{initial}</span>
    </div>
  );
};

const AssignMembersModal = ({
  isOpen,
  onClose,
  shift,
  company,
  onSuccess
}) => {
  // State
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load departments and users when modal opens
  useEffect(() => {
    if (!isOpen || !shift || !company?.id) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // Fetch company users & company departments in parallel
        const [usersRes, deptsRes] = await Promise.all([
          api.get('/users', {
            params: {
              organizationId: company.id,
              limit: 1000,
              status: 'ACTIVE'
            }
          }),
          api.get('/organization/departments', {
            params: { organizationId: company.id }
          })
        ]);

        if (!isMounted) return;

        // Extract users
        const fetchedUsers = usersRes.data?.users || (Array.isArray(usersRes.data) ? usersRes.data : []);
        setUsers(fetchedUsers);

        // Extract departments
        const fetchedDepts = Array.isArray(deptsRes.data) ? deptsRes.data : [];
        setDepartments(fetchedDepts);

        // Pre-populate previously assigned members (Task 8)
        // From shift.members array
        const initialSelected = new Set();
        if (Array.isArray(shift.members)) {
          shift.members.forEach(m => {
            if (m.userId) initialSelected.add(m.userId);
            else if (m.user?.id) initialSelected.add(m.user.id);
          });
        }
        setSelectedUserIds(initialSelected);

      } catch (err) {
        console.error('[AssignMembersModal] Error loading assignment data:', err);
        if (isMounted) {
          setErrorMessage(err.response?.data?.message || 'Failed to load company employees.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, shift, company]);

  // Handle department auto-selection (Task 4: Core Feature)
  const handleDepartmentSelect = (deptName) => {
    setSelectedDeptFilter(deptName);
    if (!deptName) return;

    const lowerDept = deptName.toLowerCase().trim();
    // Find all users belonging to this department
    const matchingUsers = users.filter(u => {
      const userDept = (u.department || u.departmentRef?.name || '').toLowerCase().trim();
      return userDept === lowerDept;
    });

    // Auto-select all matching users immediately
    setSelectedUserIds(prev => {
      const updated = new Set(prev);
      matchingUsers.forEach(u => updated.add(u.id));
      return updated;
    });
  };

  // Toggle single user checkbox (Task 5: Individual Overrides)
  const handleToggleUser = (userId) => {
    setSelectedUserIds(prev => {
      const updated = new Set(prev);
      if (updated.has(userId)) {
        updated.delete(userId);
      } else {
        updated.add(userId);
      }
      return updated;
    });
  };

  // Filtered users by Search & Department filter (Task 10)
  const filteredUsers = useMemo(() => {
    let list = users;

    if (selectedDeptFilter) {
      const lowerDept = selectedDeptFilter.toLowerCase().trim();
      list = list.filter(u => {
        const userDept = (u.department || u.departmentRef?.name || '').toLowerCase().trim();
        return userDept === lowerDept;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q) ||
        u.departmentRef?.name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [users, search, selectedDeptFilter]);

  // Quick action: Select All visible/filtered users (Task 6)
  const handleSelectAll = () => {
    setSelectedUserIds(prev => {
      const updated = new Set(prev);
      filteredUsers.forEach(u => updated.add(u.id));
      return updated;
    });
  };

  // Quick action: Clear All (Task 6)
  const handleClearAll = () => {
    setSelectedUserIds(new Set());
  };

  // Save Flow (Task 7)
  const handleSaveSubmit = (e) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!shift?.id || !company?.id) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const userIdsArray = Array.from(selectedUserIds);
      const res = await api.post(`/shifts/${shift.id}/members`, {
        userIds: userIdsArray,
        organizationId: company.id
      });

      if (res.data?.success) {
        setShowConfirm(false);
        window.dispatchEvent(new CustomEvent('shift_updated', {
          detail: { shiftId: shift.id, organizationId: company.id, userIds: userIdsArray }
        }));
        if (onSuccess) {
          onSuccess(`Successfully assigned ${userIdsArray.length} member(s) to "${shift.name}".`);
        }
        onClose();
      }
    } catch (err) {
      console.error('[AssignMembersModal] Error assigning members:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to save shift member assignments.');
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-2xl rounded-3xl border border-border/70 bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-left"
      >
        {/* 1. FIXED HEADER */}
        <div className="px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-4 border-b border-border/50 shrink-0 bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shadow-inner shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2 truncate">
                    <span>Assign Members:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 truncate">{shift?.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-2 flex-wrap">
                    <span>
                      {shift?.startTime} – {shift?.endTime} ({format12Hour(shift?.startTime)} – {format12Hour(shift?.endTime)})
                    </span>
                    <span>•</span>
                    <span>{shift?._count?.members ?? (shift?.members?.length || 0)} currently assigned</span>
                  </p>
                </div>
              </div>

              {/* Current Company Scope Badge (Task 3) */}
              <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Company Scope:</span>
                <span className="text-foreground px-2 py-0.5 rounded-lg bg-muted/60 border border-border/50 truncate">
                  {company?.name || 'Current Organization'} ({company?.companyCode || 'Active'})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-7 sm:py-5 space-y-4">
          {/* ERROR BANNER */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-bold flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="cursor-pointer hover:opacity-75">✕</button>
            </div>
          )}

          {/* CONTROLS BAR: DEPARTMENT SELECTOR & SEARCH (Task 4, 5, 10) */}
          <div className="space-y-3 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Department Dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Department Auto-Select *</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedDeptFilter}
                    onChange={(e) => handleDepartmentSelect(e.target.value)}
                    className="w-full pl-3.5 pr-8 py-2 text-xs font-bold rounded-2xl border border-border/70 bg-muted/30 text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer appearance-none truncate"
                  >
                    <option value="">Select a Department to Auto-Check...</option>
                    {departments.map((dept) => (
                      <option key={dept.id || dept.name} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Employee Search Bar */}
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Search Employees</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, or department..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 text-xs font-medium rounded-2xl border border-border/70 bg-muted/30 focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons & Live Counter */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-xl bg-muted/50 hover:bg-muted font-bold text-foreground transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Select All ({filteredUsers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-xl bg-muted/50 hover:bg-muted font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>

                {selectedDeptFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedDeptFilter('')}
                    className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 font-extrabold text-[10px] flex items-center gap-1 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <span>Filter: {selectedDeptFilter}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Live Counter Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span>{selectedUserIds.size} Members Selected</span>
              </div>
            </div>
          </div>

          {/* EMPLOYEE LIST */}
          <div className="min-h-[220px] max-h-[380px] overflow-y-auto border border-border/60 rounded-2xl bg-muted/10 divide-y divide-border/40">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                <RefreshCw className="h-7 w-7 animate-spin text-emerald-600" />
                <span className="text-xs font-bold">Loading organization employees...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <Users className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-xs font-bold">No employees found matching your filter.</p>
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Clear search query
                  </button>
                )}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUserIds.has(user.id);
                const userDept = user.department || user.departmentRef?.name || 'General';

                return (
                  <div
                    key={user.id}
                    onClick={() => handleToggleUser(user.id)}
                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12]' : 'hover:bg-muted/40'
                    }`}
                  >
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar with image & initials fallback */}
                      <EmployeeAvatar user={user} />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs text-foreground tracking-tight truncate">
                            {user.name}
                          </span>
                          <span className="text-[10px] font-black font-mono text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/60">
                            {user.employeeId || 'ID: --'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium pt-0.5">
                          <span className="truncate max-w-[160px] sm:max-w-[200px]">{user.email}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[140px] sm:max-w-[180px]">{userDept}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Custom Checkbox */}
                    <div className="shrink-0 pr-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleUser(user.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 rounded-lg border-border/80 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DEFAULT SHIFT NOTICE */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs shrink-0">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-[11px] leading-relaxed">
              <span className="font-bold">Default Shift Protection:</span> Unselected employees will automatically remain in or return to the Company Default shift. Each employee retains exactly one active shift.
            </p>
          </div>
        </div>

        {/* 3. STICKY FOOTER */}
        <div className="px-5 py-4 sm:px-7 sm:py-5 border-t border-border/50 bg-card sticky bottom-0 shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground font-semibold">
            {selectedUserIds.size} of {users.length} total employees selected
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Assignment</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* CONFIRMATION MODAL (Task 7) */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-60 overflow-y-auto bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-foreground">
                  Assign {shift?.name}?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Assign <strong className="text-foreground">{shift?.name}</strong> to <strong className="text-emerald-600">{selectedUserIds.size}</strong> members?
                  Unchecked members will automatically be moved to Company Default shift.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer border border-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmSave}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirm &amp; Assign</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssignMembersModal;
