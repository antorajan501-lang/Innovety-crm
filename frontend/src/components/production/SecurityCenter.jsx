import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, Key, Lock, Terminal, RefreshCw,
  AlertTriangle, CheckCircle2, UserX, AlertCircle, Eye, EyeOff,
  Zap, Sliders, Server, Cpu
} from 'lucide-react';
import api from '../../services/api';

const SecurityCenter = () => {
  const [posture, setPosture] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Manual token revocation state
  const [tokenToRevoke, setTokenToRevoke] = useState('');
  const [revokeReason, setRevokeReason] = useState('Manual Administrative Revocation');
  const [revoking, setRevoking] = useState(false);

  // Password test widget state
  const [testPassword, setTestPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchSecurityData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/system/security/audit');
      if (res.data?.success) {
        setPosture(res.data.posture);
        setEvents(res.data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching security audit:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load security audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleRevokeToken = async (e) => {
    e.preventDefault();
    if (!tokenToRevoke.trim()) return;
    setRevoking(true);
    try {
      const res = await api.post('/system/security/revoke-token', {
        token: tokenToRevoke.trim(),
        reason: revokeReason
      });
      if (res.data?.success) {
        setSuccessMsg('Session token successfully blacklisted and invalidated.');
        setTokenToRevoke('');
        fetchSecurityData();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to revoke token');
    } finally {
      setRevoking(false);
    }
  };

  // Live password score calculation
  const getPasswordScore = (pass) => {
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (/[A-Z]/.test(pass)) score += 25;
    if (/[a-z]/.test(pass)) score += 20;
    if (/\d/.test(pass)) score += 15;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pass)) score += 15;
    return score;
  };

  const passScore = getPasswordScore(testPassword);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Security & Launch Hardening Center</h1>
              <p className="text-sm text-slate-400">Military-grade protection, token blacklist, rate limiting, and vulnerability auditing</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSecurityData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Security Status"
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

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="p-5 bg-slate-900/60 border border-emerald-500/30 rounded-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security Score</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Grade {posture?.grade || 'A+'}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {posture?.score ?? 100} / 100
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${posture?.score ?? 100}%` }}
            />
          </div>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Rate Limiter State
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            ACTIVE
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            Auth: 25 req/15m • Global: 300 req/m
          </span>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Revoked Tokens (Blacklist)
          </div>
          <div className="text-3xl font-extrabold text-cyan-400 font-mono">
            {posture?.activeRevokedTokensCount || 0}
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            Expired sessions invalidated immediately
          </span>
        </div>

        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Security Events Tracked
          </div>
          <div className="text-3xl font-extrabold text-purple-400 font-mono">
            {posture?.totalSecurityEventsRecorded || 0}
          </div>
          <span className="text-xs text-slate-400 mt-2 block">
            Forensic audit trail operational
          </span>
        </div>
      </div>

      {/* Security Posture Checkpoints Grid */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Active Defense & Hardening Controls
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posture?.checks?.map((check, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-200">{check.name}</span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {check.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Section: Session Token Revocation & Password Policy Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Token Revocation Tool */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-cyan-400" />
            Session Invalidation & Token Revocation
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Immediately invalidate compromised or terminated user JWT tokens across all clusters.
          </p>

          <form onSubmit={handleRevokeToken} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">JWT Bearer Token *</label>
              <textarea
                rows="2"
                required
                value={tokenToRevoke}
                onChange={(e) => setTokenToRevoke(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Revocation Reason</label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={revoking || !tokenToRevoke.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition"
            >
              {revoking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
              Revoke Session Token
            </button>
          </form>
        </div>

        {/* Password Strength Tester */}
        <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            Password Entropy & Policy Validator
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Test passwords against production enterprise complexity rules (Min 8 chars, A-Z, a-z, 0-9, special char).
          </p>

          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                placeholder="Enter sample password to test..."
                className="w-full pl-3 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Score Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Entropy Score:</span>
                <span className={`font-mono font-bold ${passScore === 100 ? 'text-emerald-400' : passScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {passScore} / 100
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${passScore === 100 ? 'bg-emerald-400' : passScore >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${passScore}%` }}
                />
              </div>
            </div>

            {/* Rule Checklist */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <span className={`flex items-center gap-1.5 ${testPassword.length >= 8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {testPassword.length >= 8 ? '✓' : '○'} ≥ 8 Characters
              </span>
              <span className={`flex items-center gap-1.5 ${/[A-Z]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                {/[A-Z]/.test(testPassword) ? '✓' : '○'} Uppercase (A-Z)
              </span>
              <span className={`flex items-center gap-1.5 ${/[a-z]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                {/[a-z]/.test(testPassword) ? '✓' : '○'} Lowercase (a-z)
              </span>
              <span className={`flex items-center gap-1.5 ${/\d/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                {/\d/.test(testPassword) ? '✓' : '○'} Numeric Digit (0-9)
              </span>
              <span className={`flex items-center gap-1.5 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(testPassword) ? 'text-emerald-400' : 'text-slate-500'}`}>
                {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(testPassword) ? '✓' : '○'} Special Symbol
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Event Log */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          Recent Security Event Log
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Event ID</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4">Details</th>
                <th className="py-2.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {events.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 font-sans">
                    No security violations or revocation events recorded.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 text-slate-400">{evt.id}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-200">{evt.type}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        evt.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                        evt.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 font-sans">
                      {JSON.stringify(evt.details)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SecurityCenter;
