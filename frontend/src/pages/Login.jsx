import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  User,
  Lock,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Mail,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  X,
  RotateCcw
} from 'lucide-react';

const Login = () => {
  const { user, login, requestPasswordReset, verifyResetOtp, resetPasswordWithToken } = useAuth();
  const { companyName, companyLogo } = useTheme();

  // Login form state
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot Password Overlay Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Timers
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300);

  const otpInputRefs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // OTP Expiry timer (Step 2)
  useEffect(() => {
    let timer;
    if (forgotModalOpen && forgotStep === 2 && otpExpirySeconds > 0) {
      timer = setInterval(() => {
        setOtpExpirySeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [forgotModalOpen, forgotStep, otpExpirySeconds]);

  // Handle Login Submit
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
      const loggedUserRole = res.user?.role || user?.role;
      if (loggedUserRole === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard');
      } else {
        navigate('/');
      }
    } else {
      setError(res.message);
    }
  };

  // Open Forgot Password Modal
  const openForgotModal = () => {
    setForgotModalOpen(true);
    setForgotStep(1);
    setForgotEmail(userId.includes('@') ? userId : '');
    setOtpDigits(['', '', '', '', '', '']);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
  };

  // Close Forgot Password Modal
  const closeForgotModal = () => {
    setForgotModalOpen(false);
    setForgotStep(1);
    setForgotError('');
    setForgotSuccess('');
  };

  // Step 1: Request Password Reset OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);

    const res = await requestPasswordReset(forgotEmail.trim());
    setForgotLoading(false);

    if (res.success) {
      setForgotSuccess(res.message || 'OTP sent to your email address.');
      setForgotStep(2);
      setResendCooldown(60);
      setOtpExpirySeconds(300);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } else {
      setForgotError(res.message);
    }
  };

  // Step 2: Handle OTP Digit Change
  const handleOtpDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const nextDigits = [...otpDigits];
    nextDigits[index] = value.slice(-1);
    setOtpDigits(nextDigits);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP Keydown (Backspace navigation)
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP Paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedText)) {
      const nextDigits = pastedText.split('');
      setOtpDigits(nextDigits);
      otpInputRefs.current[5]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setForgotError('Please enter the complete 6-digit OTP.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);

    const res = await verifyResetOtp(forgotEmail.trim(), otp);
    setForgotLoading(false);

    if (res.success) {
      setResetToken(res.resetToken);
      setForgotSuccess('OTP verified successfully! Please set your new password.');
      setForgotStep(3);
    } else {
      setForgotError(res.message);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setForgotError('');
    setForgotLoading(true);

    const res = await requestPasswordReset(forgotEmail.trim());
    setForgotLoading(false);

    if (res.success) {
      setForgotSuccess('A new 6-digit OTP has been sent to your email.');
      setResendCooldown(60);
      setOtpExpirySeconds(300);
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } else {
      setForgotError(res.message);
    }
  };

  // Step 3: Password Strength Validation
  const passValidation = {
    length: newPassword.length >= 8,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    matches: newPassword && newPassword === confirmPassword
  };

  const isPasswordValid =
    passValidation.length &&
    passValidation.hasUpper &&
    passValidation.hasLower &&
    passValidation.hasNumber &&
    passValidation.hasSpecial &&
    passValidation.matches;

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setForgotError('Please ensure all password complexity requirements are satisfied.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);

    const res = await resetPasswordWithToken(forgotEmail.trim(), resetToken, newPassword, confirmPassword);
    setForgotLoading(false);

    if (res.success) {
      setForgotStep(4);
    } else {
      setForgotError(res.message);
    }
  };

  const displayName = companyName || 'INNOVEITY';
  const logoSrc = companyLogo || '/v-logo.png';

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 font-sans theme-canvas-bg overflow-hidden transition-colors duration-300">
      {/* Decorative ambient background glows (Driven by Theme Primary Color) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-[650px] w-[650px] rounded-full blur-3xl opacity-20 transition-all duration-500"
          style={{ backgroundColor: 'rgb(var(--primary))' }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-[650px] w-[650px] rounded-full blur-3xl opacity-20 transition-all duration-500"
          style={{ backgroundColor: 'rgb(var(--primary))' }}
        />
      </div>

      {/* Main 2-Column Enterprise Login Card Container */}
      <div className="relative z-10 w-full max-w-4xl rounded-[32px] bg-card text-card-foreground shadow-2xl shadow-black/10 border border-border/80 overflow-hidden flex flex-col lg:flex-row min-h-[580px] transition-all duration-300">
        {/* LEFT COLUMN: Hero Branding Panel with 3D Clockwise Rolling Node Sphere & Centered Logo */}
        <div className="w-full lg:w-1/2 bg-muted/40 border-b lg:border-b-0 lg:border-r border-border/60 p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Dynamic Theme Gradient Background Accent */}
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-500 opacity-10"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgb(var(--primary)), transparent 70%)'
            }}
          />

          {/* Top Brand Tag */}
          <div className="relative z-10 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: 'rgb(var(--primary))' }}
            />
            <span className="text-[11px] font-extrabold tracking-widest text-muted-foreground uppercase">
              {displayName}
            </span>
          </div>

          {/* CENTER: 3D Connected Node Sphere Animation (Rolling Clockwise with Dynamic Logo in Center) */}
          <div className="relative z-10 my-6 flex items-center justify-center">
            <div className="relative h-72 w-72 sm:h-80 sm:w-80 flex items-center justify-center">
              {/* Ambient backlight glow */}
              <div
                className="absolute inset-4 rounded-full blur-2xl opacity-15 pointer-events-none transition-all duration-500"
                style={{ backgroundColor: 'rgb(var(--primary))' }}
              />

              {/* 3D Rolling Clockwise Wireframe Sphere */}
              <div className="absolute inset-0 animate-[spin_22s_linear_infinite]">
                <svg viewBox="0 0 300 300" className="w-full h-full">
                  <defs>
                    <linearGradient id="themeSphereGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="themeSphereGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.15" />
                    </linearGradient>
                  </defs>

                  {/* Outer Boundary Circle */}
                  <circle cx="150" cy="150" r="130" fill="none" stroke="rgb(var(--primary))" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />

                  {/* 3D Latitude Ellipses */}
                  <ellipse cx="150" cy="150" rx="130" ry="45" fill="none" stroke="url(#themeSphereGrad1)" strokeWidth="1.2" transform="rotate(-15 150 150)" />
                  <ellipse cx="150" cy="150" rx="130" ry="75" fill="none" stroke="url(#themeSphereGrad2)" strokeWidth="1.2" transform="rotate(25 150 150)" />
                  <ellipse cx="150" cy="150" rx="130" ry="105" fill="none" stroke="url(#themeSphereGrad1)" strokeWidth="1" transform="rotate(-45 150 150)" />
                  <ellipse cx="150" cy="150" rx="130" ry="50" fill="none" stroke="url(#themeSphereGrad2)" strokeWidth="1.2" transform="rotate(65 150 150)" />
                  <ellipse cx="150" cy="150" rx="130" ry="120" fill="none" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.3" transform="rotate(105 150 150)" />

                  {/* Intersecting Network Lines */}
                  <line x1="60" y1="90" x2="150" y2="35" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />
                  <line x1="150" y1="35" x2="235" y2="85" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />
                  <line x1="235" y1="85" x2="255" y2="170" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />
                  <line x1="255" y1="170" x2="190" y2="245" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />
                  <line x1="190" y1="245" x2="105" y2="255" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />
                  <line x1="105" y1="255" x2="45" y2="185" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />
                  <line x1="45" y1="185" x2="60" y2="90" stroke="rgb(var(--primary))" strokeWidth="0.8" opacity="0.4" />

                  <line x1="95" y1="65" x2="205" y2="105" stroke="rgb(var(--primary))" strokeWidth="0.7" opacity="0.3" />
                  <line x1="75" y1="135" x2="225" y2="195" stroke="rgb(var(--primary))" strokeWidth="0.7" opacity="0.3" />
                  <line x1="125" y1="225" x2="175" y2="75" stroke="rgb(var(--primary))" strokeWidth="0.7" opacity="0.3" />

                  {/* Network Node Dots */}
                  <g>
                    <circle cx="150" cy="35" r="4.5" fill="rgb(var(--primary))" />
                    <circle cx="150" cy="35" r="8" fill="rgb(var(--primary))" opacity="0.25" />

                    <circle cx="235" cy="85" r="4" fill="rgb(var(--primary))" />
                    <circle cx="255" cy="170" r="4.5" fill="rgb(var(--primary))" />
                    <circle cx="190" cy="245" r="4" fill="rgb(var(--primary))" opacity="0.8" />
                    <circle cx="105" cy="255" r="4.5" fill="rgb(var(--primary))" />
                    <circle cx="45" cy="185" r="4" fill="rgb(var(--primary))" />
                    <circle cx="60" cy="90" r="4.5" fill="rgb(var(--primary))" />

                    <circle cx="95" cy="65" r="3.5" fill="rgb(var(--primary))" opacity="0.8" />
                    <circle cx="205" cy="105" r="3.5" fill="rgb(var(--primary))" />
                    <circle cx="75" cy="135" r="3.5" fill="rgb(var(--primary))" />
                    <circle cx="225" cy="195" r="3.5" fill="rgb(var(--primary))" />
                    <circle cx="125" cy="225" r="3.5" fill="rgb(var(--primary))" opacity="0.8" />
                    <circle cx="175" cy="75" r="3.5" fill="rgb(var(--primary))" />
                  </g>
                </svg>
              </div>

              {/* CENTER LOGO: Dynamic Transparent Company Logo */}
              <div className="relative z-20 flex items-center justify-center transition-transform duration-300 hover:scale-105">
                <img
                  src={logoSrc}
                  alt={displayName}
                  className="h-24 sm:h-32 w-auto object-contain mix-blend-multiply drop-shadow-md"
                  onError={(e) => {
                    e.target.src = '/v-logo.png';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Descriptor */}
          <div className="relative z-10 space-y-1 text-center lg:text-left">
            <h3 className="text-lg font-black text-primary tracking-tight">
              Enterprise CRM Workspace
            </h3>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              Streamlining team workflows, dynamic builders, and real-time operations.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Original Interactive Login Form Panel */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 flex flex-col justify-center my-auto text-left">
          <div className="my-auto w-full">
            {/* Title Header (Center Aligned) */}
            <div className="mb-6 space-y-1 text-center">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-primary text-center">
                {displayName}
              </h2>
              <p className="text-xs font-semibold text-muted-foreground text-center">
                Enter your enterprise credentials to access your portal.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl bg-danger/10 border border-danger/20 p-3.5 text-xs text-danger font-semibold">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* ORIGINAL LOGIN FORM */}
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              {/* User ID / Email */}
              <div className="space-y-1">
                <div className="relative group">
                  <User className="absolute left-4 top-4 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Enter Mail or User ID"
                    className="w-full rounded-2xl border border-border/80 bg-muted/20 py-3.5 pl-11 pr-4 text-sm text-foreground font-medium hover:border-primary/40 focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/60 transition-all outline-none [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(248,250,252,1)_inset] [&:-webkit-autofill]:-webkit-text-fill-color:rgb(30,41,59)"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="relative group">
                  <Lock className="absolute left-4 top-4 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter Password"
                    className="w-full rounded-2xl border border-border/80 bg-muted/20 py-3.5 pl-11 pr-11 text-sm text-foreground font-medium hover:border-primary/40 focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-muted-foreground/60 transition-all outline-none [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(248,250,252,1)_inset] [&:-webkit-autofill]:-webkit-text-fill-color:rgb(30,41,59)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-4 top-4 text-muted-foreground hover:text-primary transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password Row */}
              <div className="flex items-center justify-between text-xs font-semibold pt-1">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="hidden"
                  />
                  {rememberMe ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground/40" />
                  )}
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={openForgotModal}
                  className="text-primary hover:text-primary-hover font-bold hover:underline transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Main Submit Button (Dynamic Theme Gradient) */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground py-3.5 text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Log In to Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* SECURE FORGOT PASSWORD EMAIL OTP OVERLAY MODAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-card text-card-foreground border border-border/80 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Password Recovery</h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    {forgotStep === 1 && 'Step 1 of 3: Verification Email'}
                    {forgotStep === 2 && 'Step 2 of 3: Enter 6-Digit OTP'}
                    {forgotStep === 3 && 'Step 3 of 3: Create New Password'}
                    {forgotStep === 4 && 'Recovery Complete'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeForgotModal}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error & Success Feedback Banners */}
            {forgotError && (
              <div className="flex items-start gap-2 rounded-2xl bg-danger/10 border border-danger/20 p-3.5 text-xs text-danger font-semibold">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>{forgotError}</span>
              </div>
            )}
            {forgotSuccess && forgotStep !== 4 && (
              <div className="flex items-center gap-2 rounded-2xl bg-success/10 border border-success/20 p-3.5 text-xs text-success font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* STEP 1: ENTER REGISTERED EMAIL */}
            {forgotStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your registered account email. If the email exists in our records, a secure 6-digit OTP code will be sent.
                </p>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Registered Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-muted/20 py-3 pl-11 pr-4 text-sm font-medium hover:border-primary/40 focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground py-3 text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Send OTP Code</span>}
                </button>
              </form>
            )}

            {/* STEP 2: ENTER 6-DIGIT OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit verification code sent to:
                  </p>
                  <p className="text-xs font-bold text-foreground font-mono">{forgotEmail}</p>
                </div>

                {/* 6-Digit Inputs */}
                <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-13 text-center text-lg font-black rounded-xl border border-border/80 bg-muted/30 focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    />
                  ))}
                </div>

                {/* Timers */}
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-medium">
                  <span>Expires in: <strong className="text-foreground font-mono">{formatTimer(otpExpirySeconds)}</strong></span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || forgotLoading}
                    className="text-primary hover:underline font-bold disabled:text-muted-foreground/60 disabled:no-underline cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || otpDigits.join('').length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground py-3 text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Verify OTP & Continue</span>}
                </button>
              </form>
            )}

            {/* STEP 3: SET NEW PASSWORD */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-2xl border border-border/80 bg-muted/20 py-3 pl-11 pr-11 text-sm font-medium hover:border-primary/40 focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary"
                      >
                        {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-foreground">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-2xl border border-border/80 bg-muted/20 py-3 pl-11 pr-11 text-sm font-medium hover:border-primary/40 focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary"
                      >
                        {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Complexity Checklist */}
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5 text-[11px] font-medium">
                  <p className="font-bold text-foreground mb-1">Password Strength Checklist:</p>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span className={passValidation.length ? 'text-success font-bold flex items-center gap-1' : ''}>
                      {passValidation.length ? '✓' : '•'} 8+ characters
                    </span>
                    <span className={passValidation.hasUpper ? 'text-success font-bold flex items-center gap-1' : ''}>
                      {passValidation.hasUpper ? '✓' : '•'} 1 Uppercase
                    </span>
                    <span className={passValidation.hasLower ? 'text-success font-bold flex items-center gap-1' : ''}>
                      {passValidation.hasLower ? '✓' : '•'} 1 Lowercase
                    </span>
                    <span className={passValidation.hasNumber ? 'text-success font-bold flex items-center gap-1' : ''}>
                      {passValidation.hasNumber ? '✓' : '•'} 1 Number
                    </span>
                    <span className={passValidation.hasSpecial ? 'text-success font-bold flex items-center gap-1' : ''}>
                      {passValidation.hasSpecial ? '✓' : '•'} 1 Special char
                    </span>
                    <span className={passValidation.matches ? 'text-success font-bold flex items-center gap-1' : ''}>
                      {passValidation.matches ? '✓' : '•'} Passwords match
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !isPasswordValid}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground py-3 text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Reset Password & Finish</span>}
                </button>
              </form>
            )}

            {/* STEP 4: SUCCESS CONFIRMATION */}
            {forgotStep === 4 && (
              <div className="py-4 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-foreground">Password Reset Successful!</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your password has been updated and all active login sessions have been invalidated for security. Please log in using your new credentials.
                  </p>
                </div>
                <button
                  onClick={closeForgotModal}
                  className="w-full py-3 rounded-2xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 transition-all cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
