import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, Key, Cog, Palette, Award, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

const actionIcons = {
  COMPANY_CREATED: ShieldCheck,
  COMPANY_SUSPENDED: AlertTriangle,
  COMPANY_ACTIVATED: ShieldCheck,
  ADMIN_PASSWORD_RESET: Key,
  SETTINGS_UPDATED: Cog,
  BRANDING_UPDATED: Palette,
  PLAN_CHANGED: Award
};

const TenantAuditTimeline = ({ organizationId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    api.get(`/organizations/${organizationId}/audit-logs`)
      .then((res) => {
        if (res.data && res.data.data) {
          setLogs(res.data.data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load audit logs:', err);
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  if (loading) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground font-bold flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
        <span>Loading tenant audit logs...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground font-medium rounded-2xl bg-muted/20 border border-border/40">
        No audit log history recorded yet for this organization.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      {logs.map((log) => {
        const IconComponent = actionIcons[log.action] || History;
        return (
          <div key={log.id} className="p-3 rounded-2xl bg-muted/30 border border-border/40 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-foreground">{log.action.replace('_', ' ')}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Actor: <span className="text-foreground font-bold">{log.actorEmail || 'System'}</span>
              </p>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10">
                  {JSON.stringify(log.metadata)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TenantAuditTimeline;
