import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  X,
  Briefcase,
  UserCheck,
  Building2,
  Award,
  Calendar,
  FileText,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import api from '../../services/api';
import UserAvatar from './UserAvatar';

const PromoteUserModal = ({ isOpen, onClose, user, onSuccess }) => {
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [eligibleManagers, setEligibleManagers] = useState([]);

  const [targetPositionId, setTargetPositionId] = useState('');
  const [targetDeptId, setTargetDeptId] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Target role determination (Sequential: INTERN -> EMPLOYEE -> TEAM_LEADER -> ADMIN)
  const getTargetRole = (currentRole) => {
    switch (currentRole) {
      case 'INTERN':
        return 'EMPLOYEE';
      case 'EMPLOYEE':
        return 'TEAM_LEADER';
      case 'TEAM_LEADER':
        return 'ADMIN';
      default:
        return 'EMPLOYEE';
    }
  };

  const targetRole = user ? getTargetRole(user.role) : 'EMPLOYEE';

  // Preview converted Employee ID (IN-1001 -> EMP-1001)
  const getTargetEmployeeIdPreview = (currentId, tRole) => {
    const prefix = tRole === 'EMPLOYEE' ? 'EMP' : tRole === 'TEAM_LEADER' ? 'TL' : tRole === 'ADMIN' ? 'AD' : 'IN';
    if (!currentId) return `${prefix}-1001`;
    const match = currentId.match(/^(IN|EMP|EM|TL|AD|USR|EMP-)?[-_]?(\d+)$/i);
    if (match && match[2]) {
      return `${prefix}-${match[2]}`;
    }
    return `${prefix}-${currentId}`;
  };

  const targetEmployeeIdPreview = user ? getTargetEmployeeIdPreview(user.employeeId, targetRole) : '';

  useEffect(() => {
    if (!isOpen || !user) return;

    setTargetPositionId('');
    setTargetDeptId(user.departmentId || '');
    setReportingManagerId(user.reportingManagerId || '');
    setReason('');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setErrorMsg('');

    const fetchData = async () => {
      try {
        const [posRes, treeRes, usersRes] = await Promise.all([
          api.get('/positions').catch(() => ({ data: [] })),
          api.get('/organization/tree').catch(() => ({ data: {} })),
          api.get('/users').catch(() => ({ data: { users: [] } }))
        ]);

        setPositions(posRes.data || []);
        setDepartments(treeRes.data?.departments || []);

        const allUsers = usersRes.data?.users || usersRes.data || [];
        const managers = allUsers.filter(u =>
          u.id !== user.id &&
          u.status !== 'INACTIVE' &&
          ['EMPLOYEE', 'TEAM_LEADER', 'ADMIN', 'SUPER_ADMIN'].includes(u.role)
        );
        setEligibleManagers(managers);
      } catch (err) {
        console.error('Error loading promotion dependencies:', err);
      }
    };

    fetchData();
  }, [isOpen, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetPositionId) {
      setErrorMsg('Please select a target position for promotion.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Please enter a reason for the promotion.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const selectedDeptObj = departments.find(d => d.id === targetDeptId);

      const payload = {
        targetRole,
        positionId: targetPositionId,
        departmentId: targetDeptId || null,
        department: selectedDeptObj ? selectedDeptObj.name : user.department,
        reportingManagerId: reportingManagerId || null,
        reason: reason.trim(),
        effectiveDate
      };

      const res = await api.post(`/users/${user.id}/promote`, payload);
      const updatedUser = res.data?.updatedUser || res.data?.user;

      // Broadcast global promotion event for automatic UI registry & dashboard updates
      window.dispatchEvent(new CustomEvent('crm-user-promoted', { detail: updatedUser }));

      if (onSuccess) {
        onSuccess(updatedUser, res.data?.message || `User ${user.name} promoted successfully to ${targetRole}!`);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to promote user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 text-left max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <span>Promote User</span>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Promote employee through organizational hierarchy preserving user history.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Preview & Target Role Card */}
          <div className="bg-muted/20 p-4 rounded-2xl border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar user={user} className="h-10 w-10" />
                <div>
                  <h4 className="text-sm font-black text-foreground">{user.name}</h4>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-extrabold text-muted-foreground block">{user.employeeId}</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Current: {user.role}
                </span>
              </div>
            </div>

            {/* Role Transition Visual */}
            <div className="flex items-center justify-between pt-3 border-t border-border/40">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-muted text-muted-foreground border border-border/60">
                  {user.role}
                </span>
                <ArrowRight className="h-4 w-4 text-primary animate-pulse" />
                <span className="px-3 py-1 rounded-xl text-xs font-black bg-primary text-white shadow-sm">
                  {targetRole}
                </span>
              </div>

              <div className="text-right font-mono text-xs font-extrabold text-primary">
                ID Preview: <span className="underline">{targetEmployeeIdPreview}</span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Position */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-primary" />
                  <span>Target Position *</span>
                </label>
                <select
                  required
                  value={targetPositionId}
                  onChange={(e) => setTargetPositionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-border bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="">Select Target Position...</option>
                  {positions
                    .filter(p => p.status !== 'INACTIVE')
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>Department</span>
                </label>
                <select
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="">Maintain / Select Department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Reporting Manager */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  <span>Reporting Manager</span>
                </label>
                <select
                  value={reportingManagerId}
                  onChange={(e) => setReportingManagerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background cursor-pointer focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <option value="">Select Reporting Manager...</option>
                  {eligibleManagers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.employeeId} - {m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Effective Date *</span>
                </label>
                <input
                  type="date"
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            {/* Promotion Reason */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Promotion Reason & Justification *</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Completed internship with distinction; demonstrated strong technical leadership and project delivery..."
                className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                <TrendingUp className="h-4 w-4" />
                <span>{loading ? 'Promoting User...' : `Confirm Promotion to ${targetRole}`}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PromoteUserModal;
