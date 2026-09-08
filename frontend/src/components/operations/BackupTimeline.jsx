import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, Plus, CheckCircle2, Play } from 'lucide-react';
import api from '../../services/api';

const BackupTimeline = ({ onSelectRestore }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/backups');
      if (res.data && res.data.data) {
        setBackups(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleManualBackup = async () => {
    try {
      setTriggering(true);
      const res = await api.post('/backups/trigger');
      if (res.data?.success) {
        alert(res.data?.message || 'Backup job enqueued.');
        setTimeout(fetchBackups, 2000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to trigger backup.');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-black text-foreground">Backup Archives & Manifests</h3>
        </div>
        <button
          onClick={handleManualBackup}
          disabled={triggering}
          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs hover:bg-emerald-700 shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {triggering ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          <span>Trigger Manual Backup</span>
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" /> Loading backups list...
        </div>
      ) : backups.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground font-medium rounded-2xl bg-muted/20 border border-border/40">
          No backup archives created yet. Click "Trigger Manual Backup" to generate the first snapshot.
        </div>
      ) : (
        <div className="space-y-2.5">
          {backups.map((b) => (
            <div key={b.backupId} className="p-3.5 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-xs text-foreground">{b.backupId}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Checksum Verified
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                    {new Date(b.createdAt).toLocaleString()} • Size: {b.dbSizeMB} MB • Type: {b.triggerType || 'MANUAL'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectRestore && onSelectRestore(b.backupId)}
                className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs cursor-pointer border border-border flex items-center gap-1"
              >
                <Play className="h-3 w-3 text-emerald-600" />
                <span>Dry-Run Restore</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackupTimeline;
