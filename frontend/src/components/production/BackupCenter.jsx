import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HardDrive, Download, CheckCircle2, AlertCircle, RefreshCw,
  ShieldCheck, FileCode, Play, AlertTriangle, Database, Check
} from 'lucide-react';
import api from '../../services/api';

const BackupCenter = () => {
  const [backups, setBackups] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [verificationModalData, setVerificationModalData] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/backups');
      if (res.data?.success) {
        setBackups(res.data.backups || []);
        setChecklist(res.data.checklist || []);
      }
    } catch (err) {
      console.error('Failed to load backups:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to retrieve backups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/system/backups/create');
      if (res.data?.success) {
        setSuccessMsg(`Backup snapshot created: ${res.data.backup.totalRecords} records secured.`);
        fetchBackups();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create backup.');
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyIntegrity = async (backupId) => {
    setVerifyingId(backupId);
    try {
      const res = await api.post(`/system/backups/${backupId}/verify`);
      if (res.data?.success) {
        setVerificationModalData(res.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Integrity check failed.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDryRunRestore = async (backupId) => {
    setRestoringId(backupId);
    try {
      const res = await api.post(`/system/backups/${backupId}/restore-dry-run`);
      if (res.data?.success) {
        setSuccessMsg(`Dry-run restore simulation passed: ${res.data.verifiedRecords} records validated without live DB disruption.`);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Dry-run restore failed.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Backup & Disaster Recovery Center</h1>
              <p className="text-sm text-slate-400">Automated database snapshots, SHA-256 integrity auditing, and zero-downtime recovery</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBackups}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Backups"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Take Instant Backup
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Disaster Recovery Checklist Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Disaster Recovery Operational Checklist
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {checklist.map((item) => (
            <div key={item.step} className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400">Step {item.step}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                  {item.status}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-slate-200">{item.name}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Available Database Snapshots Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Database Snapshot Archives ({backups.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Snapshot Archive</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Records</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4">Checksum (SHA-256)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 font-sans">
                    No database snapshots found. Click "Take Instant Backup" above to generate your first archive.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.fileName} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-slate-200">{b.fileName}</td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {b.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{b.totalRecords?.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-300">{b.sizeFormatted}</td>
                    <td className="py-3 px-4 text-slate-400">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4 text-[10px] text-slate-500 truncate max-w-[140px]" title={b.checksum}>
                      {b.checksum ? `${b.checksum.substring(0, 12)}...` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 font-sans">
                        <button
                          onClick={() => handleVerifyIntegrity(b.fileName)}
                          disabled={verifyingId === b.fileName}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                        >
                          {verifyingId === b.fileName ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Verify'}
                        </button>
                        <button
                          onClick={() => handleDryRunRestore(b.fileName)}
                          disabled={restoringId === b.fileName}
                          className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 text-xs font-semibold rounded-lg transition"
                        >
                          {restoringId === b.fileName ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Dry-Run'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrity Modal */}
      <AnimatePresence>
        {verificationModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-base">Checksum Integrity Verified</h3>
                </div>
                <button
                  onClick={() => setVerificationModalData(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300">
                  SHA-256 cryptographic hash matches the original payload byte-for-byte.
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Snapshot ID:</span>
                    <span className="font-mono text-white">{verificationModalData.backupId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Total Entities:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {verificationModalData.recordCounts?.totalRecords}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">SHA-256 Hash:</span>
                    <span className="font-mono text-[10px] text-slate-300 bg-slate-950 p-2 rounded block break-all">
                      {verificationModalData.computedChecksum}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setVerificationModalData(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
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

export default BackupCenter;
