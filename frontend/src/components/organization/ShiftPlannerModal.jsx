import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Clock, Sparkles, User, AlertCircle,
  CheckCircle2, RefreshCw, Info, ShieldCheck
} from 'lucide-react';
import api from '../../services/api';

const ShiftPlannerModal = ({
  isOpen,
  onClose,
  organizationId,
  shifts = [],
  onSuccess
}) => {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState(null);

  const [formData, setFormData] = useState({
    userId: '',
    shiftId: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Fetch company employees
  useEffect(() => {
    if (isOpen && organizationId) {
      setLoadingEmployees(true);
      api.get('/users', {
        params: { organizationId, limit: 1000 }
      })
        .then((res) => {
          if (res.data?.users) {
            setEmployees(res.data.users.filter(u => u.status === 'ACTIVE'));
          }
        })
        .catch((err) => console.warn('Error fetching employees:', err))
        .finally(() => setLoadingEmployees(false));
    }
  }, [isOpen, organizationId]);

  // Reset form
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

      setFormData({
        userId: '',
        shiftId: shifts[0]?.id || '',
        startDate: nextWeek.toISOString().split('T')[0],
        endDate: twoWeeks.toISOString().split('T')[0],
        reason: ''
      });
      setConflictWarning(null);
    }
  }, [isOpen, shifts]);

  // Conflict checking
  useEffect(() => {
    if (formData.userId && formData.startDate && formData.endDate) {
      api.post('/schedules/check-conflict', {
        organizationId,
        userId: formData.userId,
        startDate: formData.startDate,
        endDate: formData.endDate
      })
        .then((res) => {
          if (res.data?.hasConflict) {
            setConflictWarning(res.data.message);
          } else {
            setConflictWarning(null);
          }
        })
        .catch(() => {});
    }
  }, [formData.userId, formData.startDate, formData.endDate, organizationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || !formData.shiftId || !formData.startDate || !formData.endDate) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/schedules/plan', {
        organizationId,
        ...formData
      });
      if (res.data?.success) {
        onSuccess(res.data.message || 'Shift planned successfully.');
        onClose();
      }
    } catch (err) {
      setConflictWarning(err.response?.data?.message || 'Failed to plan shift.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-2xl space-y-5 text-left my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Future Shift Planner</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Plan shifts for future date ranges. Automatically reverts after the end date.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Employee Selector */}
            <div className="space-y-1">
              <label className="font-bold text-foreground block">Select Employee *</label>
              <select
                required
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-semibold text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
              >
                <option value="">-- Choose Employee --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.departmentRef?.name || emp.department || 'General'} - {emp.employeeId || emp.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Shift Selector */}
            <div className="space-y-1">
              <label className="font-bold text-foreground block">Planned Future Shift *</label>
              <select
                required
                value={formData.shiftId}
                onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-semibold text-foreground focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
              >
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime} – {s.endTime})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground block">Start Date *</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 font-bold text-foreground focus:bg-background outline-none cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground block">End Date *</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 font-bold text-foreground focus:bg-background outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Reason / Notes */}
            <div className="space-y-1">
              <label className="font-bold text-foreground block">Planning Reason / Sprint *</label>
              <input
                type="text"
                placeholder="e.g. Q4 Night Sprint, Go-Live Release, Weekend Rollout"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-semibold text-foreground focus:bg-background outline-none"
              />
            </div>

            {/* Conflict Alert */}
            {conflictWarning && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{conflictWarning}</span>
              </div>
            )}

            {/* Auto Revert Explainer */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="font-black">Automatic Revert Guaranteed:</span>
                <span className="ml-1 opacity-90">
                  On the day after the end date, the employee automatically returns to their permanent shift assignment. No manual rollback required.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2.5 border-t border-border/50 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || Boolean(conflictWarning)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Plan Shift</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShiftPlannerModal;
