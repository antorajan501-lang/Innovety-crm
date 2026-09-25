import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Clock, X, AlertCircle, RefreshCw,
  ArrowRightLeft, Zap, Calendar, User, Check
} from 'lucide-react';
import api from '../../services/api';

const STATUS_CONFIG = {
  PENDING_TL_APPROVAL: { label: 'Pending TL', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  PENDING_ADMIN_APPROVAL: { label: 'Pending Admin', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  REJECTED: { label: 'Rejected', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' }
};

const ShiftApprovalsModal = ({
  isOpen,
  onClose,
  organizationId,
  onSuccess
}) => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reviewModal, setReviewModal] = useState(null); // { approval, action }
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApprovals = async () => {
    if (!isOpen || !organizationId) return;
    try {
      setLoading(true);
      const res = await api.get('/workforce/approvals', {
        params: {
          organizationId,
          status: statusFilter === 'ALL' ? undefined : statusFilter
        }
      });
      if (res.data?.success) {
        setApprovals(res.data.approvals || []);
      }
    } catch (err) {
      console.error('[ShiftApprovalsModal] Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [isOpen, organizationId, statusFilter]);

  const handleReviewSubmit = async () => {
    if (!reviewModal) return;
    try {
      setSubmitting(true);
      await api.put(`/workforce/approvals/${reviewModal.approval.id}/review`, {
        action: reviewModal.action,
        note: reviewNote.trim() || undefined
      });
      setReviewModal(null);
      setReviewNote('');
      fetchApprovals();
      if (onSuccess) {
        onSuccess(`Shift request ${reviewModal.action.toLowerCase()}d successfully.`);
      }
    } catch (err) {
      console.error('[ShiftApprovalsModal] Review error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl rounded-3xl border border-border/70 bg-card p-6 shadow-2xl space-y-5 text-left my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                Shift Approvals Workflow
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Review and decide shift swap, temporary override, and holiday coverage requests.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-muted/30 p-1.5 rounded-xl border border-border/50 text-xs font-bold w-fit">
          {['ALL', 'PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-card text-foreground shadow-xs font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'PENDING_TL_APPROVAL' ? 'Pending TL' : st === 'PENDING_ADMIN_APPROVAL' ? 'Pending Admin' : st === 'APPROVED' ? 'Approved' : 'Rejected'}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
              Loading requests...
            </div>
          ) : approvals.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-foreground">No pending requests</p>
              <p className="mt-0.5">All scheduling approval workflows have been processed.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {approvals.map(appr => {
                const cfg = STATUS_CONFIG[appr.status] || { label: appr.status, color: 'bg-muted text-muted-foreground' };
                const isPending = ['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(appr.status);

                return (
                  <div key={appr.id} className="p-4 hover:bg-muted/10 transition-colors space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-foreground">
                            {appr.requester?.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({appr.requester?.employeeId} • {appr.requester?.department || 'General'})
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-foreground/90 flex items-center gap-2">
                          <span className="text-primary font-black uppercase text-[11px]">
                            {appr.requestType.replace(/_/g, ' ')}
                          </span>
                          <span>•</span>
                          <span className="text-muted-foreground font-medium">
                            "{appr.reason || 'No reason specified'}"
                          </span>
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setReviewModal({ approval: appr, action: 'REJECT' });
                              setReviewNote('');
                            }}
                            className="px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-600 hover:bg-rose-500/10 text-xs font-bold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setReviewModal({ approval: appr, action: 'APPROVE' });
                              setReviewNote('');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Details Payload */}
                    {appr.details && (
                      <div className="p-2.5 rounded-xl bg-muted/20 border border-border/50 text-[11px] font-mono text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {appr.details.targetDate && (
                          <span>Target Date: <strong className="text-foreground">{appr.details.targetDate}</strong></span>
                        )}
                        {appr.details.startDate && (
                          <span>From: <strong className="text-foreground">{appr.details.startDate}</strong> to <strong className="text-foreground">{appr.details.endDate}</strong></span>
                        )}
                        {appr.details.swapWithUserId && (
                          <span>Swap Partner: <strong className="text-foreground">{appr.details.swapWithUserId}</strong></span>
                        )}
                      </div>
                    )}

                    {/* Timeline Notes */}
                    {(appr.tlNote || appr.adminNote) && (
                      <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1">
                        {appr.tlNote && <div><strong className="text-foreground">TL Note:</strong> {appr.tlNote}</div>}
                        {appr.adminNote && <div><strong className="text-foreground">Admin Note:</strong> {appr.adminNote}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Review Action Dialog */}
        <AnimatePresence>
          {reviewModal && (
            <div className="fixed inset-0 z-60 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 text-left"
              >
                <div className="space-y-1 text-center">
                  <h3 className="text-base font-extrabold text-foreground">
                    {reviewModal.action === 'APPROVE' ? 'Confirm Approval' : 'Decline Request'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {reviewModal.action === 'APPROVE'
                      ? 'Approving this request will activate the schedule update in the system.'
                      : 'Please provide a brief reason for rejecting this request.'}
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-bold text-foreground block">Review Note</label>
                  <textarea
                    rows={3}
                    placeholder="Optional note / rationale..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-muted/20 font-medium focus:bg-background outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setReviewModal(null)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted border border-border cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReviewSubmit}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold text-white shadow-md cursor-pointer flex items-center justify-center gap-1.5 ${
                      reviewModal.action === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {submitting && <RefreshCw className="h-3 w-3 animate-spin" />}
                    <span>Confirm {reviewModal.action}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ShiftApprovalsModal;
