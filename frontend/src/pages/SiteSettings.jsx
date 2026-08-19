import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Save, Shield, Clock, Mail, Building, CheckCircle2, MapPin, Navigation, AlertCircle } from 'lucide-react';

const SiteSettings = () => {
  const [settings, setSettings] = useState({
    companyName: 'Innoveity',
    senderEmail: 'somusuraj72@gmail.com',
    internShiftStart: '09:30',
    internShiftEnd: '18:30',
    tlShiftStart: '09:30',
    tlShiftEnd: '18:30',
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
        setSettings(res.data);
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
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
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
      
      const payload = {
        ...settings,
        officeLatitude: lat,
        officeLongitude: lon,
        allowedRadiusMeters: radius,
        earlyWindowMinutes: earlyWin,
        gracePeriodMinutes: gracePer
      };

      const res = await api.put('/settings', payload);
      setSettings(res.data);
      setCapturedGps(null);
      setAlert({ type: 'success', message: `Office Geofence updated successfully (Lat: ${res.data.officeLatitude}, Lon: ${res.data.officeLongitude}, Radius: ${res.data.allowedRadiusMeters}m).` });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: err.response?.data?.message || 'Failed to update settings.' });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-300 text-left pt-2 pb-10 px-2 sm:px-4">
      {alert && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${alert.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-500'} text-xs font-semibold`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {alert.message}
          </span>
          <button onClick={() => setAlert(null)} className="font-bold hover:opacity-75 cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Settings Panel */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left">
        <div className="flex items-center gap-3 border-b border-border/40 pb-4 mb-6">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary border border-primary/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground">Global Site Settings</h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Manage shift timings, geofencing ranges, mail routing, and general application branding.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Branding Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              <span>Branding & Company Info</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={settings.companyName}
                  onChange={handleChange}
                  placeholder="e.g. Innoveity"
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

          <hr className="border-border/40" />

          {/* Shift Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Dynamic Shift Timings</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Intern Shift */}
              <div className="p-5 rounded-2xl border border-border/60 bg-background/50 space-y-4">
                <h4 className="text-xs font-bold text-primary">Internship Core Hours</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Clock-in Deadline</label>
                    <input
                      type="time"
                      name="internShiftStart"
                      value={settings.internShiftStart}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Clock-out Time</label>
                    <input
                      type="time"
                      name="internShiftEnd"
                      value={settings.internShiftEnd}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Team Leader Shift */}
              <div className="p-5 rounded-2xl border border-border/60 bg-background/50 space-y-4">
                <h4 className="text-xs font-bold text-primary">Team Leader Core Hours</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Clock-in Deadline</label>
                    <input
                      type="time"
                      name="tlShiftStart"
                      value={settings.tlShiftStart}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">Clock-out Time</label>
                    <input
                      type="time"
                      name="tlShiftEnd"
                      value={settings.tlShiftEnd}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Time Window Rules Configuration */}
            <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-4">
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
                  <span className="text-[10px] text-muted-foreground italic font-medium">Default: 30 mins (Opens at Shift Start − Early Window)</span>
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
                  <span className="text-[10px] text-muted-foreground italic font-medium">Default: 15 mins (Closes at Shift Start + Grace Period)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border/40">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Save className="h-4 w-4 text-white" />
              {loading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SiteSettings;
