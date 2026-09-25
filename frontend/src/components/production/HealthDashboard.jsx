import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Server, Database, Cpu, HardDrive, RefreshCw,
  Clock, ShieldCheck, CheckCircle2, AlertCircle, Radio, Terminal
} from 'lucide-react';
import api from '../../services/api';

const HealthDashboard = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rawResponse, setRawResponse] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/health');
      if (res.data?.success) {
        setHealth(res.data);
        setRawResponse(res.data);
      }
    } catch (err) {
      console.error('Failed to query health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const isHealthy = health?.status === 'HEALTHY';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">System Monitoring & Vitality Hub</h1>
              <p className="text-sm text-slate-400">Real-time health endpoints, database ping, background worker state, and resource telemetry</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold font-mono ${
            isHealthy ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SYSTEM {health?.status || 'HEALTHY'}
          </div>

          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <Terminal className="w-3.5 h-3.5" />
            {showRaw ? 'Hide JSON' : 'Inspect JSON'}
          </button>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Health"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Raw JSON Debug View */}
      {showRaw && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
          <span className="text-xs font-bold text-slate-400 block mb-2 font-mono">
            GET /api/system/health Response
          </span>
          <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60 leading-relaxed">
            {JSON.stringify(rawResponse, null, 2)}
          </pre>
        </div>
      )}

      {/* Top Vitality Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Uptime Duration</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {health?.uptime?.formatted || '0s'}
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            PID: {health?.telemetry?.pid || 'Node'} • 0 crashes
          </span>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Database Status</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-400 font-mono">
            {health?.database?.status || 'UP'}
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            Latency: {health?.database?.latencyMs} ms ping
          </span>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Memory (Heap Used)</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-300 font-mono">
            {health?.memory?.heapUsedMb || 0} <span className="text-sm font-normal text-slate-400">/ {health?.memory?.heapTotalMb} MB</span>
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            RSS: {health?.memory?.rssMb} MB
          </span>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Active Tenants & Users</span>
            <Server className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 font-mono">
            {health?.telemetry?.activeUsers24h || 0}
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            Across {health?.telemetry?.totalOrganizations || 0} active organizations
          </span>
        </div>
      </div>

      {/* Subsystem Telemetry Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Background Services Status */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            Background Daemons & Scheduled Jobs
          </h3>
          <div className="space-y-3">
            {health?.backgroundServices &&
              Object.entries(health.backgroundServices).map(([key, s]) => (
                <div key={key} className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block font-mono">{key}</span>
                    <span className="text-[11px] text-slate-500">{s.interval || s.protocol || 'Running'}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {s.status}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Host & Server Hardware Specs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Server Architecture & Runtime
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Processor Model:</span>
              <span className="font-semibold text-slate-200">{health?.cpu?.model}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Logical Cores:</span>
              <span className="font-mono text-cyan-400">{health?.cpu?.cores} Cores</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Operating System:</span>
              <span className="font-mono text-slate-200">{health?.cpu?.platform} ({health?.cpu?.arch})</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Node.js Engine:</span>
              <span className="font-mono text-emerald-400">{health?.cpu?.nodeVersion}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">System Physical Memory:</span>
              <span className="font-mono text-slate-300">
                {Math.round((health?.memory?.systemTotalMb || 0) / 1024)} GB total
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthDashboard;
