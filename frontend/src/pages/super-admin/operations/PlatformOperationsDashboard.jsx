import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Database, Wrench, Download, RefreshCw, FileText, CheckCircle2, UserX } from 'lucide-react';
import api from '../../../services/api';
import PlatformHealthCard from '../../../components/operations/PlatformHealthCard';
import BackupTimeline from '../../../components/operations/BackupTimeline';
import MaintenanceActionCard from '../../../components/operations/MaintenanceActionCard';
import RestoreProgressModal from '../../../components/operations/RestoreProgressModal';

const PlatformOperationsDashboard = () => {
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [selectedRestoreBackupId, setSelectedRestoreBackupId] = useState(null);

  // Exporter state
  const [exportType, setExportType] = useState('ATTENDANCE');
  const [exportFormat, setExportFormat] = useState('CSV');
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const fetchHealth = async () => {
    try {
      setLoadingHealth(true);
      const res = await api.get('/platform/health');
      if (res.data?.data) {
        setHealth(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch platform health:', err);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerExport = async (e) => {
    e.preventDefault();
    try {
      setExporting(true);
      const res = await api.post('/maintenance/export', {
        targetType: exportType,
        format: exportFormat
      });
      if (res.data?.success) {
        alert(res.data?.message || 'Audit export job enqueued.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to trigger audit export.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-left">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-600" /> Platform Operations & Disaster Recovery
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">
            Real-time system health, automated backup timelines, maintenance routines, and compliance desk
          </p>
        </div>
        <button
          onClick={fetchHealth}
          className="p-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
          title="Refresh Health Metrics"
        >
          <RefreshCw className={`h-4 w-4 ${loadingHealth ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>

      {/* Platform Real-Time Health Cards */}
      <PlatformHealthCard health={health} />

      {/* Main Grid: Backup Timeline & Maintenance Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BackupTimeline onSelectRestore={(bkpId) => setSelectedRestoreBackupId(bkpId)} />
        
        <div className="space-y-6">
          <MaintenanceActionCard onRefresh={fetchHealth} />

          {/* Audit Log Exporter Desk */}
          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-4 text-left">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-black text-foreground">Audit Log Exporter</h3>
            </div>

            <form onSubmit={handleTriggerExport} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">Target Category</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-border bg-background"
                >
                  <option value="ATTENDANCE">Attendance Logs</option>
                  <option value="ORGANIZATION_ACTIVITY">Org Activity Logs</option>
                  <option value="SECURITY_EVENTS">Security Events</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted-foreground mb-1">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-border bg-background"
                >
                  <option value="CSV">CSV Format</option>
                  <option value="JSON">JSON Snapshot</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={exporting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-extrabold text-xs hover:bg-blue-700 shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {exporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  <span>Generate Export</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Restore Progress & Dry-Run Modal */}
      <RestoreProgressModal
        backupId={selectedRestoreBackupId}
        onClose={() => setSelectedRestoreBackupId(null)}
      />
    </div>
  );
};

export default PlatformOperationsDashboard;
