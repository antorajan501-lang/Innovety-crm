import React, { useState, useEffect } from 'react';
import api, { getSocket } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ClockInModal from '../components/attendance/ClockInModal';
import AttendanceHistorySection from '../components/attendance/AttendanceHistorySection';
import {
  Clock,
  Play,
  Square,
  MapPin,
  Laptop,
  CheckCircle,
  AlertCircle,
  CheckCircle2
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
  const [clockInStatus, setClockInStatus] = useState(null);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // Local Browser Telemetry Preview
  const [telemetry, setTelemetry] = useState({
    ip: 'Fetching...',
    browser: '',
    device: 'Desktop'
  });

  const fetchClockInStatus = async () => {
    try {
      const res = await api.get('/attendance/status');
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

  useEffect(() => {
    fetchClockInStatus();
    fetchAttendanceStatus();
    fetchSettings();

    const socket = getSocket();
    if (socket) {
      const handleAttendanceEvent = () => {
        fetchClockInStatus();
        fetchAttendanceStatus();
        setHistoryRefreshTrigger(prev => prev + 1);
      };
      socket.on('attendance_clock_in', handleAttendanceEvent);
      socket.on('attendance_clock_out', handleAttendanceEvent);
      socket.on('attendance_updated', handleAttendanceEvent);
      return () => {
        socket.off('attendance_clock_in', handleAttendanceEvent);
        socket.off('attendance_clock_out', handleAttendanceEvent);
        socket.off('attendance_updated', handleAttendanceEvent);
      };
    }
  }, []);

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

  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);

  const handleClockIn = () => {
    setIsClockInModalOpen(true);
  };

  const handleClockOut = async () => {
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
      setClockedRecord(res.data);
      setAlert(`Successfully clocked out. Worked: ${res.data.workingHours || 0} hrs.`);
      fetchAttendanceStatus();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Clock out failed.');
      setLoading(false);
    }
  };



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
              <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-active" />
                <span>On Shift • Clocked In ({clockedRecord.status})</span>
              </span>
            )}
          </div>

          <div className="mt-8 flex gap-4 w-full max-w-sm">
            <button
              onClick={handleClockIn}
              disabled={loading || !clockInStatus?.canClockIn}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary-hover active:scale-95 disabled:opacity-40 shadow-lg shadow-primary/25 transition-all cursor-pointer"
            >
              <Play className="h-4 w-4" />
              <span>Clock In</span>
            </button>

            <button
              onClick={handleClockOut}
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

      {/* Attendance Log History */}
      <div className="glass-card border border-white/70 dark:border-white/10 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-border/20 flex items-center justify-between text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Today's Shift Timeline & Logs
          </h3>
          <span className="text-[10px] text-muted-foreground font-mono">
            Showing last {recentLogs.length} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/20 bg-muted/20 text-muted-foreground uppercase font-bold text-[10px]">
                <th className="px-5 py-3.5 text-left">Date</th>
                <th className="px-5 py-3.5 text-left">Clock In</th>
                <th className="px-5 py-3.5 text-left">Clock Out</th>
                <th className="px-5 py-3.5 text-left">Total Worked</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No attendance records found for today.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/10 transition-all whitespace-nowrap">
                    <td className="px-5 py-3.5 font-semibold whitespace-nowrap">{formatDateDDMMYYYY(log.date)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap">
                      {log.status === 'LEAVE' || !log.clockIn ? '—' : new Date(log.clockIn).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs whitespace-nowrap">
                      {log.status === 'LEAVE' ? '—' : log.clockOut ? new Date(log.clockOut).toLocaleTimeString() : 'Shift Active'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">{formatWorkingHours(log.workingHours, log.status)}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase ${log.status === 'PRESENT' || log.status === 'WORK_FROM_HOME' ? 'bg-primary/10 text-primary' : log.status === 'LATE' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-500'}`}>
                        {log.status === 'LATE' && log.lateMinutes ? `LATE (${formatLateDuration(log.lateMinutes)})` : log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Attendance History Section */}
      <AttendanceHistorySection user={user} refreshTrigger={historyRefreshTrigger} />

      {/* Clock In Modal */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        onSuccess={() => {
          fetchAttendanceStatus();
          setHistoryRefreshTrigger(prev => prev + 1);
        }}
        user={user}
      />
    </div>
  );
};

export default Attendance;
