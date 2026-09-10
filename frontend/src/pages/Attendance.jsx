import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getSocket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ClockInModal from '../components/attendance/ClockInModal';
import ClockOutReminderModal from '../components/worklog/ClockOutReminderModal';
import useClockOutWithReminder from '../hooks/useClockOutWithReminder';
import useShiftCountdown from '../hooks/useShiftCountdown';
import { getTargetShiftHours, getShiftProgressColor } from '../utils/shiftProgress';
import AttendanceHistorySection from '../components/attendance/AttendanceHistorySection';
import CompanyScopeSelector from '../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../context/CompanyScopeContext';
import ClockInToast from '../components/common/ClockInToast';
import TimeRollSuccessBanner from '../components/common/TimeRollSuccessBanner';
import {
  Clock,
  Play,
  Square,
  MapPin,
  Laptop,
  CheckCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

const Attendance = () => {
  const { user } = useAuth();
  const { selectedOrgId } = useCompanyScope();
  const [time, setTime] = useState(new Date());
  const [clockedRecord, setClockedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState('');
  const [settings, setSettings] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [clockInStatus, setClockInStatus] = useState(null);
  const [clockInToast, setClockInToast] = useState(null);

  const handleClockInSuccess = (resData) => {
    setIsClockInModalOpen(false);
    const statusStr = resData?.attendanceStatus || resData?.status || (resData?.attendance?.status === 'LATE' ? 'LATE' : 'PRESENT');
    const timeStr = resData?.checkInTime || (resData?.clockIn ? new Date(resData.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    setClockInToast({
      type: 'success',
      checkInTime: timeStr,
      attendanceStatus: statusStr
    });
    fetchAttendanceStatus();
    fetchClockInStatus();
    setHistoryRefreshTrigger(prev => prev + 1);

    setTimeout(() => {
      setClockInToast(null);
    }, 3000);
  };

  const handleClockInError = (errMsg) => {
    setClockInToast({
      type: 'error',
      title: 'Clock-In Failed',
      message: errMsg || 'Please try again.'
    });

    setTimeout(() => {
      setClockInToast(null);
    }, 3000);
  };

  const isClockedIn = Boolean(clockedRecord && clockedRecord.clockIn && !clockedRecord.clockOut);

  // Live Working Hours calculation for Attendance page
  const currentWorkingHours = useMemo(() => {
    if (!clockedRecord) return 0;
    if (clockedRecord.clockOut) return clockedRecord.workingHours || 0;
    if (clockedRecord.clockIn) {
      const diff = (time - new Date(clockedRecord.clockIn)) / (1000 * 3600);
      return Math.max(0, Math.round(diff * 10) / 10);
    }
    return 0;
  }, [clockedRecord, time]);

  const targetShiftHours = useMemo(() => {
    return getTargetShiftHours(clockInStatus?.clockInTime || '09:00', clockInStatus?.clockOutTime || '18:00');
  }, [clockInStatus?.clockInTime, clockInStatus?.clockOutTime]);

  const shiftProgressPercent = useMemo(() => {
    if (!isClockedIn && !clockedRecord?.clockOut) return 0;
    return Math.min(100, Math.round((currentWorkingHours / targetShiftHours) * 100));
  }, [isClockedIn, clockedRecord?.clockOut, currentWorkingHours, targetShiftHours]);

  const progressColor = useMemo(() => {
    return getShiftProgressColor(shiftProgressPercent);
  }, [shiftProgressPercent]);

  const shiftCountdown = useShiftCountdown({
    shiftEndAt: clockInStatus?.shiftEndAt || clockedRecord?.shiftEndAt,
    serverTime: clockInStatus?.serverTime,
    autoClockOutEnabled: clockInStatus?.autoClockOutEnabled,
    isClockedIn,
    onShiftEnd: () => {
      fetchAttendanceStatus();
      fetchClockInStatus();
    }
  });
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // Local Browser Telemetry Preview
  const [telemetry, setTelemetry] = useState({
    ip: 'Fetching...',
    browser: '',
    device: 'Desktop'
  });

  const fetchClockInStatus = async () => {
    try {
      const params = selectedOrgId ? { organizationId: selectedOrgId } : {};
      const res = await api.get('/attendance/status', { params });
      setClockInStatus(res.data);
    } catch (err) {
      console.error('Fetch clock in status error:', err);
    }
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

  const lastFetchTimestampRef = useRef(0);
  const debounceFetchTimerRef = useRef(null);

  const safeRefreshAttendance = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchTimestampRef.current < 2000) {
      return;
    }
    if (debounceFetchTimerRef.current) {
      clearTimeout(debounceFetchTimerRef.current);
    }
    debounceFetchTimerRef.current = setTimeout(() => {
      lastFetchTimestampRef.current = Date.now();
      console.log('[AutoClockOut] Executing single attendance page refresh');
      fetchClockInStatus();
      fetchAttendanceStatus();
      setHistoryRefreshTrigger(prev => prev + 1);
    }, 150);
  }, []);

  useEffect(() => {
    fetchClockInStatus();
    fetchAttendanceStatus();
    fetchSettings();

    const socket = getSocket();
    if (socket) {
      const handleAttendanceEvent = (payload) => {
        console.log('[Socket] Attendance event received on Attendance page:', payload?.record?.id || payload);
        safeRefreshAttendance();
      };

      socket.off('attendance_clock_in', handleAttendanceEvent);
      socket.off('attendance_clock_out', handleAttendanceEvent);
      socket.off('attendance_updated', handleAttendanceEvent);
      socket.off('settings_updated', handleAttendanceEvent);

      socket.on('attendance_clock_in', handleAttendanceEvent);
      socket.on('attendance_clock_out', handleAttendanceEvent);
      socket.on('attendance_updated', handleAttendanceEvent);
      socket.on('settings_updated', handleAttendanceEvent);

      return () => {
        socket.off('attendance_clock_in', handleAttendanceEvent);
        socket.off('attendance_clock_out', handleAttendanceEvent);
        socket.off('attendance_updated', handleAttendanceEvent);
        socket.off('settings_updated', handleAttendanceEvent);
      };
    }
  }, [safeRefreshAttendance]);

  const fetchAttendanceStatus = async () => {
    try {
      setLoading(true);
      fetchClockInStatus();
      const res = await api.get('/attendance/logs');
      const localDateStr = new Date().toLocaleDateString('en-CA');
      const todayRecord = res.data.find(log => {
        const logDateStr = new Date(log.date).toLocaleDateString('en-CA');
        return logDateStr === localDateStr;
      });
      
      setClockedRecord(todayRecord || null);
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
          'User-Agent': 'Innoveity-CRM/1.0'
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
    getCoordinatesObj().then(coords => {
      if (coords) {
        setCurrentCoords(coords);
      }
    });

    const pollInterval = setInterval(() => {
      fetchAttendanceStatus();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  const navigate = useNavigate();
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);

  const handleClockIn = () => {
    setIsClockInModalOpen(true);
  };

  const executeClockOut = async () => {
    try {
      setLoading(true);
      const coords = await getCoordinatesObj();
      let location = 'Location not available';
      if (coords) {
        setCurrentCoords(coords);
        const address = await geocodePosition(coords.lat, coords.lon);
        location = address 
          ? `${address} (Lat: ${coords.lat}, Lon: ${coords.lon})`
          : `Lat: ${coords.lat}, Lon: ${coords.lon}`;
      }

      const res = await api.post('/attendance/clock-out', { location });
      const record = res.data;
      setClockedRecord(record);

      const outTimeStr = record?.clockOutTime || (record?.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const durationStr = record?.workingDuration || (record?.workingHours ? `${Math.floor(record.workingHours)}h ${Math.round((record.workingHours % 1) * 60)}m` : '00h 00m');

      setClockInToast({
        mode: 'clockOut',
        type: 'success',
        clockOutTime: outTimeStr,
        workingDuration: durationStr,
        title: 'Clock-Out Successful!',
        subtitle: 'See you tomorrow 👋'
      });

      await fetchAttendanceStatus();

      setTimeout(() => {
        setClockInToast(null);
      }, 3000);
    } catch (err) {
      setClockInToast({
        mode: 'clockOut',
        type: 'error',
        title: 'Clock-Out Failed',
        message: err.response?.data?.message || 'Please try again.'
      });

      setTimeout(() => {
        setClockInToast(null);
      }, 2000);
      setLoading(false);
    }
  };

  const {
    reminderModal,
    handleClockOut,
    closeModal,
    handleCompleteWorkLog,
    handleClockOutAnyway
  } = useClockOutWithReminder(user, executeClockOut);



  const formatDateDDMMYYYY = (dateInput) => {
    if (!dateInput) return '—';
    if (typeof dateInput === 'string' && dateInput.includes('T')) {
      const datePart = dateInput.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        return `${dd}/${mm}/${yyyy}`;
      }
    } else if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [yyyy, mm, dd] = dateInput.split('-');
      return `${dd}/${mm}/${yyyy}`;
    }
    const obj = new Date(dateInput);
    if (isNaN(obj.getTime())) return '—';
    const day = String(obj.getDate()).padStart(2, '0');
    const month = String(obj.getMonth() + 1).padStart(2, '0');
    const year = obj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTimeString = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatWorkingHours = (hours, status) => {
    if (status === 'LEAVE' || hours === null || hours === undefined || hours === 0) return '—';
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  const formatLateDuration = (totalMinutes) => {
    if (!totalMinutes || totalMinutes <= 0) return '';
    const minsNum = Number(totalMinutes);
    if (minsNum < 60) {
      return `${minsNum}min`;
    }
    const hours = Math.floor(minsNum / 60);
    const remainderMins = minsNum % 60;
    if (remainderMins === 0) {
      return `${hours}hr`;
    }
    const paddedMins = String(remainderMins).padStart(2, '0');
    return `${hours}hr ${paddedMins}min`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <CompanyScopeSelector />

      {alert && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alert}</span>
          <button onClick={() => setAlert('')} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

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

      {/* Server-enforced Clock-In Window Status Banner */}
      {clockInStatus && !clockedRecord && (
        <>
          {clockInStatus.state === 'BEFORE_WINDOW' && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs font-semibold text-left animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm text-amber-600 dark:text-amber-400">Clock-In Window Not Open Yet 🕒</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Clock-in is available from <strong>{clockInStatus.windowOpenFormatted}</strong> (Shift Start: {clockInStatus.shiftStartFormatted}).
                  </p>
                </div>
              </div>
            </div>
          )}

          {clockInStatus.state === 'OPEN_ON_TIME' && (
            <div className="p-4 rounded-2xl border border-primary/30 bg-primary/10 text-primary flex items-center justify-between text-xs font-semibold text-left animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-extrabold text-sm text-primary">Grace Period Active ✨</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Clock-in is still considered <strong>On Time (PRESENT)</strong> until <strong>{clockInStatus.windowCloseFormatted}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {clockInStatus.state === 'OPEN_LATE' && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs font-semibold text-left animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 animate-bounce" />
                <div>
                  <p className="font-extrabold text-sm text-amber-600 dark:text-amber-400">Late Clock-In Window Active ⚠️</p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    Grace period ended at {clockInStatus.windowCloseFormatted}. Your clock-in will be marked as <strong>LATE</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Main clock portal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Clock In / Out Panel */}
        <div className="md:col-span-2 glass-card p-6 border border-white/70 dark:border-white/10 shadow-lg flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary border border-primary/20">
            <Clock className="h-10 w-10" />
          </div>

          <TimeRollSuccessBanner clockInToast={clockInToast} time={time} size="lg" dateFormatOptions={{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }} />

          {/* Active status indicator */}
          <div className="mt-4 flex flex-col items-center gap-2">
            {!clockedRecord ? (
              <span className="text-[10px] bg-red-500/10 text-red-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Offline • Not Clocked In
              </span>
            ) : clockedRecord.clockOut ? (
              <div className="flex items-center gap-2">
                {clockedRecord.autoClockOut && (
                  <span className="text-[10px] bg-blue-500/10 text-blue-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-blue-500/20">
                    Automatically Clocked Out
                  </span>
                )}
                <span className="text-[10px] bg-slate-500/10 text-slate-500 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                  Shift Ended • Clocked Out
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-active" />
                    <span>On Shift • Clocked In ({clockedRecord.status})</span>
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    shiftCountdown.autoClockOutEnabled
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${shiftCountdown.autoClockOutEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {shiftCountdown.autoClockOutEnabled ? 'Auto Clock-Out' : 'Manual Clock-Out'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <span>Shift Countdown: <strong className="text-primary font-mono">{shiftCountdown.isExpired ? (shiftCountdown.autoClockOutEnabled ? 'Auto Clocked Out' : 'Shift Ended') : shiftCountdown.formattedRemaining}</strong></span>
                  <span>•</span>
                  <span>Ends: <strong className="text-foreground">{shiftCountdown.targetEndTimeFormatted}</strong></span>
                </div>

                {/* Live Dynamic Shift Completion Progress Bar */}
                <div className="w-full max-w-xs space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground">Shift Progress ({currentWorkingHours.toFixed(1)} hrs)</span>
                    <span className={`font-mono font-bold transition-colors duration-500 ${progressColor.text}`}>
                      {shiftProgressPercent}% ({targetShiftHours.toFixed(1)}h Target)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden p-0.5 border border-border/40">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${shiftProgressPercent > 0 ? progressColor.bg : 'bg-transparent'}`}
                      style={{
                        width: `${shiftProgressPercent}%`,
                        backgroundColor: shiftProgressPercent > 0 ? progressColor.hex : 'transparent'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-4 w-full max-w-sm">
            {isClockedIn ? (
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 py-3 text-sm font-semibold cursor-not-allowed opacity-90"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Clocked In</span>
              </button>
            ) : loading ? (
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary/70 text-primary-foreground py-3 text-sm font-semibold cursor-not-allowed"
              >
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Clocking In...</span>
              </button>
            ) : (
              <button
                onClick={handleClockIn}
                disabled={!clockInStatus?.canClockIn}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary-hover active:scale-95 disabled:opacity-40 shadow-lg shadow-primary/25 transition-all cursor-pointer"
              >
                <Play className="h-4 w-4" />
                <span>Clock In</span>
              </button>
            )}

            <button
              onClick={() => {
              console.log("[CLOCKOUT] Button clicked");
              handleClockOut();
            }}
              disabled={loading || !clockInStatus?.canClockOut}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl text-white py-3 text-sm font-semibold active:scale-95 disabled:opacity-40 shadow-lg shadow-red-500/25 transition-all cursor-pointer bg-[linear-gradient(135deg,#FF6B6B_0%,#EF4444_55%,#DC2626_100%)] hover:bg-[linear-gradient(135deg,#EF4444_0%,#DC2626_100%)] border-none"
            >
              <Square className="h-4 w-4" />
              <span>Clock Out</span>
            </button>
          </div>
        </div>

        {/* Telemetry & Geofence Policy Sidebar */}
        <div className="space-y-6">
          <div className="glass-card p-5 border border-white/70 dark:border-white/10 text-left space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              System & IP Telemetry
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground">Network IP:</span>
                <span className="font-mono font-bold text-foreground">{telemetry.ip}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground">Browser:</span>
                <span className="font-semibold text-foreground">{telemetry.browser || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground">Device Type:</span>
                <span className="font-semibold text-foreground">{telemetry.device}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Live GPS:</span>
                <span className="font-mono text-[10px] font-bold text-primary">
                  {currentCoords ? `${currentCoords.lat}, ${currentCoords.lon}` : 'Detecting...'}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 border border-white/70 dark:border-white/10 text-left space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Geofence Policy
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Clock-in requires active GPS coordinates within the office radius unless Work From Home is sanctioned.
            </p>
            <div className="pt-1 flex items-center gap-2 text-xs font-semibold text-primary">
              <CheckCircle className="h-4 w-4" />
              <span>Location Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Attendance History Section */}
      <AttendanceHistorySection user={user} refreshTrigger={historyRefreshTrigger} />

      {/* Clock In Modal */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        onSuccess={handleClockInSuccess}
        onError={handleClockInError}
        user={user}
      />

      {/* Clock Out Reminder Modal */}
      <ClockOutReminderModal
        isOpen={reminderModal.isOpen}
        isDraft={reminderModal.isDraft}
        hasWorkLog={reminderModal.hasWorkLog}
        onClose={closeModal}
        onCompleteWorkLog={handleCompleteWorkLog}
        onClockOutAnyway={handleClockOutAnyway}
      />


    </div>
  );
};

export default Attendance;
