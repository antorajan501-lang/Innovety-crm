import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Home, MapPin, Clock, AlertTriangle, CheckCircle2, X, RefreshCw, ShieldAlert, Navigation } from 'lucide-react';
import { formatLateDuration } from '../../utils/attendanceFormatter';

const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const numLat1 = parseFloat(lat1);
  const numLon1 = parseFloat(lon1);
  const numLat2 = parseFloat(lat2);
  const numLon2 = parseFloat(lon2);
  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) return Infinity;

  const R = 6371000; // Radius of Earth in meters
  const dLat = (numLat2 - numLat1) * (Math.PI / 180);
  const dLon = (numLon2 - numLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(numLat1 * (Math.PI / 180)) * Math.cos(numLat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

const formatDistance = (meters) => {
  if (meters === null || meters === undefined || isNaN(meters)) return 'Unknown';
  const m = Math.round(meters);
  if (m < 1000) {
    return `${m} m`;
  }
  const km = (m / 1000).toFixed(1);
  return `${km} km`;
};

export default function ClockInModal({ isOpen, onClose, onSuccess, user }) {
  // Geofence & Location states: 'IDLE' | 'DETECTING' | 'PERMISSION_DENIED' | 'GPS_ERROR' | 'INSIDE' | 'OUTSIDE'
  const [geoState, setGeoState] = useState('IDLE');
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [distanceMeters, setDistanceMeters] = useState(null);
  
  // Outside form states
  const [outsideWorkLocation, setOutsideWorkLocation] = useState('HOME');
  const [workLocationOther, setWorkLocationOther] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [clockStatus, setClockStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setOutsideWorkLocation('HOME');
      setWorkLocationOther('');
      setErrorMsg('');
      fetchClockStatusAndGeofence();
    }
  }, [isOpen]);

  const fetchClockStatusAndGeofence = async () => {
    try {
      setStatusLoading(true);
      const res = await api.get('/attendance/status');
      setClockStatus(res.data);
      
      const g = res.data?.geofence || {
        officeLatitude: 12.971598,
        officeLongitude: 77.594562,
        allowedRadiusMeters: 200
      };
      
      requestGPSLocation(g);
    } catch (err) {
      console.error('Failed to fetch clock status & geofence:', err);
      requestGPSLocation({
        officeLatitude: 12.971598,
        officeLongitude: 77.594562,
        allowedRadiusMeters: 200
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const requestGPSLocation = (geofenceTarget) => {
    const targetGeofence = geofenceTarget || clockStatus?.geofence || {
      officeLatitude: 12.971598,
      officeLongitude: 77.594562,
      allowedRadiusMeters: 200
    };

    setGeoState('DETECTING');
    setErrorMsg('');

    if (!navigator.geolocation) {
      setGeoState('GPS_ERROR');
      setErrorMsg('Unable to determine your current location. Please enable location services and try again.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lon = parseFloat(position.coords.longitude.toFixed(6));
        setCoords({ latitude: lat, longitude: lon });

        const dist = calculateHaversineDistance(
          lat,
          lon,
          targetGeofence.officeLatitude,
          targetGeofence.officeLongitude
        );
        setDistanceMeters(dist);

        if (dist <= targetGeofence.allowedRadiusMeters) {
          setGeoState('INSIDE');
        } else {
          setGeoState('OUTSIDE');
        }
      },
      (error) => {
        console.warn('GPS position error:', error);
        if (error.code === 1) { // PERMISSION_DENIED
          setGeoState('PERMISSION_DENIED');
          setErrorMsg('Location permission is required to verify your location before Clock-In.');
        } else {
          setGeoState('GPS_ERROR');
          setErrorMsg('Unable to determine your current location. Please enable location services and try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (!isOpen) return null;

  const allowedRadius = clockStatus?.geofence?.allowedRadiusMeters || 200;
  const officeName = clockStatus?.geofence?.officeLocationName || 'Office';
  const targetOfficeLat = clockStatus?.geofence?.officeLatitude;
  const targetOfficeLon = clockStatus?.geofence?.officeLongitude;

  const isOtherInvalid = geoState === 'OUTSIDE' && outsideWorkLocation === 'OTHER' && !workLocationOther.trim();
  const calculatedStatus = clockStatus?.state === 'OPEN_LATE' ? 'LATE' : 'PRESENT';
  const lateMinutes = clockStatus?.lateMinutes || 0;
  const currentTimeDisplay = clockStatus?.currentTimeFormatted || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (geoState === 'PERMISSION_DENIED' || geoState === 'GPS_ERROR' || geoState === 'DETECTING') {
      setErrorMsg('Location verification is required before completing Clock-In.');
      return;
    }

    if (isOtherInvalid) {
      setErrorMsg('Location or reason is required when "Other" is selected.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const workLoc = geoState === 'INSIDE' ? 'OFFICE' : outsideWorkLocation;

      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        workLocation: workLoc,
        workLocationOther: workLoc === 'OTHER' ? workLocationOther.trim() : (workLocationOther.trim() || null)
      };

      const res = await api.post('/attendance/clock-in', payload);

      if (onSuccess) {
        onSuccess(res.data?.attendance || res.data);
      }
      onClose();
    } catch (err) {
      console.error('Clock in error:', err);
      const errRes = err.response?.data;

      if (errRes?.reason === 'OUTSIDE_GEOFENCE') {
        setGeoState('OUTSIDE');
        if (errRes.distanceMeters) {
          setDistanceMeters(errRes.distanceMeters);
        }
        setErrorMsg(errRes.message || 'You are currently outside the permitted location.');
      } else {
        setErrorMsg(errRes?.message || err.message || 'Clock in failed. Please try again.');
      }
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
              <Clock className="w-5 h-5 text-primary" /> Attendance Clock In
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Geofence location verification & shift check-in.
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

        {/* GEOLOCATION WORKFLOW CONTAINER */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* STATE 1: DETECTING LOCATION */}
          {geoState === 'DETECTING' && (
            <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5 text-center space-y-3 animate-in fade-in">
              <div className="flex items-center justify-center">
                <Navigation className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Detecting your location...</h4>
                <p className="text-xs text-muted-foreground">Verifying GPS coordinates against office geofence.</p>
              </div>
            </div>
          )}

          {/* STATE 2: GPS PERMISSION DENIED OR ERROR */}
          {(geoState === 'PERMISSION_DENIED' || geoState === 'GPS_ERROR') && (
            <div className="p-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-left space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    {geoState === 'PERMISSION_DENIED' ? 'Location Access Required' : 'GPS Unavailable'}
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                    {errorMsg || 'Location permission is required to verify your location before Clock-In.'}
                  </p>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => requestGPSLocation()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: INSIDE GEOFENCE (AUTOMATIC LOCATION VERIFIED) */}
          {geoState === 'INSIDE' && (
            <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-3 animate-in fade-in text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                    Location Verified
                  </h4>
                  <p className="text-xs text-emerald-600/90 dark:text-emerald-300/90 font-semibold">
                    You are within the permitted location.
                  </p>
                </div>
              </div>

              <div className="bg-background/80 rounded-xl p-3 text-xs space-y-1.5 border border-emerald-500/20 font-medium">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Office Location:</span>
                  <span className="font-bold text-foreground">{officeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatDistance(distanceMeters)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Allowed Radius:</span>
                  <span className="font-bold text-foreground font-mono">{allowedRadius} m</span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: OUTSIDE GEOFENCE (SHOW HOME / OTHER ONLY — NO OFFICE) */}
          {geoState === 'OUTSIDE' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">
                    Outside Permitted Location
                  </h4>
                </div>
                <p className="text-xs text-amber-800/90 dark:text-amber-200/90 font-medium">
                  You are currently outside the permitted location.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  <div className="bg-background/70 rounded-xl p-2.5 border border-amber-500/20 text-center">
                    <span className="text-[10px] text-muted-foreground font-sans uppercase font-bold block">Distance</span>
                    <span className="font-black text-amber-600 dark:text-amber-400">{formatDistance(distanceMeters)}</span>
                  </div>
                  <div className="bg-background/70 rounded-xl p-2.5 border border-amber-500/20 text-center">
                    <span className="text-[10px] text-muted-foreground font-sans uppercase font-bold block">Allowed Radius</span>
                    <span className="font-black text-foreground">{allowedRadius} m</span>
                  </div>
                </div>

                {/* Diagnostics Preview Card */}
                {coords.latitude && (
                  <div className="mt-2 p-2 rounded-lg bg-background/60 text-[10px] text-muted-foreground font-mono border border-amber-500/10 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Your GPS:</span>
                      <span className="font-bold text-foreground">{coords.latitude}, {coords.longitude}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Target Office:</span>
                      <span className="font-bold text-foreground">{targetOfficeLat ?? '—'}, {targetOfficeLon ?? '—'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* OUTSIDE LOCATION FORM: HOME / OTHER ONLY (NO OFFICE OPTION) */}
              <div className="space-y-3 text-left">
                <label className="text-xs font-bold text-foreground block">
                  Where are you working from? <span className="text-rose-500">*</span>
                </label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOutsideWorkLocation('HOME')}
                    className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-center transition-all cursor-pointer ${
                      outsideWorkLocation === 'HOME'
                        ? 'bg-primary/10 border-primary text-primary font-black shadow-sm ring-2 ring-primary/20'
                        : 'bg-background border-border/80 text-muted-foreground hover:bg-muted/50 font-medium'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span className="text-xs font-bold">Home</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutsideWorkLocation('OTHER')}
                    className={`p-3.5 rounded-2xl border flex items-center justify-center gap-2 text-center transition-all cursor-pointer ${
                      outsideWorkLocation === 'OTHER'
                        ? 'bg-primary/10 border-primary text-primary font-black shadow-sm ring-2 ring-primary/20'
                        : 'bg-background border-border/80 text-muted-foreground hover:bg-muted/50 font-medium'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold">Other</span>
                  </button>
                </div>

                {/* Reason Input */}
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-bold text-foreground block">
                    Reason {outsideWorkLocation === 'OTHER' && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={workLocationOther}
                    onChange={(e) => setWorkLocationOther(e.target.value)}
                    placeholder={outsideWorkLocation === 'OTHER' ? 'Enter location or reason (required)' : 'Working from home today (optional)'}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required={outsideWorkLocation === 'OTHER'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Inline Error Message */}
          {errorMsg && geoState !== 'PERMISSION_DENIED' && geoState !== 'GPS_ERROR' && (
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

            {(geoState === 'INSIDE' || geoState === 'OUTSIDE') && (
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
