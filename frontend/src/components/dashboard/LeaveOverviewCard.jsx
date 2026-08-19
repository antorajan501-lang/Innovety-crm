import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, Clock, Check, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../common/UserAvatar';

const LeaveOverviewCard = ({
  title,
  subtitle,
  leaves: initialLeaves,
  teamMembers,
  onRefresh
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaveList, setLeaveList] = useState(Array.isArray(initialLeaves) ? initialLeaves : []);
  const [activeIndex, setActiveIndex] = useState(0);

  // Quick Action Modal State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: 'APPROVE', // 'APPROVE' | 'REJECT'
    request: null,
    remarks: '',
    submitting: false,
    error: null
  });

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leaves');
      const data = Array.isArray(res.data) ? res.data : (res.data?.leaves || []);
      setLeaveList(data);
    } catch (e) {
      console.error('Failed to refresh leave overview stats:', e);
    }
  };

  useEffect(() => {
    if (Array.isArray(initialLeaves)) {
      setLeaveList(initialLeaves);
    }
  }, [initialLeaves]);

  useEffect(() => {
    fetchLeaves();
    const interval = setInterval(fetchLeaves, 4000);
    return () => clearInterval(interval);
  }, []);

  // Role permissions
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isTL = user?.role === 'TEAM_LEADER';

  // Target route for View All & Review action
  const viewAllRoute = isTL ? '/leaves?tab=Sanction' : '/leave-management?tab=Sanction';

  // Actionable Pending Leave Requests (Single Source of Truth matching Sanction Approval Queue)
  const pendingRequests = useMemo(() => {
    return leaveList.filter(l => {
      if (!l) return false;

      // Self-approval prevention: exclude user's own leave requests from their approval queue
      const isSelf = l.userId === user?.id || l.user?.id === user?.id;
      if (isSelf) return false;

      // If teamMembers array is passed (e.g. TL scope), ensure request user is in team
      if (Array.isArray(teamMembers) && teamMembers.length > 0) {
        const teamUserIds = new Set(teamMembers.map(m => m.id || m.userId));
        const reqUserId = l.userId || l.user?.id;
        if (!teamUserIds.has(reqUserId)) return false;
      }

      // Single Source of Truth for Pending Statuses
      if (isAdmin || isSuperAdmin) {
        return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
      }
      if (isTL) {
        return ['PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
      }

      return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
    });
  }, [leaveList, isAdmin, isSuperAdmin, isTL, user?.id, teamMembers]);

  const pendingCount = pendingRequests.length;

  const isActionable = (req) => {
    if (!req || isSuperAdmin) return false;
    const isSelf = req.userId === user?.id || req.user?.id === user?.id;
    if (isSelf) return false;
    if (isAdmin) return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(req.status);
    if (isTL) return ['PENDING_TL_APPROVAL', 'PENDING'].includes(req.status);
    return false;
  };

  // Summary Counter (On Leave Today)
  const todayStr = new Date().toISOString().split('T')[0];

  const onLeaveToday = useMemo(() => {
    return leaveList.filter(l => {
      if (l.status !== 'APPROVED') return false;
      const start = new Date(l.startDate).toISOString().split('T')[0];
      const end = new Date(l.endDate || l.startDate).toISOString().split('T')[0];
      return todayStr >= start && todayStr <= end;
    }).length;
  }, [leaveList, todayStr]);

  // Keep activeIndex within valid bounds when pending list changes
  useEffect(() => {
    if (activeIndex >= pendingRequests.length && pendingRequests.length > 0) {
      setActiveIndex(pendingRequests.length - 1);
    }
  }, [pendingRequests.length, activeIndex]);

  const activeRequest = pendingRequests[activeIndex] || null;

  const getDurationDisplay = (l) => {
    if (!l) return '1 Day';
    if (l.totalDays !== undefined && l.totalDays !== null && Number(l.totalDays) > 0) {
      const days = Number(l.totalDays);
      return days === 1 ? '1 Day' : `${days} Days`;
    }
    if (!l.startDate) return '1 Day';
    const start = new Date(l.startDate);
    const end = l.endDate ? new Date(l.endDate) : start;
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 Day' : `${diffDays} Days`;
  };

  // Arrow Navigation Handlers (◀ ▶)
  const handlePrev = (e) => {
    e.stopPropagation();
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (activeIndex < pendingRequests.length - 1) {
      setActiveIndex(prev => prev + 1);
    }
  };

  // Open Quick Action Modal
  const handleOpenActionModal = (e, request, type) => {
    e.stopPropagation();
    setActionModal({
      isOpen: true,
      type,
      request,
      remarks: type === 'APPROVE' ? 'Recommended by Approver' : '',
      submitting: false,
      error: null
    });
  };

  // Submit Quick Action
  const handleConfirmAction = async () => {
    const { request, type, remarks } = actionModal;
    if (!request) return;

    if (type === 'REJECT' && !remarks.trim()) {
      setActionModal(prev => ({ ...prev, error: 'Rejection remarks are mandatory.' }));
      return;
    }

    try {
      setActionModal(prev => ({ ...prev, submitting: true, error: null }));

      if (type === 'APPROVE') {
        if (isTL && (request.status === 'PENDING_TL_APPROVAL' || request.status === 'PENDING')) {
          await api.put(`/leaves/${request.id}/tl-approve`, { remarks: remarks || 'Recommended by Team Leader' });
        } else {
          await api.put(`/leaves/${request.id}/admin-approve`, { remarks: remarks || 'Sanctioned by Admin' });
        }
      } else {
        await api.put(`/leaves/${request.id}/reject`, { remarks: remarks || 'Declined' });
      }

      setActionModal({ isOpen: false, type: 'APPROVE', request: null, remarks: '', submitting: false, error: null });
      await fetchLeaves();
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionModal(prev => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.message || 'Failed to process leave action.'
      }));
    }
  };

  // Card Display Title & Subtitle
  const displayTitle = title || (isTL ? 'Team Member Leave Approvals' : 'Leave Overview');
  const displaySubtitle = subtitle || (isTL ? 'Review and approve leave requests submitted by your team members.' : 'Real-time workforce leave status');

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm space-y-4 text-left font-sans transition-all hover:border-border">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{displayTitle}</h3>
            <p className="text-[11px] text-muted-foreground font-medium">{displaySubtitle}</p>
          </div>
        </div>

        {/* Counter Pills + View All Button */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
            <span
              onClick={() => navigate(viewAllRoute)}
              className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-all text-[11px]"
            >
              Pending: {pendingCount}
            </span>
            <span
              onClick={() => navigate(viewAllRoute)}
              className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-all text-[11px]"
            >
              On Leave Today: {onLeaveToday}
            </span>
          </div>

          <button
            onClick={() => navigate(viewAllRoute)}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover transition-all cursor-pointer shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Single-Line Pending Request Widget with Arrow Navigation (~60px height) */}
      <div className="relative w-full h-[62px] rounded-2xl border border-border/50 bg-background/60 p-2 flex items-center justify-between overflow-hidden shadow-xs select-none">
        {pendingRequests.length === 0 ? (
          <div className="w-full text-center text-xs text-muted-foreground font-medium py-2">
            No pending leave requests requiring review.
          </div>
        ) : (
          <div className="w-full flex items-center gap-2">
            {/* Left Navigation Arrow (◀) */}
            {pendingRequests.length > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={activeIndex === 0}
                className={`p-1.5 rounded-xl border border-border/60 transition-all shrink-0 cursor-pointer ${
                  activeIndex === 0
                    ? 'opacity-30 cursor-not-allowed bg-muted/20 text-muted-foreground'
                    : 'bg-card hover:bg-primary/10 hover:border-primary/40 text-foreground hover:text-primary shadow-xs'
                }`}
                title="Previous Request"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Active Single-Line Request Display */}
            <div className="flex-1 min-w-0" onClick={() => navigate(viewAllRoute)}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeRequest?.id || activeIndex}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-between gap-3 text-xs font-medium cursor-pointer"
                >
                  {/* 1. Employee Name & ID */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <UserAvatar user={activeRequest?.user} className="h-8 w-8 rounded-full border border-primary/20 shrink-0" />
                    <div>
                      <span className="font-bold text-foreground hover:text-primary transition-colors block text-xs whitespace-nowrap">
                        {activeRequest?.user?.name || 'Employee'}
                      </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          {activeRequest?.user?.employeeId || activeRequest?.user?.internId || activeRequest?.user?.id?.substring(0, 8) || 'EM-000'}
                        </span>
                    </div>
                  </div>

                  {/* 2. Leave Type Badge */}
                  <div className="hidden sm:block shrink-0">
                    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-extrabold font-mono uppercase border ${
                      (activeRequest?.leaveType || activeRequest?.type) === 'WFH'
                        ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20'
                        : (activeRequest?.leaveType || activeRequest?.type) === 'SICK'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : (activeRequest?.leaveType || activeRequest?.type) === 'EMERGENCY'
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        : 'bg-primary/10 text-primary border-primary/20'
                    }`}>
                      {activeRequest?.leaveType || activeRequest?.type || 'CASUAL'}
                    </span>
                  </div>

                  {/* 3. Duration & Dates */}
                  <div className="shrink-0 flex items-baseline gap-1 text-xs">
                    <span className="font-black text-foreground">{getDurationDisplay(activeRequest).split(' ')[0]}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">{getDurationDisplay(activeRequest).split(' ')[1] || 'Day'}</span>
                    <span className="hidden lg:inline text-[10px] font-mono text-muted-foreground ml-1">
                      ({activeRequest?.startDate ? new Date(activeRequest.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''})
                    </span>
                  </div>

                  {/* 4. Status Badge */}
                  <div className="hidden md:block shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      <Clock className="h-3 w-3" />
                      <span>PENDING</span>
                    </span>
                  </div>

                  {/* 5. Review & Quick Actions */}
                  <div className="shrink-0 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => navigate(viewAllRoute)}
                      className="px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-extrabold border border-primary/20 text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                      title="Review in Leave Management"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Review</span>
                    </button>
                    {isActionable(activeRequest) && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleOpenActionModal(e, activeRequest, 'APPROVE')}
                          className="h-7 w-7 rounded-full btn-primary text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                          title="Approve / Sanction"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenActionModal(e, activeRequest, 'REJECT')}
                          className="h-7 w-7 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer"
                          title="Reject / Decline"
                        >
                          <X className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Navigation Arrow (▶) */}
            {pendingRequests.length > 1 && (
              <button
                type="button"
                onClick={handleNext}
                disabled={activeIndex === pendingRequests.length - 1}
                className={`p-1.5 rounded-xl border border-border/60 transition-all shrink-0 cursor-pointer ${
                  activeIndex === pendingRequests.length - 1
                    ? 'opacity-30 cursor-not-allowed bg-muted/20 text-muted-foreground'
                    : 'bg-card hover:bg-primary/10 hover:border-primary/40 text-foreground hover:text-primary shadow-xs'
                }`}
                title="Next Request"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Action Confirmation Modal */}
      {actionModal.isOpen && actionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left space-y-4 font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${
                  actionModal.type === 'APPROVE' ? 'bg-success/10 text-success border-success/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  {actionModal.type === 'APPROVE' ? <Check className="h-4 w-4 stroke-[3]" /> : <X className="h-4 w-4 stroke-[3]" />}
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {actionModal.type === 'APPROVE' ? 'Confirm Leave Approval' : 'Confirm Leave Rejection'}
                </h3>
              </div>
              <button onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))} className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Request Context Summary */}
            <div className="bg-muted/30 p-3.5 rounded-2xl border border-border/40 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">{actionModal.request.user?.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{actionModal.request.user?.employeeId || actionModal.request.user?.internId}</span>
              </div>
              <p className="text-muted-foreground text-[11px]">
                Type: <strong className="text-foreground font-mono">{actionModal.request.leaveType || actionModal.request.type || 'CASUAL'}</strong> • Duration: <strong className="text-foreground">{getDurationDisplay(actionModal.request)}</strong>
              </p>
            </div>

            {/* Error Banner */}
            {actionModal.error && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 text-xs font-bold">
                {actionModal.error}
              </div>
            )}

            {/* Remarks Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block">
                {actionModal.type === 'REJECT' ? 'Rejection Remarks (Required)' : 'Sanction Remarks (Optional)'}
              </label>
              <input
                type="text"
                placeholder={actionModal.type === 'REJECT' ? 'State reason for declining leave...' : 'Enter review remarks...'}
                value={actionModal.remarks}
                onChange={(e) => setActionModal(prev => ({ ...prev, remarks: e.target.value }))}
                className="w-full bg-muted/30 border border-border/60 rounded-xl px-3.5 py-2 text-xs text-foreground focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </div>

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border hover:bg-muted text-muted-foreground cursor-pointer"
              >
                Cancel
              </button>
              {actionModal.type === 'APPROVE' ? (
                <button
                  onClick={handleConfirmAction}
                  disabled={actionModal.submitting}
                  className="btn-primary text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>{actionModal.submitting ? 'Sanctioning...' : 'Confirm Approve'}</span>
                </button>
              ) : (
                <button
                  onClick={handleConfirmAction}
                  disabled={actionModal.submitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <X className="h-4 w-4 stroke-[3]" />
                  <span>{actionModal.submitting ? 'Rejecting...' : 'Confirm Reject'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveOverviewCard;
