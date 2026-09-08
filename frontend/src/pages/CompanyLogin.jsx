import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Lock, Mail, AlertTriangle, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useOrganizationBranding } from '../context/BrandContext';

const CompanyLogin = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { updatePublicBranding } = useOrganizationBranding();

  const [companyBranding, setCompanyBranding] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);

  // Form State
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Cross-Tenant Protection (Phase 6.6): If authenticated user opens another company's login, redirect
  useEffect(() => {
    if (user) {
      const userSlug = user.organization?.slug || 'innoveity';
      if (user.role === 'SUPER_ADMIN') {
        navigate('/super-admin', { replace: true });
      } else if (slug && userSlug.toLowerCase() !== slug.toLowerCase()) {
        console.warn(`[Cross-Tenant Protect] User from '${userSlug}' attempted to access '/company/${slug}'. Redirecting...`);
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, slug, navigate]);

  // 2. Fetch Public Company Branding
  useEffect(() => {
    if (!slug) return;
    setLoadingCompany(true);
    setErrorMsg('');
    setIsSuspended(false);

    api.get(`/public/company/${slug}`)
      .then((res) => {
        if (res.data) {
          setCompanyBranding(res.data);
          updatePublicBranding(res.data);
        }
      })
      .catch((err) => {
        if (err.response?.status === 403) {
          setIsSuspended(true);
          setErrorMsg(err.response?.data?.message || 'This company account is currently suspended.');
        } else {
          setErrorMsg(err.response?.data?.message || 'Company not found. Please check the URL slug.');
        }
      })
      .finally(() => setLoadingCompany(false));
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!loginInput.trim() || !password) {
      setFormError('Please enter your email/ID and password.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await login(loginInput.trim(), password, { organizationSlug: slug });
      if (res && res.success) {
        navigate('/dashboard');
      } else {
        setFormError(res?.message || 'Invalid login credentials.');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = companyBranding?.primaryColor || '#10B981';

  if (loadingCompany) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-4">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-xs font-bold text-muted-foreground">Loading company portal...</p>
      </div>
    );
  }

  if (errorMsg || isSuspended) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl text-center space-y-5">
          <div className="h-14 w-14 rounded-3xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground">{isSuspended ? 'Account Suspended' : 'Company Not Found'}</h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">{errorMsg}</p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-all"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            <span>Go to Global Login</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accent Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6 text-left relative z-10"
      >
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div
            className="h-16 w-16 rounded-2xl mx-auto flex items-center justify-center font-extrabold text-white text-xl shadow-lg overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
            {companyBranding?.logo ? (
              <img src={companyBranding.logo} alt="Company Logo" className="h-full w-full object-cover" />
            ) : (
              (companyBranding?.name || 'C').charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">{companyBranding?.name}</h1>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: `${primaryColor}40`,
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor
                }}
              >
                {companyBranding?.companyCode}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Sign in to your {companyBranding?.name} enterprise portal
            </p>
          </div>
        </div>

        {formError && (
          <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email / Employee ID
            </label>
            <input
              type="text"
              required
              placeholder="e.g. john@company.com or EMP001"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${primaryColor}50` }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl text-white text-xs font-extrabold transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 8px 20px -4px ${primaryColor}40`
            }}
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In to {companyBranding?.name}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-border/60 text-center">
          <Link to="/login" className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
            Switch to Global Login Portal
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default CompanyLogin;
