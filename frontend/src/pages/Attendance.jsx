import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  Play,
  Square,
  MapPin,
  Laptop,
  CheckCircle,
  AlertCircle,
  FileText,
  Eye,
  X,
  Send,
  Home,
  CheckCircle2,
  Phone
} from 'lucide-react';

const Attendance = () => {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [clockedRecord, setClockedRecord] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState('');
  const [settings, setSettings] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);

  // Leave & WFH States
  const [tab, setTab] = useState('Clock');
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    subject: '',
    letterContent: '',
    reason: '',
    contactPhone: '',
    type: 'LEAVE'
  });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Modal for previewing/reading leave letter
  const [viewingLetter, setViewingLetter] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Local Browser Telemetry Preview
  const [telemetry, setTelemetry] = useState({
    ip: 'Fetching...',
    browser: '',
    device: 'Desktop'
  });

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leaves');
      setLeaves(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setSubmittingLeave(true);
    try {
      const payload = {
        ...leaveForm,
        reason: leaveForm.reason || leaveForm.subject || 'Leave Application',
        letterContent: leaveForm.letterContent || leaveForm.reason
      };

      await api.post('/leaves', payload);
      setLeaveForm({
        startDate: '',
        endDate: '',
        subject: '',
        letterContent: '',
        reason: '',
        contactPhone: '',
        type: 'LEAVE'
      });
      setShowPreviewModal(false);
      setAlert('Formal Leave Letter submitted successfully! Awaiting Admin review & sanction.');
      fetchLeaves();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const fillFormalTemplate = () => {
    const startStr = leaveForm.startDate || 'YYYY-MM-DD';
    const endStr = leaveForm.endDate || startStr;
    const isSingleDay = !leaveForm.endDate || startStr === endStr;
    const typeLabel = leaveForm.type === 'WFH' ? 'Work From Home' : 'Leave of Absence';
    const dateRangeStr = isSingleDay ? startStr : `${startStr} to ${endStr}`;
    const durationPhrasing = isSingleDay ? `on ${startStr}` : `for the duration from ${startStr} to ${endStr}`;

    const defaultSubject = `Application for ${typeLabel} (${dateRangeStr})`;
    const defaultLetter = `To,\nThe Management / Administrator,\nMRF Enterprise.\n\nRespected Sir/Madam,\n\nI am writing this formal application letter to request ${typeLabel} ${durationPhrasing}.\n\nReason for Request:\n[Please specify reason here]\n\n${leaveForm.type === 'WFH' ? 'During this work-from-home period, I will remain actively online, handle assigned tasks on time, and mark daily attendance via the portal.' : 'I will ensure all pending tasks are handed over to my team members before taking leave.'}\n\nEmergency Contact Number: ${leaveForm.contactPhone || user?.phone || '[Phone Number]'}\n\nThank you for your understanding and consideration.\n\nSincerely,\n${user?.name}\nEmployee ID: ${user?.employeeId || 'N/A'}\nRole: ${user?.role}`;

    setLeaveForm(prev => ({
      ...prev,
      subject: defaultSubject,
      letterContent: defaultLetter,
      reason: prev.reason || `Request for ${typeLabel}`
    }));
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);

    const ua = navigator.userAgent.toLowerCase();
    let browser = 'Chrome';
    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edge') || ua.includes('edg')) browser = 'Edge';

    const device = (ua.includes('mobi') || ua.includes('android')) ? 'Mobile' : 'Desktop';
    
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setTelemetry({ ip: data.ip, browser, device }))
      .catch(() => setTelemetry({ ip: '127.0.0.1', browser, device }));

    return () => clearInterval(timer);
  }, []);

  const fetchAttendanceStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/logs');
      const localDateStr = new Date().toLocaleDateString('en-CA');
      const todayRecord = res.data.find(log => {
        const logDateStr = new Date(log.date).toLocaleDateString('en-CA');
        return logDateStr === localDateStr;
      });
      
      setClockedRecord(todayRecord || null);
      setRecentLogs(res.data.slice(0, 15));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const getCoordinatesObj = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);
          resolve({ lat, lon });
        },
        (error) => {
          console.warn('Geolocation error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  };

  const geocodePosition = async (lat, lon) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
        headers: {
          'User-Agent': 'MRF-Enterprise-CRM/1.0'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          return data.display_name;
        }
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    }
    return null;
  };

  useEffect(() => {
    fetchAttendanceStatus();
    fetchSettings();
    fetchLeaves();
    getCoordinatesObj().then(coords => {
      if (coords) {
        setCurrentCoords(coords);
      }
    });

    // Auto-poll leave sanction status & attendance logs every 4 seconds
    const pollInterval = setInterval(() => {
      fetchLeaves();
      fetchAttendanceStatus();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleClockIn = async () => {
    try {
      setLoading(true);
      const coords = await getCoordinatesObj();
      if (!coords) {
        setAlert('GPS coordinates are required to mark attendance. Please enable location access.');
        setLoading(false);
        return;
      }
      
      setCurrentCoords(coords);
      const address = await geocodePosition(coords.lat, coords.lon);
      const location = address 
        ? `${address} (Lat: ${coords.lat}, Lon: ${coords.lon})`
        : `Lat: ${coords.lat}, Lon: ${coords.lon}`;

      const res = await api.post('/attendance/clock-in', { location });
      setClockedRecord(res.data);
      setAlert(`Successfully clocked in today! Status: ${res.data.status}`);
      fetchAttendanceStatus();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Clock in failed.');
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setLoading(true);
      const coords = await getCoordinatesObj();
      if (!coords) {
        setAlert('GPS coordinates are required to mark attendance. Please enable location access.');
        setLoading(false);
        return;
      }
      
      setCurrentCoords(coords);
      const address = await geocodePosition(coords.lat, coords.lon);
      const location = address 
        ? `${address} (Lat: ${coords.lat}, Lon: ${coords.lon})`
        : `Lat: ${coords.lat}, Lon: ${coords.lon}`;

      const res = await api.post('/attendance/clock-out', { location });
      setClockedRecord(res.data);
      setAlert(`Successfully clocked out. Worked: ${res.data.workingHours || 0} hrs.`);
      fetchAttendanceStatus();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Clock out failed.');
      setLoading(false);
    }
  };

  const formatLeavePeriod = (startDate, endDate) => {
    if (!startDate) return 'N/A';
    const startObj = new Date(startDate);
    const endObj = endDate ? new Date(endDate) : startObj;
    
    const startStr = startObj.toLocaleDateString();
    const endStr = endObj.toLocaleDateString();

    if (startStr === endStr) {
      return startStr;
    }
    return `${startStr} to ${endStr}`;
  };

  const formatLocationDisplay = (locStr) => {
    if (!locStr) return '—';
    const match = locStr.match(/^(.*?)\s*\(Lat:\s*([-\d.]+),\s*Lon:\s*([-\d.]+)\)$/i);
    if (match) {
      const address = match[1];
      const coords = `Lat: ${parseFloat(match[2]).toFixed(4)}, Lon: ${parseFloat(match[3]).toFixed(4)}`;
      return (
        <div className="text-left max-w-xs truncate" title={locStr}>
          <p className="font-bold text-foreground truncate">{address}</p>
          <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{coords}</p>
        </div>
      );
    }
    return <span className="font-mono text-[10px] text-muted-foreground">{locStr}</span>;
  };

  const formatTimeString = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatWorkingHours = (hours) => {
    if (!hours) return '0 hrs';
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  // Helper to determine today's leave status for active banner
  const todayDateStr = new Date().toLocaleDateString('en-CA');
  const activeTodayLeave = leaves.find(l => {
    const s = new Date(l.startDate).toLocaleDateString('en-CA');
    const e = new Date(l.endDate).toLocaleDateString('en-CA');
    return todayDateStr >= s && todayDateStr <= e;
  });

  const renderLeavesTab = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-in fade-in duration-300">
        {/* Leave application form */}
        <div className="lg:col-span-5 rounded-2xl border border-border/40 bg-card p-6 shadow-premium space-y-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Submit Formal Leave Letter
            </h3>
            <button
              type="button"
              onClick={fillFormalTemplate}
              className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1"
              title="Auto-fill formal letter template"
            >
              <span>Auto-Fill Template</span>
            </button>
          </div>

          <form onSubmit={handleLeaveSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Request Type</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="text-xs border bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary w-full"
                >
                  <option value="LEAVE">Leave (Absent with Notice)</option>
                  <option value="WFH">Work From Home (Remote Shift)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Phone</label>
                <input
                  type="text"
                  placeholder="Emergency contact..."
                  value={leaveForm.contactPhone}
                  onChange={(e) => setLeaveForm({ ...leaveForm, contactPhone: e.target.value })}
                  className="text-xs border bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Start Date</label>
                <input
                  type="date"
                  required
                  value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                  className="text-xs border bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary w-full"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">End Date</label>
                <input
                  type="date"
                  required
                  value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                  className="text-xs border bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Letter Subject</label>
              <input
                type="text"
                required
                placeholder="e.g. Application for Work From Home / Sick Leave"
                value={leaveForm.subject}
                onChange={(e) => setLeaveForm({ ...leaveForm, subject: e.target.value, reason: e.target.value })}
                className="text-xs border bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Formal Letter Content</label>
              </div>
              <textarea
                required
                rows={6}
                placeholder="Write your formal leave application letter here..."
                value={leaveForm.letterContent}
                onChange={(e) => setLeaveForm({ ...leaveForm, letterContent: e.target.value })}
                className="text-xs border bg-background px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary w-full resize-none font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                disabled={!leaveForm.letterContent}
                className="flex-1 border border-border/60 hover:bg-muted text-foreground py-2.5 text-xs font-bold rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Preview Letter</span>
              </button>

              <button
                type="submit"
                disabled={submittingLeave}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary-hover py-2.5 text-xs font-bold rounded-xl transition-all shadow shadow-primary/25 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submittingLeave ? 'Submitting...' : 'Submit Letter'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Leaves listing history */}
        <div className="lg:col-span-7 rounded-2xl border border-border/40 bg-card p-6 shadow-premium flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 border-b border-border/30 pb-2 mb-4">
              Submitted Leave Application Letters
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse text-left">
                <thead>
                  <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20">
                    <th className="px-4 py-3">Letter Subject & Type</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Sanction Status</th>
                    <th className="px-4 py-3 text-right">View Letter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No leave or WFH application letters submitted yet.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/10 transition-all text-xs">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-foreground line-clamp-1">{l.subject || l.reason}</span>
                            <span className={`inline-flex w-max rounded px-1.5 py-0.5 text-[9px] font-bold font-mono ${l.type === 'WFH' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-rose-500/10 text-rose-600'}`}>
                              {l.type}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {formatLeavePeriod(l.startDate, l.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          {l.status === 'APPROVED' ? (
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                              ACCEPTED (WFH Assigned)
                            </span>
                          ) : l.status === 'REJECTED' ? (
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase bg-red-500/10 text-red-500">
                              DECLINED (Marked Absent)
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase bg-yellow-500/10 text-yellow-600">
                              PENDING ADMIN SANCTION
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setViewingLetter(l)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Read full formal letter"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/30 mt-4">
            <span className="font-bold text-foreground">Rule: </span> When Admin accepts your letter, Work From Home (WFH) permission is automatically activated for your dates. If declined, your status for those dates is marked as ABSENT.
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {alert && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alert}</span>
          <button onClick={() => setAlert('')} className="font-bold">✕</button>
        </div>
      )}

      {/* Tabs navigation at the top */}
      <div className="flex border-b border-border/20 gap-6">
        <button
          onClick={() => setTab('Clock')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all relative ${tab === 'Clock' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground font-semibold'}`}
        >
          Attendance Clock Portal
          {tab === 'Clock' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
        </button>
        <button
          onClick={() => setTab('Leaves')}
          className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-all relative ${tab === 'Leaves' ? 'text-primary font-black' : 'text-muted-foreground hover:text-foreground font-semibold'}`}
        >
          Leaves & WFH Application Letters ({leaves.length})
          {tab === 'Leaves' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
        </button>
      </div>

      {tab === 'Clock' ? (
        <>
          {/* Late Attendance Alert Banner */}
          {clockedRecord && clockedRecord.status === 'LATE' && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs font-semibold text-left animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 animate-bounce" />
                <div>
                  <p className="font-extrabold text-sm text-amber-600 dark:text-amber-400">Late Attendance Recorded ⚠️</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    You clocked in past your official shift start time (09:30 AM). Your attendance status for today is marked as <strong>LATE</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Leave Banner on Clock Tab */}
          {activeTodayLeave && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold text-left ${activeTodayLeave.status === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : activeTodayLeave.status === 'REJECTED' ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300'}`}>
              <div className="flex items-center gap-3">
                {activeTodayLeave.status === 'APPROVED' ? (
                  <Home className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : activeTodayLeave.status === 'REJECTED' ? (
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <Clock className="h-5 w-5 text-yellow-500 shrink-0" />
                )}
                <div>
                  <p className="font-extrabold text-sm">
                    {activeTodayLeave.status === 'APPROVED' ? 'Work From Home (WFH) Assigned for Today!' : activeTodayLeave.status === 'REJECTED' ? 'Leave Request Declined by Admin' : 'Leave Letter Pending Admin Sanction'}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {activeTodayLeave.status === 'APPROVED' ? 'Admin has accepted your leave letter. Location boundary checks are bypassed for remote clock-in.' : activeTodayLeave.status === 'REJECTED' ? 'Your leave request was declined. Attendance for today is recorded as ABSENT.' : 'Your formal leave letter has been submitted and is currently awaiting Admin approval.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main clock portal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Clock In / Out Panel */}
            <div className="md:col-span-2 rounded-2xl border border-border/40 bg-card p-6 shadow-premium flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary animate-pulse">
                <Clock className="h-10 w-10" />
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight font-mono">{formatTimeString(time)}</h2>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                {time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              {/* Active status indicator */}
              <div className="mt-4">
                {!clockedRecord ? (
                  <span className="text-[10px] bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                    Offline • Not Clocked In
                  </span>
                ) : clockedRecord.clockOut ? (
                  <span className="text-[10px] bg-slate-500/10 text-slate-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                    Shift Ended • Clocked Out
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-active" />
                    <span>On Shift • Clocked In ({clockedRecord.status})</span>
                  </span>
                )}
              </div>

              <div className="mt-8 flex gap-4 w-full max-w-sm">
                <button
                  onClick={handleClockIn}
                  disabled={loading || !!clockedRecord}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary-hover active:scale-95 disabled:opacity-40 shadow-lg shadow-primary/25 transition-all"
                >
                  <Play className="h-4 w-4" />
                  <span>Clock In</span>
                </button>

                <button
                  onClick={handleClockOut}
                  disabled={loading || !clockedRecord || !!clockedRecord.clockOut}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-danger text-white py-3 text-sm font-semibold hover:bg-danger/90 active:scale-95 disabled:opacity-40 shadow-lg shadow-danger/25 transition-all"
                >
                  <Square className="h-4 w-4" />
                  <span>Clock Out</span>
                </button>
              </div>

              {settings && (
                <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-muted/40 border border-border/30 px-3.5 py-2.5 text-xs text-muted-foreground w-full max-w-sm">
                  <MapPin className="h-4.5 w-4.5 text-primary shrink-0 animate-bounce" />
                  <div className="text-left leading-snug">
                    <span className="font-bold text-foreground">Office Target Location:</span>
                    <p className="mt-0.5 font-semibold text-indigo-500">{settings.officeLocationName || 'MRF Headquarters'}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Lat: {settings.officeLatitude}, Lon: {settings.officeLongitude} (Radius: {settings.allowedRadiusMeters}m)</p>
                  </div>
                </div>
              )}

              {currentCoords ? (
                <div className="rounded-xl overflow-hidden border border-border/40 shadow-premium h-48 w-full mt-4 animate-in fade-in duration-300">
                  <iframe
                    title="Current Location Map"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0 }}
                    src={`https://maps.google.com/maps?q=${currentCoords.lat},${currentCoords.lon}&hl=en&z=15&output=embed`}
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground mt-4 w-full">
                  Detecting current GPS location...
                </div>
              )}
            </div>

            {/* Telemetry metadata box */}
            <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 border-b border-border/30 pb-2 mb-4">
                  Active Session Telemetry
                </h3>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <MapPin className="h-4.5 w-4.5 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold">IP Address</span>
                      <p className="text-xs font-mono font-bold mt-0.5">{telemetry.ip}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Laptop className="h-4.5 w-4.5 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold">Browser & OS</span>
                      <p className="text-xs font-bold mt-0.5">{telemetry.browser} ({telemetry.device})</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/30 mt-4">
                Note: Location signatures & network metadata are locked on clock-in for attendance audit tracking.
              </div>
            </div>
          </div>

          {/* History table */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left animate-in fade-in duration-300">
            <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 mb-4 border-b border-border/30 pb-2">
              Recent Check-in History
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-xs font-semibold text-muted-foreground uppercase border-b border-border/30 bg-muted/20">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Clock In</th>
                    <th className="px-4 py-3">Clock Out</th>
                    <th className="px-4 py-3">Working Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Telemetry IP</th>
                    <th className="px-4 py-3 text-right">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                  {recentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No attendance logs found.
                      </td>
                    </tr>
                  ) : (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/10 transition-all">
                        <td className="px-4 py-3 font-semibold">{new Date(log.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-mono text-xs">{new Date(log.clockIn).toLocaleTimeString()}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : 'Shift Active'}
                        </td>
                        <td className="px-4 py-3">{formatWorkingHours(log.workingHours)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${log.status === 'PRESENT' || log.status === 'WORK_FROM_HOME' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : log.status === 'LATE' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-500'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.ipAddress}</td>
                        <td className="px-4 py-3 text-xs text-right font-medium font-sans">
                          <div className="flex flex-col gap-1.5 items-end">
                            {log.clockInLocation && (
                              <div className="flex items-start gap-1">
                                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5">In</span>
                                {formatLocationDisplay(log.clockInLocation)}
                              </div>
                            )}
                            {log.clockOutLocation && (
                              <div className="flex items-start gap-1">
                                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5">Out</span>
                                {formatLocationDisplay(log.clockOutLocation)}
                              </div>
                            )}
                            {!log.clockInLocation && <span className="text-muted-foreground">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        renderLeavesTab()
      )}

      {/* Formal Letter Preview / Read Modal */}
      {(showPreviewModal || viewingLetter) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold">
                  {viewingLetter ? 'Leave Application Letter' : 'Preview Formal Leave Letter'}
                </h3>
              </div>
              <button
                className="rounded-lg p-1 hover:bg-muted"
                onClick={() => {
                  setShowPreviewModal(false);
                  setViewingLetter(null);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 font-sans text-xs">
              <div className="flex justify-between items-center bg-muted/40 p-3 rounded-xl border border-border/30">
                <div>
                  <span className="text-[10px] text-muted-foreground font-semibold">Applicant Name</span>
                  <p className="font-bold text-sm text-foreground">{viewingLetter?.user?.name || user?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{viewingLetter?.user?.employeeId || user?.employeeId} ({viewingLetter?.user?.role || user?.role})</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground font-semibold">Request Type & Status</span>
                  <p className="font-mono font-bold text-indigo-500">{viewingLetter?.type || leaveForm.type}</p>
                  {viewingLetter && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${viewingLetter.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600' : viewingLetter.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-600'}`}>
                      {viewingLetter.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Subject</span>
                <p className="font-bold text-foreground text-sm bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  {viewingLetter ? viewingLetter.subject || viewingLetter.reason : leaveForm.subject || leaveForm.reason}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Leave Period</span>
                <p className="font-medium text-foreground">
                  {viewingLetter 
                    ? formatLeavePeriod(viewingLetter.startDate, viewingLetter.endDate) 
                    : (leaveForm.startDate === leaveForm.endDate || !leaveForm.endDate
                        ? leaveForm.startDate || 'N/A'
                        : `${leaveForm.startDate} to ${leaveForm.endDate}`)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Letter Document Body</span>
                <div className="bg-muted/10 p-4 rounded-xl border border-border/40 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {viewingLetter ? viewingLetter.letterContent || viewingLetter.reason : leaveForm.letterContent || leaveForm.reason}
                </div>
              </div>

              {(viewingLetter?.contactPhone || leaveForm.contactPhone) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>Contact Phone: <strong className="text-foreground">{viewingLetter?.contactPhone || leaveForm.contactPhone}</strong></span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setViewingLetter(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted"
              >
                Close
              </button>
              {showPreviewModal && (
                <button
                  onClick={handleLeaveSubmit}
                  disabled={submittingLeave}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover shadow-md"
                >
                  Confirm & Submit Application
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
