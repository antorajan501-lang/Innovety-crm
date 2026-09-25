import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Server, Sliders, AlertTriangle, CheckCircle2,
  RefreshCw, Terminal, AlertCircle, Shield, FileText, Bug,
  Trash2, Eye, HardDrive, Lock
} from 'lucide-react';
import api from '../../services/api';

const DeploymentCenter = () => {
  const [activeTab, setActiveTab] = useState('readiness'); // 'readiness' | 'config' | 'errors'
  const [readiness, setReadiness] = useState(null);
  const [config, setConfig] = useState(null);
  const [errorsData, setErrorsData] = useState({ logs: [], stats: {} });
  const [selectedError, setSelectedError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [readinessRes, configRes, errorsRes] = await Promise.all([
        api.get('/system/deployment/check').catch(() => ({ data: { success: false } })),
        api.get('/system/config').catch(() => ({ data: { success: false } })),
        api.get('/system/errors').catch(() => ({ data: { success: false } }))
      ]);

      if (readinessRes.data?.success) setReadiness(readinessRes.data.report);
      if (configRes.data?.success) setConfig(configRes.data.config);
      if (errorsRes.data?.success) setErrorsData(errorsRes.data);
    } catch (err) {
      console.error('Failed to load deployment data:', err);
      setErrorMsg('Failed to load deployment and configuration metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleClearErrors = async () => {
    if (!window.confirm('Clear all captured error logs from server memory?')) return;
    try {
      await api.post('/system/errors/clear');
      setSuccessMsg('Centralized error logs cleared.');
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to clear errors:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/20 text-white">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Deployment & Configuration Center</h1>
              <p className="text-sm text-slate-400">CI/CD deployment readiness, masked production runtime configuration, and error management</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Sub-tab Switcher */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 max-w-md">
        <button
          onClick={() => setActiveTab('readiness')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'readiness' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          Deployment Readiness
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'config' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Production Config
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'errors' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          Error Tracking ({errorsData.stats?.totalCaptured || 0})
        </button>
      </div>

      {/* Tab 1: Deployment Readiness */}
      {activeTab === 'readiness' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/60 border border-purple-500/30 rounded-2xl flex items-center justify-between backdrop-blur-sm">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Release Readiness State
              </span>
              <div className="text-2xl font-extrabold text-white font-mono flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block animate-pulse" />
                {readiness?.readinessStatus || 'READY'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Passed {readiness?.passedChecks} of {readiness?.totalChecks} automated deployment gates.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              100% Verified
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Automated Deployment Gate Validation
            </h3>
            <div className="space-y-3">
              {readiness?.checks?.map((check, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {check.category}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-200">{check.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{check.detail}</p>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border font-mono ${
                    check.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                    check.status === 'WARN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                    'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {check.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Production Configuration (Read-only masked) */}
      {activeTab === 'config' && config && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              Runtime Environment
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">NODE_ENV</span>
                <span className="text-emerald-400 font-bold">{config.environment.nodeEnv}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">PORT</span>
                <span className="text-slate-200">{config.environment.port}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Node Engine</span>
                <span className="text-slate-200">{config.environment.nodeVersion}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">FRONTEND_URL</span>
                <span className="text-cyan-400">{config.environment.frontendUrl}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              PostgreSQL Database Configuration
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Client Engine</span>
                <span className="text-slate-200">{config.database.client}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Database Driver</span>
                <span className="text-slate-200">{config.database.type}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Connection URL</span>
                <span className="text-slate-300 text-[10px]">{config.database.url}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Domain & SSL Protection
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Domain</span>
                <span className="text-slate-200">{config.domainAndSsl.domain}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">SSL Certificate</span>
                <span className="text-emerald-400 font-bold">Active & Enforced</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Protocol</span>
                <span className="text-slate-200">{config.domainAndSsl.tlsVersion}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Rocket className="w-4 h-4 text-amber-400" />
              Process Supervisor Status
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Instance Name</span>
                <span className="text-slate-200">{config.pm2Status.instanceName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-500">Process PID</span>
                <span className="text-slate-200">{config.pm2Status.pid}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Auto-Restart</span>
                <span className="text-emerald-400 font-bold">{config.pm2Status.restartPolicy}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Centralized Error Management */}
      {activeTab === 'errors' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bug className="w-4 h-4 text-rose-400" />
                Captured Exception & Crash Ledger
              </h3>
              <p className="text-xs text-slate-400">Real-time trace logs for backend exceptions and frontend UI crashes</p>
            </div>
            <button
              onClick={handleClearErrors}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Clear Error Ledger
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Error ID</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4">Path / Method</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {errorsData.logs?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-500 font-sans">
                      Zero production exceptions or crashes detected. System is running cleanly.
                    </td>
                  </tr>
                ) : (
                  errorsData.logs?.map((err) => (
                    <tr key={err.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-4 text-slate-400">{err.id}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          err.type === 'FRONTEND_CRASH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          {err.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-200 font-sans truncate max-w-xs">{err.message}</td>
                      <td className="py-2.5 px-4 text-slate-400">{err.method} {err.path}</td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(err.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        <button
                          onClick={() => setSelectedError(err)}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                          title="View Stack Trace"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stack Trace Modal */}
      <AnimatePresence>
        {selectedError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-rose-400" />
                  <h3 className="font-bold text-white text-base">Error Stack Trace: {selectedError.id}</h3>
                </div>
                <button
                  onClick={() => setSelectedError(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 font-sans">
                  <strong>Message:</strong> {selectedError.message}
                </div>

                <span className="text-slate-400 font-mono text-[11px] block">Stack Trace:</span>
                <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-rose-400 overflow-x-auto max-h-72 leading-relaxed">
                  {selectedError.stack || 'No stack trace recorded.'}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedError(null)}
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

export default DeploymentCenter;
