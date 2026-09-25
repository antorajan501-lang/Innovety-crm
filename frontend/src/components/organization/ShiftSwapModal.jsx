import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRightLeft, Calendar, User, Clock, AlertCircle,
  CheckCircle2, RefreshCw, ArrowRight
} from 'lucide-react';
import api from '../../services/api';

const ShiftSwapModal = ({
  isOpen,
  onClose,
  organizationId,
  onSuccess
}) => {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [userAId, setUserAId] = useState('');
  const [userBId, setUserBId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('Peer schedule swap request');

  const [previewA, setPreviewA] = useState(null);
  const [previewB, setPreviewB] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setDate(tomorrow.toISOString().split('T')[0]);
      setUserAId('');
      setUserBId('');
      setReason('Peer schedule swap request');
      setError(null);
      setPreviewA(null);
      setPreviewB(null);
    }
  }, [isOpen]);

  // Load preview of current shifts on selected date
  useEffect(() => {
    if (userAId && userBId && date && userAId !== userBId) {
      setLoadingPreview(true);
      api.get('/schedules/day', {
        params: { organizationId, date }
      })
        .then((res) => {
          if (res.data?.roster) {
            const rA = res.data.roster.find(r => r.userId === userAId);
            const rB = res.data.roster.find(r => r.userId === userBId);
            setPreviewA(rA);
            setPreviewB(rB);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPreview(false));
    } else {
      setPreviewA(null);
      setPreviewB(null);
    }
  }, [userAId, userBId, date, organizationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userAId || !userBId || !date) return;
    if (userAId === userBId) {
      setError('Cannot swap shifts between the same employee.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/schedules/swap', {
        organizationId,
        userAId,
        userBId,
        date,
        reason
      });
      if (res.data?.success) {
        onSuccess(res.data.message || 'Shifts swapped successfully.');
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to swap shifts.');
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
          className="w-full max-w-xl rounded-3xl border border-border/70 bg-card p-6 sm:p-7 shadow-2xl space-y-5 text-left my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Shift Swap</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Swap shifts between two employees for a designated working day.
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
            {/* Target Date */}
            <div className="space-y-1">
              <label className="font-bold text-foreground block">Target Swap Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-bold text-foreground focus:bg-background outline-none cursor-pointer"
              />
            </div>

            {/* Employee Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-foreground block">First Employee (A) *</label>
                <select
                  required
                  value={userAId}
                  onChange={(e) => setUserAId(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 font-semibold text-foreground focus:bg-background outline-none cursor-pointer"
                >
                  <option value="">-- Choose Employee A --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} disabled={emp.id === userBId}>
                      {emp.name} ({emp.employeeId || emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground block">Second Employee (B) *</label>
                <select
                  required
                  value={userBId}
                  onChange={(e) => setUserBId(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/20 px-3 py-2 font-semibold text-foreground focus:bg-background outline-none cursor-pointer"
                >
                  <option value="">-- Choose Employee B --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} disabled={emp.id === userAId}>
                      {emp.name} ({emp.employeeId || emp.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Dual Swap Preview */}
            {previewA && previewB && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-3">
                <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Shift Swap Preview for {date}</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Both Employees Reassigned</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Anto's change */}
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                    <div className="font-black text-xs text-foreground">{previewA.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Current: <span className="font-bold text-foreground">{previewA.shiftName}</span> ({previewA.startTime} – {previewA.endTime})
                    </div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-1 border-t border-border/40">
                      <span>Will Receive:</span>
                      <span className="font-black">{previewB.shiftName}</span>
                      <span>({previewB.startTime} – {previewB.endTime})</span>
                    </div>
                  </div>

                  {/* Praveen's change */}
                  <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5">
                    <div className="font-black text-xs text-foreground">{previewB.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Current: <span className="font-bold text-foreground">{previewB.shiftName}</span> ({previewB.startTime} – {previewB.endTime})
                    </div>
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 pt-1 border-t border-border/40">
                      <span>Will Receive:</span>
                      <span className="font-black">{previewA.shiftName}</span>
                      <span>({previewA.startTime} – {previewA.endTime})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1">
              <label className="font-bold text-foreground block">Swap Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Schedule accommodation, mutual agreement"
                className="w-full rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2 font-semibold text-foreground focus:bg-background outline-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

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
                disabled={submitting || !userAId || !userBId || userAId === userBId}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm &amp; Swap Shifts</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShiftSwapModal;
