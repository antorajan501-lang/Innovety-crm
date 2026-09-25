import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, ArrowRightLeft, Zap, ShieldAlert, CheckCircle2,
  Calendar, Users, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '../../services/api';

const TeamLeaderShiftWidget = ({ organizationId, onOpenOverrideRequest, onOpenSwapRequest }) => {
  const [teamSchedule, setTeamSchedule] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [teamExceptions, setTeamExceptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTLShiftData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const [dayRes, apprRes, excRes] = await Promise.all([
        api.get('/schedules/day', { params: { date: today } }).catch(() => ({ data: { members: [] } })),
        api.get('/workforce/approvals', { params: { status: 'PENDING_TL_APPROVAL' } }).catch(() => ({ data: { approvals: [] } })),
        api.get('/workforce/exceptions', { params: { status: 'OPEN' } }).catch(() => ({ data: { exceptions: [] } }))
      ]);

      setTeamSchedule(dayRes.data?.members || []);
      setPendingApprovals(apprRes.data?.approvals || []);
      setTeamExceptions(excRes.data?.exceptions || []);
    } catch (err) {
      console.error('[TeamLeaderShiftWidget] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTLShiftData();
  }, [organizationId]);

  const handleEndorseSwap = async (approvalId) => {
    try {
      await api.put(`/workforce/approvals/${approvalId}/review`, {
        action: 'APPROVE',
        note: 'Endorsed by Team Leader'
      });
      fetchTLShiftData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to endorse swap.');
    }
  };

  return (
    <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm space-y-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Team Shift Operations</h3>
            <p className="text-xs text-muted-foreground font-medium">
              Today's team roster, pending approvals & shift adjustments
            </p>
          </div>
        </div>

        <button
          onClick={fetchTLShiftData}
          disabled={loading}
          className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Quick Action Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="p-3 rounded-2xl bg-muted/20 border border-border/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Team On Duty
          </span>
          <span className="text-xl font-black text-foreground mt-0.5 block">
            {teamSchedule.filter(m => m.todayStatus === 'Working').length}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-muted/20 border border-border/60">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Pending Reviews
          </span>
          <span className="text-xl font-black text-amber-500 mt-0.5 block">
            {pendingApprovals.length}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Open Exceptions
          </span>
          <span className="text-xl font-black text-rose-500 mt-0.5 block">
            {teamExceptions.length}
          </span>
        </div>
      </div>

      {/* Pending Reviews Section */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
            Awaiting Your Endorsement ({pendingApprovals.length})
          </span>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {pendingApprovals.map(appr => (
              <div key={appr.id} className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-foreground block">
                    {appr.requester?.name} — {appr.requestType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    "{appr.reason || 'Swap request'}"
                  </span>
                </div>
                <button
                  onClick={() => handleEndorseSwap(appr.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-xs cursor-pointer shrink-0"
                >
                  Endorse
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today Team Schedule Mini List */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
          Today's Team Shift Roster
        </span>
        <div className="max-h-48 overflow-y-auto divide-y divide-border/40 border border-border/60 rounded-2xl p-2 bg-muted/10 text-xs">
          {teamSchedule.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">No team members scheduled today.</p>
          ) : (
            teamSchedule.map(m => (
              <div key={m.userId} className="py-2 px-1 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-foreground block">{m.userName}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {m.shiftName} ({m.startTime} – {m.endTime})
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                  m.todayStatus === 'Holiday'
                    ? 'bg-rose-500/10 text-rose-600'
                    : m.todayStatus === 'WFH'
                    ? 'bg-purple-500/10 text-purple-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}>
                  {m.todayStatus}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamLeaderShiftWidget;
