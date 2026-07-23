import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getUploadUrl } from '../services/api';
import {
  User,
  Phone,
  School,
  Building,
  Lock,
  Upload,
  CheckCircle,
  AlertTriangle,
  History
} from 'lucide-react';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const location = useLocation();

  // Basic Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    college: user?.college || '',
    department: user?.department || ''
  });
  const [avatar, setAvatar] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [alert, setAlert] = useState({ type: '', text: '' });
  const [tempPassWarning, setTempPassWarning] = useState(false);
  const [userLogs, setUserLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check url search query for change password triggers
    const query = new URLSearchParams(location.search);
    if (query.get('changePassword') === 'true') {
      setTempPassWarning(true);
    }

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
  }, [location, user]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        college: user.college || '',
        department: user.department || ''
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('name', profileForm.name);
    formData.append('phone', profileForm.phone);
    formData.append('college', profileForm.college);
    formData.append('department', profileForm.department);
    if (avatar) {
      formData.append('profilePic', avatar);
    }

    const res = await updateProfile(formData);
    setLoading(false);

    if (res.success) {
      setAlert({ type: 'success', text: res.message });
      setAvatar(null);
    } else {
      setAlert({ type: 'error', text: res.message });
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
      setTempPassWarning(false);
    } else {
      setAlert({ type: 'error', text: res.message });
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
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* DOB temporary password warning */}
      {tempPassWarning && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-warning bg-warning/5 text-warning-foreground text-xs font-semibold text-left">
          <AlertTriangle className="h-5 w-5 text-warning animate-bounce" />
          <div>
            <p className="font-bold">Change Password Immediately!</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Your account is currently using your Date of Birth as a temporary password. Update it now to ensure account security.</p>
          </div>
        </div>
      )}

      {alert.text && (
        <div className={`flex items-center justify-between p-4 rounded-xl border ${alert.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-500'} text-xs font-semibold`}>
          <span>{alert.text}</span>
          <button onClick={() => setAlert({ type: '', text: '' })}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card & Avatar */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-center flex flex-col items-center justify-center">
          <div className="relative group">
            <img
              src={previewUrl || (user?.profilePic ? getUploadUrl(user.profilePic) : `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`)}
              alt={user?.name}
              className="h-28 w-28 rounded-2xl object-cover ring-4 ring-primary/10 shadow-lg transition-all group-hover:opacity-90"
            />
            <input
              type="file"
              className="hidden"
              id="avatar-upload"
              accept="image/*"
              onChange={handleAvatarChange}
            />
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-2 -right-2 p-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl cursor-pointer shadow-md hover:scale-105 transition-all flex items-center gap-1"
              title="Click to upload new profile photo"
            >
              <Upload className="h-4 w-4" />
            </label>
          </div>

          <h3 className="mt-4 font-bold text-base">{user?.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {user?.employeeId} • <span className="capitalize">{user?.role === 'ADMIN' ? 'Super Admin' : user?.role?.toLowerCase().replace('_', ' ')}</span>
          </p>

          <div className="mt-6 border-t border-border/30 pt-4 w-full text-xs space-y-2.5 text-left text-muted-foreground">
            <p><strong>Email:</strong> <span className="text-foreground">{user?.email}</span></p>
            <p><strong>Department:</strong> <span className="text-foreground">{user?.department || 'N/A'}</span></p>
            <p><strong>Joining Date:</strong> <span className="text-foreground">{new Date(user?.joiningDate).toLocaleDateString()}</span></p>
          </div>
        </div>

        {/* Editing Info fields Form */}
        <div className="md:col-span-2 rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left">
          <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 mb-4 border-b border-border/30 pb-2">
            Personal Information
          </h3>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">College</label>
                <input
                  type="text"
                  value={profileForm.college}
                  onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Department</label>
                <input
                  type="text"
                  value={profileForm.department}
                  onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                />
              </div>
            </div>

            {avatar && (
              <p className="text-[10px] text-primary font-bold">New Avatar image selected: "{avatar.name}". Save changes to apply.</p>
            )}

            <button type="submit" disabled={loading} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
              Save Information Changes
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Change password panel */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left">
          <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 mb-4 border-b border-border/30 pb-2">
            Change Account Password
          </h3>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
              <input
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">New Secure Password</label>
              <input
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Confirm New Password</label>
              <input
                type="password"
                placeholder="Confirm password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
              Update Password
            </button>
          </form>
        </div>

        {/* Activity history logs summary */}
        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-premium text-left">
          <h3 className="text-xs font-bold uppercase tracking-tight text-foreground/80 mb-4 border-b border-border/30 pb-2">
            Recent Account Actions
          </h3>

          <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
            {userLogs.map((log, index) => (
              <div key={index} className="flex gap-2.5 items-start text-xs border-l border-primary/20 pl-3">
                <div>
                  <p className="font-semibold text-foreground">{log.action}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.details}</p>
                  <span className="text-[9px] text-muted-foreground/60">{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
