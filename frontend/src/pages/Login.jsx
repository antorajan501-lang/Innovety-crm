import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Loader2, ArrowRight } from 'lucide-react';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
);

const Login = () => {
  const { login, requestPasswordReset } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  
  // Forgot Password state
  const [resetUserId, setResetUserId] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [tempPassAlert, setTempPassAlert] = useState('');

  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) {
      setError('Please enter both your User ID and password.');
      return;
    }
    setError('');
    setLoading(true);

    const res = await login(userId, password);
    setLoading(false);

    if (res.success) {
      if (res.isTempPassword) {
        // Logged in but needs to change password
        navigate('/profile?changePassword=true');
      } else {
        navigate('/');
      }
    } else {
      setError(res.message);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetUserId) {
      setError('Please enter your User ID.');
      return;
    }
    setError('');
    setLoading(true);
    setResetSuccess('');
    setTempPassAlert('');

    const res = await requestPasswordReset(resetUserId);
    setLoading(false);

    if (res.success) {
      setResetSuccess(res.message);
      if (res.tempPassword) {
        setTempPassAlert(`Testing Note: Password reset to DOB: "${res.tempPassword}".`);
      }
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1d] px-4 py-12">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-[#0F5A46]/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[#17A673]/10 blur-[120px]" />

      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-black tracking-widest text-[#17A673] mb-2 uppercase">
            INNOVEITY
          </h1>
          <h2 className="text-lg font-semibold tracking-tight text-slate-300">
            {forgotMode ? 'Reset Password' : 'Sign in to your portal'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">
            {forgotMode 
              ? 'Enter your User ID to reset password to Date of Birth format.'
              : 'Unified Portal for Interns, Admins & Employees'
            }
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 font-medium">
            {error}
          </div>
        )}

        {resetSuccess && (
          <div className="mt-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 font-medium">
            {resetSuccess}
            {tempPassAlert && <p className="mt-1 text-slate-400 font-mono">{tempPassAlert}</p>}
          </div>
        )}

        {!forgotMode ? (
          <form className="mt-6 space-y-4" onSubmit={handleLoginSubmit}>
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300">User ID / Employee ID / Intern ID</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. IN-1001, EM-1001, TL-1001, or AD-0001"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2.5 pl-10 pr-4 text-sm text-white focus:border-[#17A673]/50 focus:ring-1 focus:ring-[#17A673]/30 placeholder:text-slate-600 transition-all"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setError('');
                  }}
                  className="text-xs text-[#17A673] hover:text-[#6FD3A6] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2.5 pl-10 pr-10 text-sm text-white focus:border-[#17A673]/50 focus:ring-1 focus:ring-[#17A673]/30 placeholder:text-slate-600 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-[11px] text-slate-500 hover:text-[#17A673] transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F5A46] py-3 text-sm font-semibold text-white transition-all hover:bg-[#17A673] active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleResetSubmit}>
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-slate-300">User ID / Employee ID / Intern ID</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="e.g. IN-1001, EM-1001, TL-1001, or AD-0001"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2.5 pl-10 pr-4 text-sm text-white focus:border-[#17A673]/50 focus:ring-1 focus:ring-[#17A673]/30 placeholder:text-slate-600 transition-all"
                  value={resetUserId}
                  onChange={(e) => setResetUserId(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F5A46] py-3 text-sm font-semibold text-white transition-all hover:bg-[#17A673] active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Send Reset Instructions</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setError('');
                setResetSuccess('');
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-white"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
