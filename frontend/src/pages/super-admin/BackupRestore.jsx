import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HardDrive, Download, CheckCircle2, AlertCircle, RefreshCw,
  ShieldCheck, Database, Clock, Trash2, ArrowDownToLine,
  Sparkles, Layers, Users, Calendar, DollarSign, FolderOpen,
  MessageSquare, History, FileText, Check, AlertTriangle, X,
  ChevronDown, ChevronUp, Search, ShieldAlert, FileCheck,
  UploadCloud, RotateCcw, AlertOctagon, FileCode
} from 'lucide-react';
import api from '../../services/api';

const PROGRESS_STEPS = [
  { id: 1, label: 'Creating backup...' },
  { id: 2, label: 'Verifying SQL...' },
  { id: 3, label: 'Comparing live data...' },
  { id: 4, label: 'Checking integrity...' },
  { id: 5, label: 'Backup ready.' }
];

const RESTORE_STEPS = [
  { id: 1, label: 'Validating backup...' },
  { id: 2, label: 'Creating safety backup...' },
  { id: 3, label: 'Preparing database...' },
  { id: 4, label: 'Restoring tables...' },
  { id: 5, label: 'Importing data...' },
  { id: 6, label: 'Verifying restored data...' },
  { id: 7, label: 'Finalizing...' }
];

const IMPORT_SQL_STEPS = [
  { id: 1, label: 'Validating SQL...' },
  { id: 2, label: 'Creating safety backup...' },
  { id: 3, label: 'Importing tables...' },
  { id: 4, label: 'Importing data...' },
  { id: 5, label: 'Verifying records...' },
  { id: 6, label: 'Finalizing...' }
];

