import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, AlertTriangle, Flame, Clock, UserX,
  ChevronRight, CheckCircle2, RefreshCw, MessageSquare
} from 'lucide-react';
import api from '../../services/api';

const ALERT_SEVERITY_THEMES = {
  CRITICAL: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10 text-rose-600',
    icon: Flame
  },
  HIGH: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10 text-amber-600',
    icon: AlertTriangle
  },
  MEDIUM: {
    border: 'border-indigo-500/30',
    bg: 'bg-indigo-500/10 text-indigo-600',
    icon: Clock
  }
};

const PredictiveAlerts = ({ organizationId }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState({});

  const fetchAlerts = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await api.get('/intelligence/predictive-alerts', { params: { organizationId } });
      if (res.data?.success) {
        setAlerts(res.data.alerts || []);
      }
    } catch (err) {
      console.warn('Error fetching predictive alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [organizationId]);

  const handleAcknowledge = (id) => {
    setAcknowledged(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="space-y-5 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-border/40">
        <div>
          <h2 className="text-base font-black text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <span>Predictive Risk Alerts</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Advisory warnings flagging fatigue risks, excessive hours, and punctuality dips.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {loading && alerts.length === 0 ? (
        <div className="p-12 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
          <span>Scanning workforce telemetry for risk indicators...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-dashed border-border/60 bg-card/40 space-y-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mx-auto" />
          <p className="text-sm font-bold text-foreground">Zero High-Risk Alerts</p>
          <p className="text-xs text-muted-foreground">All team members are operating within healthy workload limits.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {alerts.map((alert) => {
              const theme = ALERT_SEVERITY_THEMES[alert.severity] || ALERT_SEVERITY_THEMES.MEDIUM;
              const Icon = theme.icon;
              const isAck = acknowledged[alert.id];

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-5 rounded-3xl border ${theme.border} bg-card hover:border-border transition-all shadow-xs space-y-3 relative ${
                    isAck ? 'opacity-60 bg-muted/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${theme.bg}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-foreground">{alert.title}</h4>
                        <p className="text-[11px] text-muted-foreground font-semibold">
                          {alert.userName} • <span className="text-primary">{alert.department}</span>
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${theme.bg} ${theme.border}`}>
                      {alert.severity}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alert.description}
                  </p>

                  <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/30 text-[11px] text-foreground font-medium flex items-center justify-between gap-2">
                    <span className="truncate">💡 {alert.recommendation}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground font-semibold italic">Advisory only • No payroll penalty</span>
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isAck}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isAck
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary text-white hover:bg-primary/90 shadow-xs'
                      }`}
                    >
                      {isAck ? 'Acknowledged' : 'Acknowledge'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default PredictiveAlerts;
