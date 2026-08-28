import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Save, Shield, Clock, Mail, Building, CheckCircle2, MapPin, Navigation, AlertCircle, ToggleLeft, ToggleRight, Check, Sparkles } from 'lucide-react';

const SiteSettings = () => {
  const [settings, setSettings] = useState({
    companyName: 'Innoveity',
    senderEmail: 'somusuraj72@gmail.com',
    clockInTime: '09:00',
    clockOutTime: '18:00',
    autoClockOutEnabled: true,
    internShiftStart: '09:00',
    internShiftEnd: '18:00',
    tlShiftStart: '09:00',
    tlShiftEnd: '18:00',
    officeLatitude: 12.971598,
    officeLongitude: 77.594562,
    allowedRadiusMeters: 200,
    officeLocationName: 'Innoveity Headquarters',
    earlyWindowMinutes: 30,
    gracePeriodMinutes: 15
  });

  const [loading, setLoading] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [capturedGps, setCapturedGps] = useState(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.data) {
        setSettings({
          ...res.data,
          clockInTime: res.data.clockInTime || res.data.internShiftStart || '09:00',
          clockOutTime: res.data.clockOutTime || res.data.internShiftEnd || '18:00',
          autoClockOutEnabled: res.data.autoClockOutEnabled !== undefined ? res.data.autoClockOutEnabled : true
        });
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: 'Failed to load system settings.' });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleToggleAutoClockOut = () => {
    setSettings(prev => ({
      ...prev,
      autoClockOutEnabled: !prev.autoClockOutEnabled
    }));
  };

  const handleGPSAutofill = () => {
    if (!navigator.geolocation) {
      setAlert({ type: 'error', message: 'Geolocation is not supported by your browser.' });
      return;
    }

    setGpsDetecting(true);
    setAlert(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        
        setSettings(prev => ({
          ...prev,
          officeLatitude: lat,
          officeLongitude: lon
        }));

        setCapturedGps({ lat, lon });
        setAlert({
          type: 'success',
          message: `Captured current GPS location (Lat: ${lat}, Lon: ${lon}). Click "Save Configuration" to update office geofence.`
        });
        setGpsDetecting(false);
      },
      (error) => {
        setAlert({ type: 'error', message: 'Failed to fetch GPS location: ' + error.message });
        setGpsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      setAlert(null);

      const earlyWin = parseInt(settings.earlyWindowMinutes, 10);
      const gracePer = parseInt(settings.gracePeriodMinutes, 10);
      const lat = parseFloat(settings.officeLatitude);
      const lon = parseFloat(settings.officeLongitude);
      const radius = parseFloat(settings.allowedRadiusMeters);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        setAlert({ type: 'error', message: 'Office Latitude must be a valid number between -90 and 90.' });
        setLoading(false);
        return;
      }

      if (isNaN(lon) || lon < -180 || lon > 180) {
        setAlert({ type: 'error', message: 'Office Longitude must be a valid number between -180 and 180.' });
        setLoading(false);
        return;
      }

      if (isNaN(radius) || radius <= 0) {
        setAlert({ type: 'error', message: 'Allowed Radius must be a positive number greater than 0.' });
        setLoading(false);
        return;
      }

      if (isNaN(earlyWin) || earlyWin < 0 || earlyWin > 120) {
        setAlert({ type: 'error', message: 'Early Clock-In Window must be between 0 and 120 minutes.' });
        setLoading(false);
        return;
      }
      if (isNaN(gracePer) || gracePer < 0 || gracePer > 120) {
        setAlert({ type: 'error', message: 'Grace Period must be between 0 and 120 minutes.' });
        setLoading(false);
        return;
      }

      // Validate clock out time > clock in time
      const [inH, inM] = (settings.clockInTime || '09:00').split(':').map(Number);
      const [outH, outM] = (settings.clockOutTime || '18:00').split(':').map(Number);
      if (outH * 60 + outM <= inH * 60 + inM) {
        setAlert({ type: 'error', message: 'Clock-Out Time must be chronologically later than Clock-In Time.' });
        setLoading(false);
        return;
      }
      
      const payload = {
        ...settings,
        officeLatitude: lat,
        officeLongitude: lon,
        allowedRadiusMeters: radius,
        earlyWindowMinutes: earlyWin,
        gracePeriodMinutes: gracePer,
        internShiftStart: settings.clockInTime,
        internShiftEnd: settings.clockOutTime,
        tlShiftStart: settings.clockInTime,
        tlShiftEnd: settings.clockOutTime
      };

      const res = await api.put('/settings', payload);
      setSettings(res.data);
      setCapturedGps(null);
      setAlert({ type: 'success', message: 'System and Company Attendance Settings updated successfully.' });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: err.response?.data?.message || 'Failed to update settings.' });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300 text-left pt-2 pb-10 px-2 sm:px-4">
      {alert && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${alert.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-500'} text-xs font-semibold`}>
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{alert.message}</span>
          </div>
          <button type="button" onClick={() => setAlert(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Page Header with Single Save Configuration Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">System & Company Attendance Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
            Configure company identity, office geofencing coordinates, shift schedules, and automatic clock-out policies.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-extrabold px-6 py-2.5 rounded-full text-xs shadow-md shadow-primary/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Section 1: Main Settings Form - Full Width */}
      <form onSubmit={handleSubmit} className="w-full p-6 md:p-8 rounded-[28px] border border-border/80 bg-card shadow-sm space-y-6">
        {/* General Identity */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Building className="h-4 w-4 text-primary" />
            <span>Organization Identity</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Company Name</label>
              <input
                type="text"
                name="companyName"
                value={settings.companyName}
                onChange={handleChange}
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">System Sender Email</label>
              <input
                type="email"
                name="senderEmail"
                value={settings.senderEmail}
                onChange={handleChange}
                placeholder="e.g. notifications@enterprise.com"
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>
          </div>
        </div>

        <hr className="border-border/40" />

        {/* Attendance & Shift Timing Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Company Attendance & Shift Configuration</span>
            </h3>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
              settings.autoClockOutEnabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${settings.autoClockOutEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {settings.autoClockOutEnabled ? 'AUTO CLOCK-OUT ACTIVE' : 'MANUAL CLOCK-OUT ONLY'}
            </span>
          </div>

          {/* Core Hours Grid */}
          <div className="p-5 rounded-2xl border border-border/70 bg-background/50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-primary">Company Standard Shift Hours</h4>
              <span className="text-[11px] text-muted-foreground font-semibold">Timezone: Asia/Kolkata (IST)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>Clock In Time</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Start of shift</span>
                </label>
                <input
                  type="time"
                  name="clockInTime"
                  value={settings.clockInTime || '09:00'}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-bold text-foreground focus:border-primary outline-none"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                  <span>Clock Out Time</span>
                  <span className="text-[10px] text-muted-foreground font-normal">End of shift</span>
                </label>
                <input
                  type="time"
                  name="clockOutTime"
                  value={settings.clockOutTime || '18:00'}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-bold text-foreground focus:border-primary outline-none"
                  required
                />
              </div>
            </div>

            {/* Auto Clock-Out Toggle Switch */}
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <div className="space-y-0.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-extrabold text-foreground">Enable Auto Clock-Out</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  Automatically clock out employees when the company shift end time is reached. When disabled, employees will still see the live shift countdown, but they must clock out manually.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleAutoClockOut}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoClockOutEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.autoClockOutEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Time Window Rules Configuration */}
          <div className="p-5 rounded-2xl border border-border/70 bg-background/50 space-y-4">
            <h4 className="text-xs font-bold text-primary">Clock-In Time Window & Grace Period Rules</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Early Clock-In Window (Minutes before shift start)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  name="earlyWindowMinutes"
                  value={settings.earlyWindowMinutes}
                  onChange={handleChange}
                  placeholder="e.g. 30"
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
                <span className="text-[10px] text-muted-foreground italic font-medium">Opens check-in at (Clock In − Early Window)</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Grace Period (Minutes after shift start for Late clock-in)</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  name="gracePeriodMinutes"
                  value={settings.gracePeriodMinutes}
                  onChange={handleChange}
                  placeholder="e.g. 15"
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
                <span className="text-[10px] text-muted-foreground italic font-medium">Closes on-time window at (Clock In + Grace Period)</span>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-border/40" />

        {/* Attendance Geofencing Location Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Office Geofencing Configuration</span>
            </h3>
            <button
              type="button"
              onClick={handleGPSAutofill}
              disabled={gpsDetecting}
              className="flex items-center gap-1.5 text-[11px] bg-primary/10 hover:bg-primary/20 text-primary font-extrabold px-3.5 py-1.5 rounded-full border border-primary/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${gpsDetecting ? 'animate-spin' : ''}`} />
              {gpsDetecting ? 'Detecting GPS...' : 'Use My Current Location'}
            </button>
          </div>

          {capturedGps && (
            <div className="p-3.5 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-between text-xs font-semibold animate-in fade-in">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Navigation className="w-4 h-4" />
                <span>Captured Location: Latitude: <code className="font-mono bg-background/80 px-2 py-0.5 rounded-md">{capturedGps.lat}</code> | Longitude: <code className="font-mono bg-background/80 px-2 py-0.5 rounded-md">{capturedGps.lon}</code></span>
              </div>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="px-3 py-1 bg-primary text-white rounded-xl text-[11px] font-black hover:bg-primary-hover transition-all cursor-pointer"
              >
                Save Geofence Now
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1.5 mb-2">
            <label className="text-xs font-bold text-muted-foreground">Office Location Name / Address</label>
            <input
              type="text"
              name="officeLocationName"
              value={settings.officeLocationName || ''}
              onChange={handleChange}
              placeholder="e.g. Innoveity Office, Chennai"
              className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Office Latitude</label>
              <input
                type="number"
                step="any"
                name="officeLatitude"
                value={settings.officeLatitude ?? ''}
                onChange={handleChange}
                placeholder="e.g. 13.0827"
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Office Longitude</label>
              <input
                type="number"
                step="any"
                name="officeLongitude"
                value={settings.officeLongitude ?? ''}
                onChange={handleChange}
                placeholder="e.g. 80.2707"
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Allowed Range Radius (Meters)</label>
              <input
                type="number"
                name="allowedRadiusMeters"
                value={settings.allowedRadiusMeters ?? ''}
                onChange={handleChange}
                placeholder="e.g. 200"
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic font-medium">
            Attendance clock-ins/outs will be geofenced. Members must be within the specified radius (in meters) of this latitude/longitude to mark attendance.
          </p>
        </div>
      </form>

      {/* Section 2: Attendance Policy Rules - Full Width Bottom Row (3 Equal Horizontal Cards) */}
      <div className="w-full p-6 md:p-8 rounded-[28px] border border-border/80 bg-card shadow-sm space-y-5 text-left">
        <div className="flex items-center gap-3 border-b border-border/40 pb-3.5">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Attendance Policy Rules</h3>
            <p className="text-[11px] text-muted-foreground font-medium">Enforced automatically during employee check-in & check-out</p>
          </div>
        </div>

        {/* 3 Horizontal Cards in Single Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-background/50 border border-border/50 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-xs font-extrabold text-foreground">1. Geofence Protection</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Employees must be physically located within <strong className="text-foreground">{settings.allowedRadiusMeters || 200}m</strong> of the configured office coordinates.
              </p>
            </div>
            <span className="text-[10px] font-bold text-primary/80 mt-2 block">Radius: {settings.allowedRadiusMeters || 200}m</span>
          </div>

          <div className="p-4 rounded-2xl bg-background/50 border border-border/50 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-extrabold text-foreground">2. Live Shift Countdown</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                The dashboard displays a live countdown synced with server time until <strong className="text-foreground">{settings.clockOutTime || '18:00'}</strong>.
              </p>
            </div>
            <span className="text-[10px] font-bold text-primary/80 mt-2 block">Shift End: {settings.clockOutTime || '18:00'} (IST)</span>
          </div>

          <div className="p-4 rounded-2xl bg-background/50 border border-border/50 space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-extrabold text-foreground">3. Auto Clock-Out Policy</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Status: <strong className={settings.autoClockOutEnabled ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>{settings.autoClockOutEnabled ? 'Enabled' : 'Disabled'}</strong>. When enabled, active shifts automatically complete when the shift end time is reached.
              </p>
            </div>
            <span className={`text-[10px] font-bold mt-2 block ${settings.autoClockOutEnabled ? 'text-emerald-500' : 'text-amber-500'}`}>
              {settings.autoClockOutEnabled ? '✓ Auto Clock-Out Active' : '⚠ Manual Clock-Out Required'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteSettings;
