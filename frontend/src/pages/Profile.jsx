import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getUploadUrl, getSocket, downloadFile } from '../services/api';
import UserAvatar from '../components/common/UserAvatar';
import CompanyBadge from '../components/common/CompanyBadge';
import {
  Trash2,
  X,
  User,
  Phone,
  School,
  Building,
  Lock,
  Upload,
  CheckCircle,
  AlertTriangle,
  History,
  Laptop,
  Award,
  Building2,
  Briefcase,
  Shield,
  Zap,
  TrendingUp,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  FileText,
  UploadCloud,
  GraduationCap
} from 'lucide-react';

const Profile = () => {
  const { user, updateProfile, removeProfilePicture, changePassword } = useAuth();
  const location = useLocation();

  // Dynamic Profile form matching candidate registration types
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    gender: user?.gender || 'Male',
    college: user?.college || '',
    degree: user?.degree || '',
    graduationYear: user?.graduationYear || '',
    currentYearSemester: user?.currentYearSemester || '',
    cgpa: user?.customData?.cgpa || '',
    keySkills: user?.keySkills || '',
    companyName: user?.companyName || '',
    designation: user?.designation || '',
    totalExperience: user?.totalExperience || '',
    noticePeriod: user?.customData?.noticePeriod || '',
    resume: user?.resume || ''
  });
  const [avatar, setAvatar] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removingPic, setRemovingPic] = useState(false);

  // Resume upload states
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const resumeInputRef = React.useRef(null);

  // Password change form & visibility toggles
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [alert, setAlert] = useState({ type: '', text: '' });
  const [tempPassWarning, setTempPassWarning] = useState(false);
  const [userLogs, setUserLogs] = useState([]);
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [positionHistory, setPositionHistory] = useState([]);
  const [promotionHistory, setPromotionHistory] = useState([]);
  const [fullUserDetails, setFullUserDetails] = useState(null);
  const [userShift, setUserShift] = useState(null);
  const [upcomingSchedule, setUpcomingSchedule] = useState(null);
  const [shiftTimeline, setShiftTimeline] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUserDetails = useCallback(async () => {
    try {
      if (user?.id) {
        const [uRes, hRes, promoRes, sRes, schedRes, timeRes] = await Promise.all([
          api.get(`/users/${user.id}`),
          api.get(`/positions/history/${user.id}`).catch(() => ({ data: [] })),
          api.get(`/users/${user.id}/promotion-history`).catch(() => ({ data: [] })),
          api.get('/shifts/my-shift').catch(() => ({ data: {} })),
          api.get('/shifts/my-schedule').catch(() => ({ data: {} })),
          api.get('/workforce/timeline').catch(() => ({ data: { timeline: [] } }))
        ]);
        setFullUserDetails(uRes.data);
        setAssignedAssets(uRes.data.assignedAssets || []);
        setPositionHistory(hRes.data || []);
        setPromotionHistory(promoRes.data || []);
        if (sRes.data?.shift) {
          setUserShift(sRes.data.shift);
        } else if (sRes.data?.startTime && sRes.data?.endTime) {
          setUserShift(sRes.data);
        }
        const schedData = schedRes.data?.data || (schedRes.data?.today ? schedRes.data : null);
        if (schedData) {
          setUpcomingSchedule(schedData);
        }
        if (timeRes.data?.success && timeRes.data?.timeline) {
          setShiftTimeline(timeRes.data.timeline);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [user?.id]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('changePassword') === 'true') {
      setTempPassWarning(true);
    }

    fetchUserDetails();

    // Fetch user activity log history
    const fetchUserLogs = async () => {
      try {
        if (user?.role === 'ADMIN') {
          const res = await api.get('/logs?limit=15');
          setUserLogs(res.data.logs || []);
        } else {
          // If non-admin, simulated logs or attendance checklist
          setUserLogs([
            { id: '1', action: 'LOGIN', details: 'Authorized CRM login session', createdAt: new Date() },
            { id: '2', action: 'CLOCK_IN', details: 'Clocked check-in successfully', createdAt: new Date() }
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchUserLogs();

    // Real-time synchronization for shift schedule changes
    const handleShiftEvent = (e) => {
      console.log('[Profile] Shift update event detected, refreshing profile schedule:', e);
      fetchUserDetails();
    };

    window.addEventListener('shift_updated', handleShiftEvent);
    const socket = getSocket();
    if (socket) {
      socket.on('shift_updated', handleShiftEvent);
      socket.on('schedule_updated', handleShiftEvent);
    }

    return () => {
      window.removeEventListener('shift_updated', handleShiftEvent);
      if (socket) {
        socket.off('shift_updated', handleShiftEvent);
        socket.off('schedule_updated', handleShiftEvent);
      }
    };
  }, [location, user, fetchUserDetails]);

  // Candidate type resolution (read-only for user, matches registration models)
  const resolvedCandidateType = (() => {
    const rawType = fullUserDetails?.candidateType || user?.candidateType;
    if (rawType === 'Graduate') return 'Graduated';
    if (rawType === 'Experienced Professional') return 'Professional';
    if (rawType && ['Student', 'Graduated', 'Fresher', 'Professional'].includes(rawType)) {
      return rawType;
    }
    // Fallback: if user already has companyName, assume Professional, else Student
    if (fullUserDetails?.companyName || user?.companyName) {
      return 'Professional';
    }
    return 'Student';
  })();

  useEffect(() => {
    const data = fullUserDetails || user;
    if (data) {
      setProfileForm({
        name: data.name || '',
        phone: data.phone || '',
        gender: data.gender || 'Male',
        college: data.college || '',
        degree: data.degree || '',
        graduationYear: data.graduationYear || '',
        currentYearSemester: data.currentYearSemester || '',
        cgpa: data.customData?.cgpa || data.cgpa || '',
        keySkills: data.keySkills || '',
        companyName: data.companyName || '',
        designation: data.designation || '',
        totalExperience: data.totalExperience || '',
        noticePeriod: data.customData?.noticePeriod || data.noticePeriod || '',
        resume: data.resume || ''
      });
    }
  }, [fullUserDetails, user]);

  const handleResumeSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeError('');
    const validExts = ['.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExts.includes(fileExt)) {
      setResumeError('Only PDF, DOC, or DOCX files are allowed.');
      if (resumeInputRef.current) resumeInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError('File size exceeds the 5 MB limit.');
      if (resumeInputRef.current) resumeInputRef.current.value = '';
      return;
    }

    setResumeFile(file);
  };

  const handleRemoveResumeFile = () => {
    setResumeFile(null);
    setResumeError('');
    if (resumeInputRef.current) resumeInputRef.current.value = '';
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setAlert({ type: '', text: '' });
    setResumeError('');

    // Phone validation: if provided, must be 10 digits and not start with 0
    if (profileForm.phone) {
      const phoneDigits = profileForm.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10 || phoneDigits.startsWith('0')) {
        setAlert({ type: 'error', text: 'Phone number must contain exactly 10 digits and cannot start with 0.' });
        return;
      }
    }

    // Graduation year validation if entered
    if (profileForm.graduationYear) {
      const yr = parseInt(profileForm.graduationYear, 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(yr) || profileForm.graduationYear.trim().length !== 4 || yr < 1980 || yr > currentYear + 6) {
        setAlert({ type: 'error', text: `Graduation Year must be a 4-digit year between 1980 and ${currentYear + 6}.` });
        return;
      }
    }

    // Total experience validation if entered
    if (profileForm.totalExperience) {
      const exp = parseFloat(profileForm.totalExperience);
      if (isNaN(exp) || exp < 0) {
        setAlert({ type: 'error', text: 'Total Experience must be a valid non-negative number (e.g. 2.5).' });
        return;
      }
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('name', (profileForm.name || '').trim());
    formData.append('phone', (profileForm.phone || '').trim());
    formData.append('gender', profileForm.gender || 'Male');

    if (resolvedCandidateType === 'Student') {
      formData.append('college', (profileForm.college || '').trim());
      formData.append('degree', (profileForm.degree || '').trim());
      formData.append('graduationYear', (profileForm.graduationYear || '').trim());
      formData.append('currentYearSemester', (profileForm.currentYearSemester || '').trim());
    } else if (resolvedCandidateType === 'Graduated') {
      formData.append('college', (profileForm.college || '').trim());
      formData.append('degree', (profileForm.degree || '').trim());
      formData.append('graduationYear', (profileForm.graduationYear || '').trim());
      formData.append('cgpa', (profileForm.cgpa || '').trim());
      formData.append('keySkills', (profileForm.keySkills || '').trim());
    } else if (resolvedCandidateType === 'Fresher') {
      formData.append('college', (profileForm.college || '').trim());
      formData.append('degree', (profileForm.degree || '').trim());
      formData.append('graduationYear', (profileForm.graduationYear || '').trim());
      formData.append('keySkills', (profileForm.keySkills || '').trim());
    } else if (resolvedCandidateType === 'Professional') {
      formData.append('companyName', (profileForm.companyName || '').trim());
      formData.append('totalExperience', (profileForm.totalExperience || '').trim());
      formData.append('designation', (profileForm.designation || '').trim());
      formData.append('noticePeriod', (profileForm.noticePeriod || '').trim());
      formData.append('keySkills', (profileForm.keySkills || '').trim());
    }

    if (avatar) {
      formData.append('profilePic', avatar);
    }
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }

    const res = await updateProfile(formData);
    setLoading(false);

    if (res.success) {
      setAlert({ type: 'success', text: res.message || 'Profile information updated successfully.' });
      setAvatar(null);
      setResumeFile(null);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
      fetchUserDetails();
    } else {
      setAlert({ type: 'error', text: res.message || 'Failed to update profile.' });
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAlert({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    setLoading(true);

    const res = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    setLoading(false);

    if (res.success) {
      setAlert({ type: 'success', text: res.message });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setTempPassWarning(false);
    } else {
      setAlert({ type: 'error', text: res.message });
    }
  };

  const handleRemoveButtonClick = () => {
    const hasCustomPhoto = Boolean(user?.profilePic || user?.profilePhoto || user?.profileImage || previewUrl);
    if (!hasCustomPhoto) {
      setAlert({ type: 'info', text: 'No profile photo to remove.' });
      return;
    }
    setShowRemoveModal(true);
  };

  const handleConfirmRemovePhoto = async () => {
    setRemovingPic(true);
    try {
      console.log('[Profile] handleConfirmRemovePhoto clicked');
      const res = await removeProfilePicture();
      console.log('[Profile] removeProfilePicture result:', res);
      setShowRemoveModal(false);

      if (res && res.success) {
        setPreviewUrl(null);
        setAvatar(null);
        setAlert({ type: 'success', text: res.message || 'Profile photo removed successfully.' });
      } else {
        setAlert({ type: 'error', text: res?.message || 'Failed to remove profile photo.' });
      }
    } catch (err) {
      console.error('[Profile] Unexpected remove photo error:', err);
      setShowRemoveModal(false);
      setAlert({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to remove profile photo.' });
    } finally {
      setRemovingPic(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));

    setLoading(true);
    const formData = new FormData();
    formData.append('name', profileForm.name || user?.name || '');
    formData.append('phone', profileForm.phone || user?.phone || '');
    formData.append('college', profileForm.college || user?.college || '');
    formData.append('department', profileForm.department || user?.department || '');
    formData.append('profilePic', file);

    const res = await updateProfile(formData);
    setLoading(false);

    if (res.success) {
      setAlert({ type: 'success', text: 'Profile photo uploaded and updated successfully!' });
      setAvatar(null);
    } else {
      setAlert({ type: 'error', text: res.message || 'Failed to upload profile photo.' });
    }
  };

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pt-2 pb-10 px-2 sm:px-4 animate-in fade-in duration-300 text-left">
      {/* DOB temporary password warning */}
      {tempPassWarning && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 animate-bounce" />
          <div>
            <p className="font-bold">Change Password Immediately!</p>
            <p className="text-[11px] opacity-90 mt-0.5">Your account is currently using your Date of Birth as a temporary password. Update it now to ensure account security.</p>
          </div>
        </div>
      )}

      {alert.text && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${alert.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : alert.type === 'info' ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'} text-xs font-semibold`}>
          <span>{alert.text}</span>
          <button onClick={() => setAlert({ type: '', text: '' })} className="hover:opacity-75">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card & Avatar */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-md text-center flex flex-col items-center justify-center">
          <div className="relative group">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={user?.name}
                className="h-28 w-28 rounded-2xl object-cover ring-4 ring-primary/20 shadow-lg"
              />
            ) : (
              <UserAvatar
                user={user}
                className="h-28 w-28 rounded-2xl ring-4 ring-primary/20 shadow-lg text-3xl font-black"
              />
            )}
            <input
              type="file"
              className="hidden"
              id="avatar-upload"
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Action Buttons: Upload (Green) | Remove (Red) — Always Visible */}
          <div className="flex items-center justify-center gap-2.5 mt-4">
            <label
              htmlFor="avatar-upload"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer"
              title="Upload new profile photo"
            >
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </label>

            <button
              type="button"
              onClick={handleRemoveButtonClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer"
              title="Remove profile photo"
            >
              <Trash2 className="h-4 w-4" />
              <span>Remove</span>
            </button>
          </div>

          <h3 className="mt-3 font-black text-lg text-foreground">{user?.name}</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">
            {user?.employeeId || 'ID-001'} • <span className="capitalize text-primary font-bold">{user?.role === 'ADMIN' ? 'Admin' : user?.role?.toLowerCase().replace('_', ' ')}</span>
          </p>

          {/* Position Badge */}
          {fullUserDetails?.position ? (
            <div className="mt-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs"
                style={{ backgroundColor: fullUserDetails.position.color || '#4F46E5', color: fullUserDetails.position.textColor || '#FFFFFF' }}
              >
                <Award className="h-3.5 w-3.5" />
                <span>{fullUserDetails.position.name} (Level {fullUserDetails.position.level})</span>
              </span>
            </div>
          ) : (
            <div className="mt-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                <Award className="h-3.5 w-3.5" />
                <span>Unassigned</span>
              </span>
            </div>
          )}

          <div className="mt-6 border-t border-border/40 pt-4 w-full text-xs space-y-3 text-left text-muted-foreground font-medium">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Organization</span>
              <CompanyBadge organization={fullUserDetails?.organization || user?.organization} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Email</span>
              <span className="text-foreground font-semibold truncate max-w-[170px]">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Branch</span>
              <span className="text-foreground font-semibold">{fullUserDetails?.branch?.name || 'Headquarters'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Department</span>
              <span className="text-foreground font-semibold">{fullUserDetails?.departmentRef?.name || user?.department || 'Software Development'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Reporting Manager</span>
              <span className="text-foreground font-semibold">{fullUserDetails?.reportingManager?.name || 'Self'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Employment Type</span>
              <span className="text-foreground font-semibold">{fullUserDetails?.employmentType || 'Full-time'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">Joining Date</span>
              <span className="text-foreground font-semibold">
                {user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString() : '01/01/2023'}
              </span>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="font-bold text-muted-foreground">Current Shift</span>
                <span className="text-foreground font-semibold flex items-center gap-1.5">
                  <span>{upcomingSchedule?.today?.shiftName || userShift?.name || fullUserDetails?.shiftAssignment?.shift?.name || 'Company Default'}</span>
                  {(upcomingSchedule?.today?.startTime || userShift?.startTime) && (
                    <span className="text-xs text-muted-foreground">
                      ({upcomingSchedule?.today?.startTime || userShift?.startTime} – {upcomingSchedule?.today?.endTime || userShift?.endTime})
                    </span>
                  )}
                </span>
              </div>

              {upcomingSchedule?.today?.scheduleType && upcomingSchedule.today.scheduleType !== 'PERMANENT' && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Active Override</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                    <Zap className="h-2.5 w-2.5" />
                    <span>{upcomingSchedule.today.scheduleType}</span>
                    {upcomingSchedule.today.scheduleReason && (
                      <span className="text-muted-foreground font-normal">({upcomingSchedule.today.scheduleReason})</span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground">Today's Status</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                  (upcomingSchedule?.today?.status || userShift?.todayStatus) === 'Holiday'
                    ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    : (upcomingSchedule?.today?.status || userShift?.todayStatus) === 'WFH'
                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                }`}>
                  {upcomingSchedule?.today?.status || userShift?.todayStatus || 'Working'}
                </span>
              </div>

              {upcomingSchedule?.tomorrow && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Tomorrow</span>
                  <span className="text-foreground font-semibold flex items-center gap-1.5">
                    <span>{upcomingSchedule.tomorrow.shiftName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      ({upcomingSchedule.tomorrow.formattedStart} – {upcomingSchedule.tomorrow.formattedEnd})
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                      upcomingSchedule.tomorrow.status === 'Holiday'
                        ? 'bg-rose-500/10 text-rose-600'
                        : upcomingSchedule.tomorrow.status === 'WFH'
                        ? 'bg-purple-500/10 text-purple-600'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}>
                      {upcomingSchedule.tomorrow.status}
                    </span>
                  </span>
                </div>
              )}

              {userShift?.nextWorkingDay && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Next Working Day</span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {userShift.nextWorkingDay.formattedText}
                  </span>
                </div>
              )}

              {/* 7-Day Mini Schedule Strip */}
              {upcomingSchedule?.upcomingDays && upcomingSchedule.upcomingDays.length > 0 && (
                <div className="pt-2 border-t border-border/30 space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                    Upcoming 7 Days
                  </span>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {upcomingSchedule.upcomingDays.map((dItem, idx) => (
                      <div
                        key={idx}
                        className={`p-1 rounded-lg border text-center ${
                          dItem.isToday
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-border/40 bg-muted/10'
                        }`}
                      >
                        <div className="text-[9px] font-black text-foreground">{dItem.dayName?.substring(0, 3)}</div>
                        <div className="text-[8px] text-muted-foreground font-mono">{dItem.date?.split('-')[2]}</div>
                        <div className={`text-[7px] font-black uppercase mt-0.5 px-0.5 rounded ${
                          dItem.status === 'Holiday'
                            ? 'text-rose-600'
                            : dItem.status === 'WFH'
                            ? 'text-purple-600'
                            : 'text-emerald-600'
                        }`}>
                          {dItem.status === 'Working' ? 'Work' : dItem.status === 'Holiday' ? 'Off' : 'WFH'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editing Info fields Form */}
        {/* Personal Information Form Card */}
        <div className="md:col-span-2 rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-border/40 pb-3">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span>Personal Information</span>
            </h3>

            {/* Read-Only Candidate Type Badge */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Candidate Type:</span>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-xs uppercase tracking-wide">
                {resolvedCandidateType}
              </span>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            {/* 1. Common Editable Fields */}
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-2">
                Basic Contact & Identity
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-muted-foreground">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Enter full name"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-muted-foreground">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-muted-foreground">Gender</label>
                  <select
                    value={profileForm.gender || 'Male'}
                    onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                    className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Dynamic Type-Specific Fields */}
            <div className="pt-3 border-t border-border/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  {resolvedCandidateType === 'Professional' ? (
                    <Briefcase className="h-3.5 w-3.5" />
                  ) : (
                    <GraduationCap className="h-3.5 w-3.5" />
                  )}
                  <span>{resolvedCandidateType} Credentials</span>
                </span>
              </div>

              {/* STUDENT FIELDS */}
              {resolvedCandidateType === 'Student' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">College / Institution *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.college}
                      onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. Stanford / MIT"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Degree / Stream *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.degree}
                      onChange={(e) => setProfileForm({ ...profileForm, degree: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. B.Tech Computer Science"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Graduation Year *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.graduationYear}
                      onChange={(e) => setProfileForm({ ...profileForm, graduationYear: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 2026"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Current Semester / Year *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.currentYearSemester}
                      onChange={(e) => setProfileForm({ ...profileForm, currentYearSemester: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 3rd Year / 6th Semester"
                    />
                  </div>
                </div>
              )}

              {/* GRADUATED FIELDS */}
              {resolvedCandidateType === 'Graduated' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">College / Institution *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.college}
                      onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. Oxford University"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Degree / Stream *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.degree}
                      onChange={(e) => setProfileForm({ ...profileForm, degree: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. M.Sc Information Technology"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Graduation Year *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.graduationYear}
                      onChange={(e) => setProfileForm({ ...profileForm, graduationYear: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 2024"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Percentage / CGPA *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.cgpa}
                      onChange={(e) => setProfileForm({ ...profileForm, cgpa: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 8.5 CGPA / 85%"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground">Skills / Technologies *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.keySkills}
                      onChange={(e) => setProfileForm({ ...profileForm, keySkills: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. React.js, Node.js, Python, PostgreSQL"
                    />
                  </div>
                </div>
              )}

              {/* FRESHER FIELDS */}
              {resolvedCandidateType === 'Fresher' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">College / Institution *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.college}
                      onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. Anna University"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Degree / Stream *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.degree}
                      onChange={(e) => setProfileForm({ ...profileForm, degree: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. B.E Computer Science"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Graduation Year *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.graduationYear}
                      onChange={(e) => setProfileForm({ ...profileForm, graduationYear: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 2025"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Skills / Technologies *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.keySkills}
                      onChange={(e) => setProfileForm({ ...profileForm, keySkills: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. JavaScript, React, SQL, HTML/CSS"
                    />
                  </div>
                </div>
              )}

              {/* PROFESSIONAL FIELDS (NO COLLEGE / UNIVERSITY) */}
              {resolvedCandidateType === 'Professional' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Current / Previous Company *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.companyName}
                      onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. Acme Innovations Corp"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Total Experience (Years) *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.totalExperience}
                      onChange={(e) => setProfileForm({ ...profileForm, totalExperience: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 3.5"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Current / Last Designation *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.designation}
                      onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Notice Period *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.noticePeriod}
                      onChange={(e) => setProfileForm({ ...profileForm, noticePeriod: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. 30 Days / Immediate"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground">Skills / Technologies *</label>
                    <input
                      type="text"
                      required
                      value={profileForm.keySkills}
                      onChange={(e) => setProfileForm({ ...profileForm, keySkills: e.target.value })}
                      className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="e.g. React, TypeScript, Node.js, AWS, Docker"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Resume / CV Attachment Section */}
            <div className="pt-3 border-t border-border/40">
              <label className="text-xs font-bold text-muted-foreground block mb-2">
                Resume / Curriculum Vitae (PDF, DOC, DOCX)
              </label>

              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeSelect}
                className="hidden"
                id="resume-upload-input"
              />

              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="resume-upload-input"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/60 text-foreground text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  <UploadCloud className="h-4 w-4 text-primary" />
                  <span>{resumeFile ? 'Change Selected File' : profileForm.resume ? 'Replace Uploaded Resume' : 'Choose Resume Document'}</span>
                </label>

                {profileForm.resume && !resumeFile && (
                  <button
                    type="button"
                    onClick={() => downloadFile(profileForm.resume)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all cursor-pointer"
                    title="Download / View current resume"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>View Stored Resume</span>
                  </button>
                )}

                {resumeFile && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[200px]">{resumeFile.name}</span>
                    <span className="text-[10px] text-muted-foreground">({(resumeFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    <button
                      type="button"
                      onClick={handleRemoveResumeFile}
                      className="p-0.5 hover:text-rose-500 transition-colors ml-1 cursor-pointer"
                      title="Cancel file selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {resumeError && (
                <p className="text-[11px] text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{resumeError}</span>
                </p>
              )}
            </div>

            {avatar && (
              <p className="text-[11px] text-primary font-bold">New Avatar image selected: "{avatar.name}". Save changes to apply.</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-primary px-6 py-3 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : 'Save Information Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Assigned Hardware & Assets Section */}
      <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left space-y-4">
        <div className="flex items-center gap-3 border-b border-border/40 pb-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Laptop className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-foreground">Assigned Hardware & Assets</h3>
            <p className="text-xs text-muted-foreground font-medium">Laptops, monitors, mobile devices, and equipment issued to your profile.</p>
          </div>
        </div>

        {assignedAssets.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center italic font-semibold">No company assets are currently assigned to your account.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {assignedAssets.map((asset) => (
              <div key={asset.id} className="p-4 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">{asset.assetId}</span>
                    <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                      {asset.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold mt-2 text-foreground">{asset.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{asset.brand} {asset.model}</p>
                </div>
                <div className="mt-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground font-semibold flex justify-between">
                  <span>Category: {asset.category}</span>
                  <span>S/N: {asset.serialNumber || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Change password panel */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground mb-5 border-b border-border/40 pb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>Change Account Password</span>
          </h3>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  placeholder="Current password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 pr-11 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer focus:outline-none"
                  title={showCurrent ? "Hide current password" : "Show current password"}
                  aria-label={showCurrent ? "Hide current password" : "Show current password"}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">New Secure Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="New password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 pr-11 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer focus:outline-none"
                  title={showNew ? "Hide new password" : "Show new password"}
                  aria-label={showNew ? "Hide new password" : "Show new password"}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 pr-11 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer focus:outline-none"
                  title={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-primary px-6 py-3 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* Activity history logs summary */}
        <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground border-b border-border/40 pb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            <span>Promotion Timeline & Career Progression</span>
          </h3>

          {promotionHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground italic font-semibold py-3 text-center">
              No historical role promotions recorded. Current role is active.
            </p>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {promotionHistory.map((item) => (
                <div key={item.id} className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] uppercase font-bold">{item.previousRole}</span>
                      <span className="text-amber-500 font-bold">➔</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] uppercase font-black">{item.newRole}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{new Date(item.effectiveDate).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium pt-1 border-t border-amber-500/20">
                    <div>
                      <span className="font-mono text-primary font-bold">{item.previousEmployeeId}</span> ➔ <span className="font-mono text-amber-600 font-black">{item.newEmployeeId}</span>
                    </div>
                    {item.newPosition && (
                      <span className="font-bold text-foreground bg-card px-2.5 py-0.5 rounded-full border border-border/40">
                        {item.newPosition.name}
                      </span>
                    )}
                  </div>

                  {item.promotionReason && (
                    <p className="text-[11px] text-muted-foreground italic">
                      "{item.promotionReason}"
                    </p>
                  )}

                  {item.promotedBy && (
                    <div className="text-[10px] text-muted-foreground font-semibold flex items-center justify-end gap-1">
                      <span>Promoted by:</span>
                      <span className="text-foreground font-bold">{item.promotedBy.name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground pt-4 border-t border-border/40 pb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <span>Position Rank History</span>
          </h3>

          {positionHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground italic font-semibold py-4 text-center">
              No previous rank promotions recorded. Current position is active.
            </p>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {positionHistory.map((item) => (
                <div key={item.id} className="p-3 rounded-2xl border border-border/40 bg-muted/20 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-muted-foreground">
                      {item.oldPosition?.name || 'Initial Rank'} → <span className="text-primary font-black">{item.newPosition?.name || 'Updated Position'}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">{new Date(item.effectiveDate).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">Reason: {item.reason || 'Career advancement'}</p>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground pt-4 border-t border-border/40 pb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>Shift Change Timeline</span>
          </h3>

          {shiftTimeline.length === 0 ? (
            <p className="text-xs text-muted-foreground italic font-semibold py-4 text-center">
              No shift adjustments or overrides recorded. Currently on default assignment.
            </p>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {shiftTimeline.map((item) => (
                <div key={item.id} className="p-3.5 rounded-2xl border border-border/40 bg-muted/20 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-foreground flex items-center gap-1.5">
                      <span>{item.title}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20">
                        {item.type}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Shift: <strong className="text-foreground">{item.shiftName}</strong> ({item.timings})</span>
                    <span className="text-[11px]">By: <strong className="text-foreground">{item.actor}</strong></span>
                  </div>

                  {item.reason && (
                    <p className="text-[11px] text-muted-foreground font-medium italic">
                      "{item.reason}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground pt-4 border-t border-border/40 pb-2 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <span>Recent Account Actions</span>
          </h3>

          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {userLogs.map((log, index) => (
              <div key={index} className="flex gap-3 items-start text-xs border-l-2 border-primary/30 pl-3.5 py-1">
                <div>
                  <p className="font-bold text-foreground">{log.action}</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{log.details}</p>
                  <span className="text-[10px] text-muted-foreground/70 font-semibold">{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Remove Profile Picture Confirmation Modal */}
      <AnimatePresence>
        {showRemoveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-6 shadow-2xl space-y-4 text-left font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Remove Profile Photo?</h3>
                    <p className="text-xs text-muted-foreground font-medium">Revert to default avatar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRemoveModal(false)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                This will restore your default avatar across the entire CRM.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowRemoveModal(false)}
                  disabled={removingPic}
                  className="px-4 py-2 rounded-xl border border-border/70 bg-card hover:bg-muted text-foreground text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemovePhoto}
                  disabled={removingPic}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {removingPic ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