const BackupRestore = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [createdBackup, setCreatedBackup] = useState(null);
  const [latestValidation, setLatestValidation] = useState(null);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [failureDetails, setFailureDetails] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Restore Feature State (Phases 1-10)
  const restoreInputRef = useRef(null);
  const [restoreValidating, setRestoreValidating] = useState(false);
  const [restorePreviewOpen, setRestorePreviewOpen] = useState(false);
  const [restorePreviewData, setRestorePreviewData] = useState(null);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [restoreCurrentStep, setRestoreCurrentStep] = useState(0);
  const [restoredSuccessData, setRestoredSuccessData] = useState(null);

  // Import SQL Feature State (Steps 1-10)
  const sqlInputRef = useRef(null);
  const [sqlValidating, setSqlValidating] = useState(false);
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);
  const [sqlPreviewData, setSqlPreviewData] = useState(null);
  const [sqlInProgress, setSqlInProgress] = useState(false);
  const [sqlCurrentStep, setSqlCurrentStep] = useState(0);
  const [sqlSuccessData, setSqlSuccessData] = useState(null);

  // Table comparison search and filter in validation view
  const [searchTable, setSearchTable] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'critical', 'mismatch'

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/backups');
      if (res.data?.success) {
        setBackups(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch backup history:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load backup history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const triggerFileDownload = async (fileName) => {
    try {
      setDownloadingId(fileName);
      const response = await api.get(`/backups/download/${fileName}`, {
        responseType: 'blob'
      });

      const mimeType = fileName.toLowerCase().endsWith('.sql') ? 'application/sql' : 'application/zip';
      const blob = new Blob([response.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download backup file. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateLiveBackup = async () => {
    setConfirmModalOpen(false);
    setInProgress(true);
    setCurrentStep(1);
    setErrorMsg(null);
    setFailureDetails(null);
    setCreatedBackup(null);
    setLatestValidation(null);

    // Simulated progress transitions to reflect real backend validation phases smoothly
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 450);

    try {
      const res = await api.post('/backups/live');
      clearInterval(stepInterval);

      if (res.data?.success) {
        setCurrentStep(5);
        const { backup, validation } = res.data;
        setCreatedBackup(backup);
        setLatestValidation(validation);
        setSuccessBanner(`Live backup ${backup.fileName} created and validated successfully.`);

        // Trigger automatic download
        triggerFileDownload(backup.fileName);

        // Refresh history
        fetchBackups();

        // Close progress overlay after short delay
        setTimeout(() => {
          setInProgress(false);
        }, 1200);
      } else {
        throw new Error(res.data?.message || 'Failed to validate live backup.');
      }
    } catch (err) {
      clearInterval(stepInterval);
      setInProgress(false);

      const resData = err.response?.data;
      const msg = resData?.message || err.message || 'Backup Validation Failed';
      const errors = resData?.errors || [msg];
      const validation = resData?.validation || null;

      setErrorMsg(msg);
      setFailureDetails({
        message: msg,
        errors,
        validation
      });
    }
  };

  /**
   * Phase 2 & 3: File Upload & Pre-Restore Validation Handler
   */
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be selected again if needed
    if (restoreInputRef.current) {
      restoreInputRef.current.value = '';
    }

    // Phase 2 check: Only accept .zip
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErrorMsg('Invalid Backup File: Only .zip backup archives are accepted.');
      setFailureDetails({
        message: 'Invalid Backup File',
        errors: ['The selected file is not a valid .zip archive. Please upload an Innoveity CRM backup ZIP.']
      });
      return;
    }

    setErrorMsg(null);
    setFailureDetails(null);
    setRestoreValidating(true);

    const formData = new FormData();
    formData.append('backupZip', file);

    try {
      const res = await api.post('/backups/restore/validate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setRestorePreviewData(res.data);
        setRestorePreviewOpen(true);
      } else {
        throw new Error(res.data?.message || 'Backup validation failed.');
      }
    } catch (err) {
      console.error('Restore validation error:', err);
      const resData = err.response?.data;
      const msg = resData?.message || err.message || 'Invalid Backup File';
      const errors = resData?.errors || [msg];
      setErrorMsg(msg);
      setFailureDetails({
        message: msg,
        errors
      });
    } finally {
      setRestoreValidating(false);
    }
  };

  /**
   * Phase 5, 6, 7, 8, 9: Confirmed Restore Execution Handler
   */
  const handleExecuteRestore = async () => {
    if (!restorePreviewData?.tempFileName) return;

    setRestorePreviewOpen(false);
    setRestoreInProgress(true);
    setRestoreCurrentStep(1);
    setErrorMsg(null);
    setFailureDetails(null);

    // Live progress transitions smoothly through Phase 7 steps
    const stepInterval = setInterval(() => {
      setRestoreCurrentStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 600);

    try {
      const res = await api.post('/backups/restore/execute', {
        tempFileName: restorePreviewData.tempFileName,
        originalFileName: restorePreviewData.originalFileName
      });

      clearInterval(stepInterval);

      if (res.data?.success) {
        setRestoreCurrentStep(7);
        setRestoredSuccessData(res.data);
        setSuccessBanner(`Backup restored successfully at ${res.data.restoreTime}.`);

        // Refresh history to display Pre-Restore Backup (Saved) & Restored Backup (Completed)
        fetchBackups();

        setTimeout(() => {
          setRestoreInProgress(false);
        }, 1200);
      } else {
        throw new Error(res.data?.message || 'Restore failed.');
      }
    } catch (err) {
      clearInterval(stepInterval);
      setRestoreInProgress(false);

      const resData = err.response?.data;
      const msg = resData?.message || err.message || 'Restore Failed';
      const errors = resData?.verification?.errors || [msg];

      setErrorMsg(msg);
      setFailureDetails({
        message: 'Restore Verification Failed',
        errors: [
          msg,
          ...(resData?.safetyBackup ? [`Automatic safety backup [${resData.safetyBackup.fileName}] is preserved in history for rollback.`] : [])
        ]
      });
    }
  };

  /**
   * Step 2 & 3: File Upload & Validation Handler for Import SQL
   */
  const handleSqlFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (sqlInputRef.current) {
      sqlInputRef.current.value = '';
    }

    // Step 2: Strictly allow only .sql
    if (!file.name.toLowerCase().endsWith('.sql')) {
      setErrorMsg('Invalid SQL File – Only .sql files are allowed.');
      setFailureDetails({
        message: 'Invalid SQL File',
        errors: [
          'Invalid SQL File – Only .sql files are allowed.',
          'Files with extensions like .zip, .txt, .csv, or other formats are strictly rejected.'
        ]
      });
      return;
    }

    setErrorMsg(null);
    setFailureDetails(null);
    setSqlValidating(true);

    const formData = new FormData();
    formData.append('sqlFile', file);

    try {
      // Do not manually override Content-Type; let Axios / browser set multipart/form-data boundary automatically
      const res = await api.post('/backups/import-sql/validate', formData);

      if (res.data?.success) {
        setSqlPreviewData(res.data);
        setSqlPreviewOpen(true);
      } else {
        throw new Error(res.data?.message || 'Invalid SQL File');
      }
    } catch (err) {
      console.error('SQL validation error:', err);
      const resData = err.response?.data;
      const msg = resData?.message || err.message || 'Invalid SQL File';
      const errors = resData?.errors || [msg];
      setErrorMsg(msg);
      setFailureDetails({
        message: 'Invalid SQL File',
        errors
      });
    } finally {
      setSqlValidating(false);
    }
  };

  /**
   * Step 5, 6, 7, 8: Confirmed SQL Import Execution Handler
   */
  const handleExecuteSqlImport = async () => {
    if (!sqlPreviewData?.tempFileName) return;

    setSqlPreviewOpen(false);
    setSqlInProgress(true);
    setSqlCurrentStep(1);
    setErrorMsg(null);
    setFailureDetails(null);

    // Live progress transitions smoothly through the 6 steps
    const stepInterval = setInterval(() => {
      setSqlCurrentStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 600);

    try {
      const res = await api.post('/backups/import-sql/execute', {
        tempFileName: sqlPreviewData.tempFileName,
        originalFileName: sqlPreviewData.originalFileName
      });

      clearInterval(stepInterval);

      if (res.data?.success) {
        setSqlCurrentStep(6);
        setSqlSuccessData(res.data);
        setSuccessBanner(`SQL Backup Imported Successfully at ${res.data.importTime}.`);

        // Refresh history to display Pre-Import Backup (Saved) & SQL Import (Completed)
        fetchBackups();

        setTimeout(() => {
          setSqlInProgress(false);
        }, 1200);
      } else {
        throw new Error(res.data?.message || 'Import failed.');
      }
    } catch (err) {
      clearInterval(stepInterval);
      setSqlInProgress(false);

      const resData = err.response?.data;
      const msg = resData?.message || err.message || 'SQL Import Failed';
      const errors = resData?.verification?.errors || resData?.errors || [msg];

      setErrorMsg(msg);
      setFailureDetails({
        message: 'SQL Import Failed',
        errors: [
          msg,
          ...(resData?.safetyBackup ? [`Automatic safety backup [${resData.safetyBackup.fileName}] was preserved in history.`] : [])
        ],
        tableComparison: resData?.verification?.tableComparison || null
      });
    }
  };

  const handleDeleteBackup = async (fileName) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup "${fileName}"?`)) {
      return;
    }
    try {
      setDeletingId(fileName);
      const res = await api.delete(`/backups/${fileName}`);
      if (res.data?.success) {
        setBackups((prev) => prev.filter((b) => b.fileName !== fileName));
        setSuccessBanner(`Backup ${fileName} removed.`);
        setTimeout(() => setSuccessBanner(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete backup.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered tables for the Data Parity Audit view
  const filteredTables = useMemo(() => {
    if (!latestValidation?.tableComparison) return [];
    return latestValidation.tableComparison.filter((t) => {
      const matchSearch = t.table.toLowerCase().includes(searchTable.toLowerCase()) ||
        (t.category && t.category.toLowerCase().includes(searchTable.toLowerCase()));
      if (!matchSearch) return false;
      if (filterMode === 'critical') return t.isCritical;
      if (filterMode === 'mismatch') return !t.match;
      return true;
    });
  }, [latestValidation, searchTable, filterMode]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto text-left">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
              <HardDrive className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  Backup & Disaster Recovery Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                Full production database backups with automated disaster recovery integrity & parity validation
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchBackups}
          disabled={loading || inProgress || restoreInProgress || restoreValidating}
          className="p-2.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer self-start md:self-auto flex items-center gap-2 text-xs font-bold"
          title="Refresh History"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {successBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-semibold">{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation / Restore Failure Diagnostic Alert */}
      <AnimatePresence>
        {failureDetails && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-6 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 text-rose-900 dark:text-rose-100 shadow-xl space-y-4 text-left"
          >
            <div className="flex items-start justify-between gap-3 border-b border-rose-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-600 text-white shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-rose-700 dark:text-rose-300">
                    {failureDetails.message || 'Operation Validation Failed'}
                  </h3>
                  <p className="text-xs text-rose-800/80 dark:text-rose-200/80 mt-0.5">
                    Disaster recovery safety validation prevented this operation to protect database integrity.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFailureDetails(null)}
                className="p-1.5 rounded-xl hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 block">
                Validation Violations Detected:
              </span>
              <ul className="space-y-1.5 text-xs font-medium">
                {failureDetails.errors?.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-rose-900 dark:text-rose-200 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>

            {failureDetails.tableComparison && failureDetails.tableComparison.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-rose-500/20 bg-background/60">
                <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-xs font-bold text-rose-800 dark:text-rose-300">
                  Critical Tables Parity Audit
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <tr>
                      <th className="py-2 px-4">Table</th>
                      <th className="py-2 px-4 text-center">Expected</th>
                      <th className="py-2 px-4 text-center">Actual</th>
                      <th className="py-2 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {failureDetails.tableComparison.map((row) => (
                      <tr key={row.table} className="hover:bg-muted/10">
                        <td className="py-2 px-4 font-mono font-bold text-foreground">{row.table}</td>
                        <td className="py-2 px-4 text-center font-mono">{row.expected?.toLocaleString()}</td>
                        <td className="py-2 px-4 text-center font-mono">{row.actual?.toLocaleString()}</td>
                        <td className="py-2 px-4 text-right font-bold">
                          {row.match ? (
                            <span className="text-emerald-600 dark:text-emerald-400">✅ {row.status}</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">❌ {row.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 1 & 2: Primary Action Card with Take Live Backup & Restore Backup */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card to-emerald-500/[0.04] border border-border/80 p-8 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Database className="w-3.5 h-3.5" /> Live MySQL Engine Protected
            </div>
            <h2 className="text-xl font-black text-foreground">
              Production Disaster Recovery Center
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Creates a complete transaction-consistent export of all 80 tables in <strong className="text-foreground">innoveity_crm</strong> via MySQL single-transaction mode, or restores previously verified production snapshots with automated safety backup protection.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                <span className="block text-[10px] font-bold uppercase text-muted-foreground">Database</span>
                <span className="text-xs font-black text-foreground">innoveity_crm</span>
              </div>
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                <span className="block text-[10px] font-bold uppercase text-muted-foreground">Mode</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">Zero-Downtime</span>
              </div>
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                <span className="block text-[10px] font-bold uppercase text-muted-foreground">Scope</span>
                <span className="text-xs font-black text-foreground">100% Full DB</span>
              </div>
              <div className="p-2.5 rounded-xl bg-background/80 border border-border/60">
                <span className="block text-[10px] font-bold uppercase text-muted-foreground">Validation Gate</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">Automated Audit</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end justify-center shrink-0 gap-3">
            <button
              onClick={() => setConfirmModalOpen(true)}
              disabled={inProgress || restoreInProgress || restoreValidating}
              className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center gap-3 cursor-pointer disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              <span>Take Live Backup</span>
            </button>
            <span className="text-[11px] text-muted-foreground font-medium">
              Read-only dump • Will not interrupt running users
            </span>
          </div>
        </div>

        {/* Phase 1: Restore Backup Section (Below Take Live Backup) */}
        <div className="pt-6 border-t border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 -mx-8 p-6 px-8">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Restore Backup
            </h4>
            <p className="text-xs text-muted-foreground">
              Restore a previously created Innoveity CRM backup safely. Upload an Innoveity CRM backup ZIP to restore the system.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <input
              ref={restoreInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              onClick={() => restoreInputRef.current?.click()}
              disabled={inProgress || restoreInProgress || restoreValidating || sqlValidating || sqlInProgress}
              className="px-5 py-3 rounded-2xl bg-card hover:bg-muted border-2 border-border/80 text-foreground font-black text-xs shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {restoreValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Validating Archive...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Restore Backup (Upload ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Utility Feature: Import SQL (Placed below the two main buttons) */}
        <div className="pt-3.5 pb-3.5 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 -mx-8 -mb-8 p-4 px-8 rounded-b-3xl">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                Import SQL
              </h4>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                Small Utility
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Upload a <code className="font-mono text-sky-600 dark:text-sky-400 font-bold">.sql</code> backup file
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={sqlInputRef}
              type="file"
              accept=".sql"
              className="hidden"
              onChange={handleSqlFileSelected}
            />
            <button
              onClick={() => sqlInputRef.current?.click()}
              disabled={inProgress || restoreInProgress || restoreValidating || sqlValidating || sqlInProgress}
              className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-bold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sqlValidating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>Inspecting SQL...</span>
                </>
              ) : (
                <>
                  <FileCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Import SQL</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Step 9: SQL Import Success Card Display */}
      <AnimatePresence>
        {sqlSuccessData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-foreground">SQL Backup Restored Successfully</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                      Verification Passed
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Database <strong className="text-foreground">{sqlSuccessData.database || 'innoveity_crm'}</strong> restored and verified against SQL dump row counts. Automatic safety backup preserved in history.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh System
                </button>
                <button
                  onClick={() => setSqlSuccessData(null)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Display: Database, Tables Restored, Records Imported, Safety Backup */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Database</span>
                <span className="text-xs font-mono font-bold text-foreground truncate block">
                  {sqlSuccessData.database || 'innoveity_crm'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Tables Restored</span>
                <span className="text-xs font-black text-foreground">
                  {sqlSuccessData.tablesRestored || sqlSuccessData.tablesImported} Tables
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Records Imported</span>
                <span className="text-xs font-black text-foreground">
                  {sqlSuccessData.recordsImported?.toLocaleString()} Rows
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Safety Backup</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate block" title={sqlSuccessData.safetyBackup?.fileName}>
                  Preserved ({sqlSuccessData.safetyBackup?.fileName || 'Snapshot'})
                </span>
              </div>
            </div>

            {/* Step 5: Verification Table */}
            {sqlSuccessData.verification?.tableComparison && (
              <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-background/60">
                <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Critical Tables Parity Verification
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Verification Passed ✅
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-4">Table</th>
                      <th className="py-2.5 px-4 text-center">Expected</th>
                      <th className="py-2.5 px-4 text-center">Actual</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sqlSuccessData.verification.tableComparison.map((row) => (
                      <tr key={row.table} className="hover:bg-muted/10">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">{row.table}</td>
                        <td className="py-2.5 px-4 text-center font-mono">{row.expected?.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-center font-mono">{row.actual?.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {row.icon || '✅'} {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 9: Restore Success Card Display */}
      <AnimatePresence>
        {restoredSuccessData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-6 rounded-3xl bg-teal-500/10 border-2 border-teal-500/30 shadow-lg shadow-teal-500/5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-600 text-white shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-foreground">Backup Restored Successfully</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-600 text-white uppercase tracking-wider">
                      Verified & Complete
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    The entire CRM database has been restored from snapshot. A pre-restore safety backup is saved in history for rollback.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-teal-600/20"
                >
                  <RefreshCw className="w-4 h-4" /> Refresh System
                </button>
                <button
                  onClick={() => setRestoredSuccessData(null)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Display: Backup Name, Restore Time, Tables Restored, Records Restored */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-background/80 border border-teal-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Backup Name</span>
                <span className="text-xs font-bold text-foreground truncate block" title={restoredSuccessData.backupName}>
                  {restoredSuccessData.backupName}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-teal-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Restore Time</span>
                <span className="text-xs font-black text-teal-600 dark:text-teal-400">
                  {restoredSuccessData.restoreTime}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-teal-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Tables Restored</span>
                <span className="text-xs font-black text-foreground">
                  {restoredSuccessData.tablesRestored} Tables
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-teal-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Records Restored</span>
                <span className="text-xs font-black text-foreground">
                  {restoredSuccessData.recordsRestored?.toLocaleString()} Rows
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validated Live Backup Created Card Display */}
      <AnimatePresence>
        {createdBackup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-foreground">Live Backup Created Successfully</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white uppercase tracking-wider">
                      100% Parity Verified
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Download started automatically. All 80 tables and records matched the live production database.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {latestValidation && (
                  <button
                    onClick={() => setValidationModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>View Parity Audit</span>
                  </button>
                )}
                <button
                  onClick={() => triggerFileDownload(createdBackup.fileName)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <ArrowDownToLine className="w-4 h-4" /> Download Again
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Backup Name</span>
                <span className="text-xs font-bold text-foreground truncate block" title={createdBackup.fileName}>
                  {createdBackup.fileName}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Backup Size</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {createdBackup.size}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Total Tables</span>
                <span className="text-xs font-black text-foreground">{createdBackup.totalTables} (100% Dumped)</span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Total Records</span>
                <span className="text-xs font-black text-foreground">{createdBackup.totalRecords?.toLocaleString()} rows</span>
              </div>
              <div className="p-3 rounded-2xl bg-background/80 border border-emerald-500/20">
                <span className="block text-[10px] font-bold text-muted-foreground uppercase">Created Time</span>
                <span className="text-xs font-bold text-foreground">
                  {new Date(createdBackup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 10: Backup History Section (Latest 20) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" /> Backup History (Latest 20)
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Verified production snapshots, pre-restore safety backups, and restoration logs
            </p>
          </div>
          <span className="text-xs font-bold text-muted-foreground px-3 py-1 rounded-xl bg-card border border-border">
            Total: {backups.length}
          </span>
        </div>

        <div className="overflow-hidden rounded-3xl bg-card border border-border/80 shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-xs font-bold">Loading backup history...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <HardDrive className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm font-bold text-foreground">No Backups Generated Yet</p>
              <p className="text-xs max-w-sm mx-auto">
                Click "Take Live Backup" above to create your first zero-downtime MySQL snapshot.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3.5 px-5">Date & Time</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Size</th>
                    <th className="py-3.5 px-4">Records / Tables</th>
                    <th className="py-3.5 px-4">Created By</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {backups.map((bkp) => (
                    <tr key={bkp.id || bkp.fileName} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-foreground">
                        <div>
                          {new Date(bkp.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {new Date(bkp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {bkp.type === 'Pre-Restore Backup' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3 h-3 text-amber-600" /> Pre-Restore Backup
                          </span>
                        ) : bkp.type === 'Pre-Import Backup' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3 h-3 text-amber-600" /> Pre-Import Backup
                          </span>
                        ) : bkp.type === 'Restored Backup' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                            <RotateCcw className="w-3 h-3 text-indigo-600" /> Restored Backup
                          </span>
                        ) : bkp.type === 'SQL Import' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                            <FileCode className="w-3 h-3 text-sky-600" /> SQL Import
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                            <Check className="w-3 h-3 text-teal-600" /> {bkp.type || 'Full Live'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-black text-foreground">
                        {bkp.size}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <span className="font-bold text-foreground">{bkp.totalRecords?.toLocaleString() || '-'}</span> rows
                        <span className="text-[10px] block text-muted-foreground">{bkp.totalTables || 80} tables</span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground truncate max-w-[160px]" title={bkp.createdBy}>
                        {bkp.createdBy || 'Super Admin'}
                      </td>
                      <td className="py-3.5 px-4">
                        {bkp.validationStatus === 'Saved' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <ShieldCheck className="w-3.5 h-3.5" /> Saved
                          </span>
                        ) : bkp.validationStatus === 'Completed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="w-3.5 h-3.5" /> Passed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => triggerFileDownload(bkp.fileName)}
                            disabled={downloadingId === bkp.fileName}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title={bkp.fileName?.toLowerCase().endsWith('.sql') ? 'Download SQL' : 'Download ZIP'}
                          >
                            <Download className={`w-3.5 h-3.5 ${downloadingId === bkp.fileName ? 'animate-bounce' : ''}`} />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(bkp.fileName)}
                            disabled={deletingId === bkp.fileName}
                            className="p-1.5 rounded-xl hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Backup"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog Modal for Live Backup */}
      <AnimatePresence>
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-5 text-left"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-foreground">Create Live Backup?</h3>
                </div>
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">
                  This will create a complete snapshot of all production CRM data from the live MySQL database.
                </p>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                  <span className="block text-[11px] font-black uppercase text-foreground">Included In Backup:</span>
                  <ul className="grid grid-cols-2 gap-1.5 text-xs font-medium">
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Users & Profiles
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Attendance (Punches & Shifts)
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Leave Policies & Balances
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Payroll & Payslips
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Projects & Tasks
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Organizations & Branding
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Notifications & Chats
                    </li>
                    <li className="flex items-center gap-1.5 text-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Audit Logs & Settings
                    </li>
                  </ul>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Automated Validation Pipeline Active
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    The generated backup is automatically inspected, SQL syntax is validated, and all table counts are matched with live MySQL data before download is permitted.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateLiveBackup}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Database className="w-4 h-4" /> Create & Validate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Phase 4 & Phase 6: Restore Preview & Final Confirmation Modal */}
      <AnimatePresence>
        {restorePreviewOpen && restorePreviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-3xl bg-card border border-border shadow-2xl p-6 text-left space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      Restore Complete CRM Backup?
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Inspect backup specifications before confirming full database replacement.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setRestorePreviewOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Warning Notice */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <div className="font-black flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" /> High-Risk Production Operation
                </div>
                <p className="leading-relaxed">
                  This will replace the current CRM data with the selected backup. A safety backup of the current database will be automatically created before restoration.
                </p>
              </div>

              {/* Phase 4 Preview Table */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider block">
                  Backup Information Preview:
                </span>
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-muted/20">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-border/60 font-medium">
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30 w-1/3">Backup Name</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground truncate max-w-[280px]" title={restorePreviewData.backupInfo?.fileName}>
                          {restorePreviewData.backupInfo?.fileName}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">Created</td>
                        <td className="py-2.5 px-4 text-foreground">{restorePreviewData.backupInfo?.created}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">CRM Version</td>
                        <td className="py-2.5 px-4 text-foreground">{restorePreviewData.backupInfo?.crmVersion}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">MySQL Version</td>
                        <td className="py-2.5 px-4 text-foreground">{restorePreviewData.backupInfo?.mysqlVersion}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">Total Tables</td>
                        <td className="py-2.5 px-4 font-black text-foreground">{restorePreviewData.backupInfo?.totalTables} Tables</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">Total Records</td>
                        <td className="py-2.5 px-4 font-black text-foreground">{restorePreviewData.backupInfo?.totalRecords?.toLocaleString()} Rows</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">Backup Size</td>
                        <td className="py-2.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">{restorePreviewData.backupInfo?.backupSize}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Phase 5 Notice */}
              <div className="p-3 rounded-2xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Mandatory Safety Guarantee:</strong> A pre-restore safety backup (<code>pre_restore_backup_*.zip</code>) will be created and verified before importing.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setRestorePreviewOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-black text-xs shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> Restore Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Phase 7: Restore Live Progress Modal */}
      <AnimatePresence>
        {restoreInProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Restoring CRM Database...</h3>
                  <p className="text-xs text-muted-foreground">Replacing tables and verifying data integrity. Do not close this window.</p>
                </div>
              </div>

              {/* Step progression:
                  * Validating backup...
                  * Creating safety backup...
                  * Preparing database...
                  * Restoring tables...
                  * Importing data...
                  * Verifying restored data...
                  * Finalizing...
              */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-muted/40 border border-border/60">
                {RESTORE_STEPS.map((step) => {
                  const isDone = restoreCurrentStep > step.id;
                  const isCurrent = restoreCurrentStep === step.id;
                  return (
                    <div key={step.id} className="flex items-center gap-3 text-xs">
                      {isDone ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground text-[10px]">
                          {step.id}
                        </div>
                      )}
                      <span className={`font-semibold ${isDone ? 'text-foreground' : isCurrent ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full"
                  initial={{ width: '10%' }}
                  animate={{ width: `${Math.min(100, (restoreCurrentStep / 7) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Steps 4, 5, 6: SQL Preview & Confirmation Dialog Modal */}
      <AnimatePresence>
        {sqlPreviewOpen && sqlPreviewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl p-6 text-left space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      Import SQL Backup?
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Inspect SQL specifications before confirming full database replacement.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSqlPreviewOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Warning Notice */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                <div className="font-black flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" /> Warning
                </div>
                <p className="leading-relaxed">
                  This will replace the current CRM database with the uploaded SQL file.
                </p>
              </div>

              {/* Step 4: Show SQL Preview Table */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider block">
                  SQL Preview Information:
                </span>
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-muted/20">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-border/60 font-medium">
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30 w-1/3">File Name</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground truncate max-w-[280px]" title={sqlPreviewData.sqlInfo?.fileName}>
                          {sqlPreviewData.sqlInfo?.fileName}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">File Size</td>
                        <td className="py-2.5 px-4 font-bold text-sky-600 dark:text-sky-400">
                          {sqlPreviewData.sqlInfo?.fileSize}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">Tables Detected</td>
                        <td className="py-2.5 px-4 font-black text-foreground">
                          {sqlPreviewData.sqlInfo?.tablesDetected}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-bold text-muted-foreground bg-muted/30">SQL Type</td>
                        <td className="py-2.5 px-4 font-bold text-foreground">
                          {sqlPreviewData.sqlInfo?.sqlType || 'MySQL Dump'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 5: Automatic Safety Backup Notice */}
              <div className="p-3 rounded-2xl bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Automatic Safety Backup:</strong> A pre-import backup (<code>pre_import_backup_YYYY-MM-DD_HH-mm.zip</code>) of the live database will be created first. If the safety backup fails, the import will be cancelled.
                </span>
              </div>

              {/* Action Buttons: Cancel and Import Now */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setSqlPreviewOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSqlImport}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-black text-xs shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <FileCode className="w-4 h-4" /> Import Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Step 7: SQL Import Live Progress Modal */}
      <AnimatePresence>
        {sqlInProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Importing SQL Backup...</h3>
                  <p className="text-xs text-muted-foreground">Replacing tables and verifying data records. Do not close this window.</p>
                </div>
              </div>

              {/* Step progression:
                  * Validating SQL...
                  * Creating safety backup...
                  * Importing tables...
                  * Importing data...
                  * Verifying records...
                  * Finalizing...
              */}
              <div className="space-y-2.5 p-4 rounded-2xl bg-muted/40 border border-border/60">
                {IMPORT_SQL_STEPS.map((step) => {
                  const isDone = sqlCurrentStep > step.id;
                  const isCurrent = sqlCurrentStep === step.id;
                  return (
                    <div key={step.id} className="flex items-center gap-3 text-xs">
                      {isDone ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground text-[10px]">
                          {step.id}
                        </div>
                      )}
                      <span className={`font-semibold ${isDone ? 'text-foreground' : isCurrent ? 'text-sky-600 dark:text-sky-400 font-bold' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 h-full rounded-full"
                  initial={{ width: '10%' }}
                  animate={{ width: `${Math.min(100, (sqlCurrentStep / 6) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Backup Real-Time Progress Modal */}
      <AnimatePresence>
        {inProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-6 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Generating & Validating Live Backup...</h3>
                  <p className="text-xs text-muted-foreground">Inspecting archive structure and verifying MySQL production parity.</p>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-muted/40 border border-border/60">
                {PROGRESS_STEPS.map((step) => {
                  const isDone = currentStep > step.id;
                  const isCurrent = currentStep === step.id;
                  return (
                    <div key={step.id} className="flex items-center gap-3 text-xs">
                      {isDone ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center shrink-0 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 text-muted-foreground text-[10px]">
                          {step.id}
                        </div>
                      )}
                      <span className={`font-semibold ${isDone ? 'text-foreground' : isCurrent ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                  initial={{ width: '10%' }}
                  animate={{ width: `${Math.min(100, (currentStep / 5) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Phase 3 & 7: Table Comparison & Parity Audit Modal */}
      <AnimatePresence>
        {validationModalOpen && latestValidation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-card border border-border shadow-2xl text-left overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      Live MySQL vs Backup Data Parity Audit
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Verified {latestValidation.totalDumpTables} tables and {latestValidation.totalDumpRecords?.toLocaleString()} records for disaster recovery readiness
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setValidationModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-header Summary Cards */}
              <div className="p-6 border-b border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card shrink-0">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Table Parity</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {latestValidation.totalDumpTables} / {latestValidation.totalLiveTables} Matched
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Record Parity</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {latestValidation.totalDumpRecords?.toLocaleString()} / {latestValidation.totalLiveRecords?.toLocaleString()} (100%)
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Critical Modules</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {latestValidation.criticalTablesVerified ? 'All Passed ✅' : 'Failed ❌'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">ZIP Integrity</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {latestValidation.zipIntegrity} (Validated)
                  </span>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-muted/10">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search table or module..."
                    value={searchTable}
                    onChange={(e) => setSearchTable(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterMode === 'all' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    All ({latestValidation.tableComparison?.length || 0})
                  </button>
                  <button
                    onClick={() => setFilterMode('critical')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterMode === 'critical' ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    Critical ({latestValidation.tableComparison?.filter(t => t.isCritical).length || 0})
                  </button>
                  <button
                    onClick={() => setFilterMode('mismatch')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filterMode === 'mismatch' ? 'bg-rose-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    Mismatches ({latestValidation.tableComparison?.filter(t => !t.match).length || 0})
                  </button>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="overflow-y-auto flex-1 p-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Table Name</th>
                      <th className="py-2.5 px-4">Module Group</th>
                      <th className="py-2.5 px-4 text-center">Live Database</th>
                      <th className="py-2.5 px-4 text-center">Backup Dump</th>
                      <th className="py-2.5 px-4 text-right">Parity Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTables.map((t) => (
                      <tr key={t.table} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                          {t.table}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${t.isCritical ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                            {t.category || 'Database Module'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-foreground">
                          {t.live?.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-foreground">
                          {t.backup?.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {t.match ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <Check className="w-3.5 h-3.5" /> Match
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              <X className="w-3.5 h-3.5" /> Mismatch
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border/60 flex items-center justify-between shrink-0 bg-muted/20 text-xs">
                <span className="text-muted-foreground">
                  Showing {filteredTables.length} of {latestValidation.tableComparison?.length || 0} tables
                </span>
                <button
                  onClick={() => setValidationModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-card hover:bg-muted border border-border text-foreground font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BackupRestore;
