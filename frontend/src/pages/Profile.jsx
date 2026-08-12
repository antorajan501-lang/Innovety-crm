import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getUploadUrl } from '../services/api';
import UserAvatar from '../components/common/UserAvatar';
import {
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
  TrendingUp
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
  const [assignedAssets, setAssignedAssets] = useState([]);
  const [positionHistory, setPositionHistory] = useState([]);
  const [promotionHistory, setPromotionHistory] = useState([]);
  const [fullUserDetails, setFullUserDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check url search query for change password triggers
    const query = new URLSearchParams(location.search);
    if (query.get('changePassword') === 'true') {
      setTempPassWarning(true);
    }

    // Fetch user details including assigned assets, position history & promotion history
    const fetchUserDetails = async () => {
      try {
        if (user?.id) {
          const [uRes, hRes, promoRes] = await Promise.all([
            api.get(`/users/${user.id}`),
            api.get(`/positions/history/${user.id}`).catch(() => ({ data: [] })),
            api.get(`/users/${user.id}/promotion-history`).catch(() => ({ data: [] }))
          ]);
          setFullUserDetails(uRes.data);
          setAssignedAssets(uRes.data.assignedAssets || []);
          setPositionHistory(hRes.data || []);
          setPromotionHistory(promoRes.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

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
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${alert.type === 'success' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-red-500/30 bg-red-500/10 text-red-500'} text-xs font-semibold`}>
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
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-2 -right-2 p-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl cursor-pointer shadow-md hover:scale-105 transition-all flex items-center justify-center"
              title="Click to upload new profile photo"
            >
              <Upload className="h-4 w-4" />
            </label>
          </div>

          <h3 className="mt-4 font-black text-lg text-foreground">{user?.name}</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-0.5">
            {user?.employeeId || 'ID-001'} • <span className="capitalize text-primary font-bold">{user?.role === 'ADMIN' ? 'Admin' : user?.role?.toLowerCase().replace('_', ' ')}</span>
          </p>

          {/* Position Badge */}
          {fullUserDetails?.position && (
            <div className="mt-2.5">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs"
                style={{ backgroundColor: fullUserDetails.position.color || '#4F46E5', color: fullUserDetails.position.textColor || '#FFFFFF' }}
              >
                <Award className="h-3.5 w-3.5" />
                <span>{fullUserDetails.position.name} (Level {fullUserDetails.position.level})</span>
              </span>
            </div>
          )}

          <div className="mt-6 border-t border-border/40 pt-4 w-full text-xs space-y-3 text-left text-muted-foreground font-medium">
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
          </div>
        </div>

        {/* Editing Info fields Form */}
        <div className="md:col-span-2 rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-md text-left">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground mb-5 border-b border-border/40 pb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span>Personal Information</span>
          </h3>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Enter full name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Phone Number</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">College / University</label>
                <input
                  type="text"
                  value={profileForm.college}
                  onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Enter college name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground">Department</label>
                <input
                  type="text"
                  value={profileForm.department}
                  onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                  className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="Enter department"
                />
              </div>
            </div>

            {avatar && (
              <p className="text-[11px] text-primary font-bold">New Avatar image selected: "{avatar.name}". Save changes to apply.</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-primary px-6 py-3 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all disabled:opacity-50"
              >
                Save Information Changes
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
              <input
                type="password"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">New Secure Password</label>
              <input
                type="password"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground">Confirm New Password</label>
              <input
                type="password"
                placeholder="Confirm password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full rounded-2xl border border-border/70 bg-background px-4 py-2.5 text-xs font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                required
              />
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
    </div>
  );
};

export default Profile;
