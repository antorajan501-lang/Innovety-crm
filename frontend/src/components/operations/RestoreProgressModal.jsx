import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Play, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import api from '../../services/api';

const RestoreProgressModal = ({ backupId, onClose }) => {
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  useEffect(() => {
    if (!backupId) return;
    setLoading(true);
    api.post('/backups/restore/dry-run', { backupId })
      .then((res) => {
        setSimulation(res.data);
      })
      .catch((err) => {
        setSimulation({
          dryRunPassed: false,
          message: err.response?.data?.message || 'Dry-run simulation failed!'
        });
      })
      .finally(() => setLoading(false));
  }, [backupId]);

  const handleConfirmRestore = async () => {
    if (!window.confirm('Are you sure you want to execute this restore? Database state will be restored from backup.')) return;

    try {
      setRestoring(true);
      const res = await api.post('/backups/restore/confirm', { backupId });
      if (res.data?.success) {
        setRestoreSuccess(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Restore failed!');
    } finally {
      setRestoring(false);
    }
  };

  if (!backupId) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 text-left my-8 relative"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-black text-foreground">Disaster Recovery Dry-Run</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" /> Running dry-run integrity simulation...
            </div>
          ) : restoreSuccess ? (
            <div className="p-6 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-black text-foreground">Restore Complete!</h4>
              <p className="text-xs text-muted-foreground font-medium">
                The database was successfully restored from backup {backupId}.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border text-xs font-medium space-y-2 ${simulation?.dryRunPassed ? 'bg-emerald-500/10 border-emerald-500/20 text-foreground' : 'bg-rose-500/10 border-rose-500/20 text-rose-600'}`}>
                <div className="flex items-center gap-2 font-bold text-xs">
                  {simulation?.dryRunPassed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-400">Dry-Run Simulation Passed</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      <span>Dry-Run Simulation Failed</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{simulation?.message}</p>
              </div>

              {simulation?.dryRunPassed && simulation.simulationSummary && (
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/40 space-y-2 text-xs font-bold">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Restore Target Summary</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>Users: {simulation.simulationSummary.usersToRestore}</div>
                    <div>Projects: {simulation.simulationSummary.projectsToRestore}</div>
                    <div>Attendance: {simulation.simulationSummary.attendancesToRestore}</div>
                    <div>Work Logs: {simulation.simulationSummary.workLogsToRestore}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={!simulation?.dryRunPassed || restoring}
                  onClick={handleConfirmRestore}
                  className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span>Confirm Restore</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RestoreProgressModal;
