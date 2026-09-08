import React, { useState } from 'react';
import { Wrench, HardDrive, Trash2, RefreshCw, Layers } from 'lucide-react';
import api from '../../services/api';

const MaintenanceActionCard = ({ onRefresh }) => {
  const [running, setRunning] = useState(null);

  const handleAction = async (actionType, label) => {
    try {
      setRunning(actionType);
      const res = await api.post('/maintenance/run', { action: actionType });
      if (res.data?.success) {
        alert(res.data?.message || `${label} completed.`);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      alert(err.response?.data?.message || `Failed to execute ${label}.`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-4 text-left">
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-black text-foreground">Maintenance Utilities Panel</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          disabled={Boolean(running)}
          onClick={() => handleAction('STORAGE_RECALCULATION', 'Storage Recalculation')}
          className="p-3.5 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border/40 text-left space-y-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-black text-foreground">
            <span className="flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 text-blue-500" /> Recalculate Storage
            </span>
            {running === 'STORAGE_RECALCULATION' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Re-scans tenant upload folders and updates capacity metrics.</p>
        </button>

        <button
          disabled={Boolean(running)}
          onClick={() => handleAction('ORPHAN_CLEANUP', 'Orphan Files Cleanup')}
          className="p-3.5 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border/40 text-left space-y-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-black text-foreground">
            <span className="flex items-center gap-1.5">
              <Trash2 className="h-4 w-4 text-rose-500" /> Clear Orphan Uploads
            </span>
            {running === 'ORPHAN_CLEANUP' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Removes unreferenced files to free server storage.</p>
        </button>

        <button
          disabled={Boolean(running)}
          onClick={() => handleAction('REBUILD_STATS', 'Rebuild Statistics')}
          className="p-3.5 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-border/40 text-left space-y-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-xs font-black text-foreground">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-purple-500" /> Rebuild Org Statistics
            </span>
            {running === 'REBUILD_STATS' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">Recomputes tenant entity counts across database models.</p>
        </button>
      </div>
    </div>
  );
};

export default MaintenanceActionCard;
