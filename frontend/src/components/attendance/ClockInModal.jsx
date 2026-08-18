import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Building2, Home, MapPin, Clock, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { formatLateDuration } from '../../utils/attendanceFormatter';

export default function ClockInModal({ isOpen, onClose, onSuccess, user }) {
  const [workLocation, setWorkLocation] = useState('OFFICE');
  const [workLocationOther, setWorkLocationOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [clockStatus, setClockStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setWorkLocation('OFFICE');
      setWorkLocationOther('');
      setErrorMsg('');
      fetchClockStatus();
    }
  }, [isOpen]);

  const fetchClockStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await api.get('/attendance/status');
      setClockStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch clock status preview:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  if (!isOpen) return null;

  const isOtherInvalid = workLocation === 'OTHER' && !workLocationOther.trim();
  const calculatedStatus = clockStatus?.state === 'OPEN_LATE' ? 'LATE' : 'PRESENT';
  const lateMinutes = clockStatus?.lateMinutes || 0;
  const currentTimeDisplay = clockStatus?.currentTimeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOtherInvalid) {
      setErrorMsg('Location or reason is required when "Other" is selected.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const payload = {
        workLocation,
        workLocationOther: workLocation === 'OTHER' ? workLocationOther.trim() : null
      };

      const res = await api.post('/attendance/clock-in', payload);

      if (onSuccess) {
        onSuccess(res.data?.attendance || res.data);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Clock in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-left relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Clock In
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Confirm your attendance and work location.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Time & Calculated Status Card */}
        <div className="bg-muted/40 border border-border/80 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Current Time</span>
            <span className="text-lg font-black font-mono text-foreground block">
              {statusLoading ? '...' : currentTimeDisplay}
            </span>
          </div>
          <div className="space-y-1 flex flex-col items-center justify-center border-l border-border/60">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Attendance Status</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase flex items-center gap-1 ${
              calculatedStatus === 'LATE'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              {calculatedStatus === 'LATE' ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> LATE
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" /> PRESENT
                </>
              )}
            </span>
            {calculatedStatus === 'LATE' && lateMinutes > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                {formatLateDuration(lateMinutes)}
              </span>
            )}
          </div>
        </div>

        {/* Work Location Selector */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground block mb-2">
              Where are you working from today? <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setWorkLocation('OFFICE')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                  workLocation === 'OFFICE'
                    ? 'bg-primary/10 border-primary text-primary font-black shadow-sm ring-2 ring-primary/20'
                    : 'bg-background border-border/80 text-muted-foreground hover:bg-muted/50 font-medium'
                }`}
              >
                <Building2 className="w-5 h-5" />
                <span className="text-xs font-bold">Office</span>
              </button>

              <button
                type="button"
                onClick={() => setWorkLocation('HOME')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                  workLocation === 'HOME'
                    ? 'bg-primary/10 border-primary text-primary font-black shadow-sm ring-2 ring-primary/20'
                    : 'bg-background border-border/80 text-muted-foreground hover:bg-muted/50 font-medium'
                }`}
              >
                <Home className="w-5 h-5" />
                <span className="text-xs font-bold">Home</span>
              </button>

              <button
                type="button"
                onClick={() => setWorkLocation('OTHER')}
                className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                  workLocation === 'OTHER'
                    ? 'bg-primary/10 border-primary text-primary font-black shadow-sm ring-2 ring-primary/20'
                    : 'bg-background border-border/80 text-muted-foreground hover:bg-muted/50 font-medium'
                }`}
              >
                <MapPin className="w-5 h-5" />
                <span className="text-xs font-bold">Other</span>
              </button>
            </div>
          </div>

          {/* Conditional Other Location Reason Input */}
          {workLocation === 'OTHER' && (
            <div className="space-y-1 animate-in fade-in duration-150">
              <label className="text-xs font-bold text-foreground block">
                Location / Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={workLocationOther}
                onChange={(e) => setWorkLocationOther(e.target.value)}
                placeholder="Enter location or reason (e.g., Client office - Chennai)"
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
          )}

          {/* Inline Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-bold border border-border rounded-xl hover:bg-muted text-foreground transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isOtherInvalid}
              className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" /> Clocking In...
                </>
              ) : (
                'Confirm Clock In'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
