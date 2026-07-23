import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Save, Shield, Clock, Mail, Building, CheckCircle2, MapPin } from 'lucide-react';

const SiteSettings = () => {
  const [settings, setSettings] = useState({
    companyName: 'MRF Enterprise',
    senderEmail: 'somusuraj72@gmail.com',
    internShiftStart: '09:30',
    internShiftEnd: '18:30',
    tlShiftStart: '09:30',
    tlShiftEnd: '18:30',
    officeLatitude: 12.971598,
    officeLongitude: 77.594562,
    allowedRadiusMeters: 200,
    officeLocationName: 'MRF Headquarters',
    earlyWindowMinutes: 30,
    gracePeriodMinutes: 15
  });

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

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
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSettings(prev => ({
          ...prev,
          officeLatitude: parseFloat(position.coords.latitude.toFixed(6)),
          officeLongitude: parseFloat(position.coords.longitude.toFixed(6))
        }));
        setAlert({ type: 'success', message: 'GPS coordinates autofilled successfully.' });
      },
      (error) => {
        setAlert({ type: 'error', message: 'Failed to fetch GPS location: ' + error.message });
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setAlert(null);

      const earlyWin = parseInt(settings.earlyWindowMinutes, 10);
      const gracePer = parseInt(settings.gracePeriodMinutes, 10);

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
        officeLatitude: parseFloat(settings.officeLatitude),
        officeLongitude: parseFloat(settings.officeLongitude),
        allowedRadiusMeters: parseFloat(settings.allowedRadiusMeters),
        earlyWindowMinutes: earlyWin,
        gracePeriodMinutes: gracePer
      };

      const res = await api.put('/settings', payload);
      setSettings(res.data);
      setAlert({ type: 'success', message: 'System settings updated successfully.' });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlert({ type: 'error', message: err.response?.data?.message || 'Failed to update settings.' });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      {alert && (
        <div className={`flex items-center justify-between p-4 rounded-xl border ${alert.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-500'} text-xs font-semibold`}>
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Main Settings Panel */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left">
        <div className="flex items-center gap-3 border-b border-border/30 pb-4 mb-6">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Global Site Settings</h2>
            <p className="text-xs text-muted-foreground">Manage shift timings, geofencing ranges, mail routing, and general application branding.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Branding Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              Branding & Company Info
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Company Name</label>
                <input
                  type="text"
                  name="companyName"
                  value={settings.companyName}
                  onChange={handleChange}
                  placeholder="e.g. MRF Enterprise"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">System Sender Email</label>
                <input
                  type="email"
                  name="senderEmail"
                  value={settings.senderEmail}
                  onChange={handleChange}
                  placeholder="e.g. notifications@enterprise.com"
                  required
                />
              </div>
            </div>
          </div>

          <hr className="border-border/30" />

          {/* Attendance Geofencing Location Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Office Geofencing Configuration
              </h3>
              <button
                type="button"
                onClick={handleGPSAutofill}
                className="text-[10px] bg-primary/10 hover:bg-primary/20 text-primary font-bold px-3 py-1.5 rounded-lg border border-primary/20 transition-all"
              >
                Use My Current Location
              </button>
            </div>

            <div className="flex flex-col gap-1.5 mb-2">
              <label className="text-xs font-semibold text-muted-foreground">Office Location Name / Address</label>
              <input
                type="text"
                name="officeLocationName"
                value={settings.officeLocationName || ''}
                onChange={handleChange}
                placeholder="e.g. MRF Office, Bangalore"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Office Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  name="officeLatitude"
                  value={settings.officeLatitude}
                  onChange={handleChange}
                  placeholder="e.g. 12.971598"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Office Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  name="officeLongitude"
                  value={settings.officeLongitude}
                  onChange={handleChange}
                  placeholder="e.g. 77.594562"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Allowed Range Radius (Meters)</label>
                <input
                  type="number"
                  name="allowedRadiusMeters"
                  value={settings.allowedRadiusMeters}
                  onChange={handleChange}
                  placeholder="e.g. 200"
                  required
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Attendance clock-ins/outs will be geofenced. Members must be within the specified radius (in meters) of this latitude/longitude to mark attendance.
            </p>
          </div>

          <hr className="border-border/30" />

          {/* Shift Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Dynamic Shift Timings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Intern Shift */}
              <div className="p-4 rounded-xl border border-border/30 bg-muted/10 space-y-4">
                <h4 className="text-xs font-bold text-indigo-500">Internship Core Hours</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">Clock-in Deadline</label>
                    <input
                      type="time"
                      name="internShiftStart"
                      value={settings.internShiftStart}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">Clock-out Time</label>
                    <input
                      type="time"
                      name="internShiftEnd"
                      value={settings.internShiftEnd}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Team Leader Shift */}
              <div className="p-4 rounded-xl border border-border/30 bg-muted/10 space-y-4">
                <h4 className="text-xs font-bold text-violet-500">Admin Core Hours</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">Clock-in Deadline</label>
                    <input
                      type="time"
                      name="tlShiftStart"
                      value={settings.tlShiftStart}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">Clock-out Time</label>
                    <input
                      type="time"
                      name="tlShiftEnd"
                      value={settings.tlShiftEnd}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Time Window Rules Configuration */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4">
              <h4 className="text-xs font-bold text-primary">Clock-In Time Window & Grace Period Rules</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Early Clock-In Window (Minutes before shift start)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    name="earlyWindowMinutes"
                    value={settings.earlyWindowMinutes}
                    onChange={handleChange}
                    placeholder="e.g. 30"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground italic">Default: 30 mins (Opens at Shift Start − Early Window)</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Grace Period (Minutes after shift start for Late clock-in)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    name="gracePeriodMinutes"
                    value={settings.gracePeriodMinutes}
                    onChange={handleChange}
                    placeholder="e.g. 15"
                    required
                  />
                  <span className="text-[10px] text-muted-foreground italic">Default: 15 mins (Closes at Shift Start + Grace Period)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border/30">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving Changes...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SiteSettings;
