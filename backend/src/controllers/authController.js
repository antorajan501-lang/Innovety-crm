const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { sendPasswordResetOtpEmail } = require('../services/email');

const login = async (req, res) => {
  try {
    const { password } = req.body;
    const loginInput = req.body.userId || req.body.employeeId || req.body.email || req.body.login;

    if (!loginInput || !password) {
      return res.status(400).json({ message: 'User ID and password are required.' });
    }

    const cleanInput = String(loginInput).trim();
    const noSpaceInput = cleanInput.replace(/\s+/g, '');

    // Search user by email, employeeId, name, or id (case-insensitive & space-flexible)
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanInput, mode: 'insensitive' } },
          { employeeId: { equals: cleanInput, mode: 'insensitive' } },
          { name: { equals: cleanInput, mode: 'insensitive' } },
          { name: { contains: cleanInput, mode: 'insensitive' } },
          { id: { equals: cleanInput } }
        ]
      },
      include: {
        teamMembers: {
          include: { team: true }
        }
      }
    });

    if (!user && noSpaceInput) {
      const allUsers = await prisma.user.findMany({
        include: { teamMembers: { include: { team: true } } }
      });
      user = allUsers.find(u =>
        u.email.toLowerCase().replace(/\s+/g, '') === noSpaceInput.toLowerCase() ||
        u.employeeId.toLowerCase().replace(/\s+/g, '') === noSpaceInput.toLowerCase() ||
        u.name.toLowerCase().replace(/\s+/g, '') === noSpaceInput.toLowerCase()
      );
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Your account is disabled.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Check if user is logging in using their temporary password (DOB without slashes)
    let isTempPassword = false;
    if (user.dob) {
      const dobFormatted = user.dob.toISOString().split('T')[0]; // YYYY-MM-DD
      // Format: DDMMYYYY
      const parts = dobFormatted.split('-');
      const dobTemp = `${parts[2]}${parts[1]}${parts[0]}`;
      isTempPassword = (password === dobTemp);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!',
      { expiresIn: '1d' }
    );

    // Track activity
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      details: `Logged in from IP: ${ip}`,
      ipAddress: ip
    });

    // Strip password and attach canonical profilePhoto field
    const { password: _, ...userWithoutPassword } = user;
    const formattedUser = {
      ...userWithoutPassword,
      profilePhoto: userWithoutPassword.profilePic || null
    };

    res.json({
      token,
      user: formattedUser,
      isTempPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        teamMembers: {
          include: { team: { include: { leader: true } } }
        },
        attendances: {
          orderBy: { date: 'desc' },
          take: 30
        }
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      ...userWithoutPassword,
      profilePhoto: userWithoutPassword.profilePic || null
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to retrieve profile.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      college,
      department,
      candidateType,
      degree,
      currentYearSemester,
      graduationYear,
      internshipRole,
      internshipDuration,
      highestQualification,
      keySkills,
      companyName,
      designation,
      totalExperience
    } = req.body;

    let profilePicPath = undefined;
    let resumePath = undefined;

    if (req.file) {
      profilePicPath = `/uploads/profile-pics/${req.file.filename}`;
    }
    if (req.files?.profilePic?.[0]) {
      profilePicPath = `/uploads/profile-pics/${req.files.profilePic[0].filename}`;
    }
    if (req.files?.resume?.[0]) {
      resumePath = `/uploads/resumes/${req.files.resume[0].filename}`;
    }

    const data = {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(college !== undefined && { college: college || companyName || null }),
      ...(department !== undefined && { department }),
      ...(candidateType !== undefined && { candidateType: candidateType || null }),
      ...(degree !== undefined && { degree: degree || null }),
      ...(currentYearSemester !== undefined && { currentYearSemester: currentYearSemester || null }),
      ...(graduationYear !== undefined && { graduationYear: graduationYear || null }),
      ...(internshipRole !== undefined && { internshipRole: internshipRole || null }),
      ...(internshipDuration !== undefined && { internshipDuration: internshipDuration || null }),
      ...(highestQualification !== undefined && { highestQualification: highestQualification || null }),
      ...(keySkills !== undefined && { keySkills: keySkills || null }),
      ...(companyName !== undefined && { companyName: companyName || college || null }),
      ...(designation !== undefined && { designation: designation || null }),
      ...(totalExperience !== undefined && { totalExperience: totalExperience || null }),
      ...(profilePicPath && { profilePic: profilePicPath }),
      ...(resumePath && { resume: resumePath })
    };

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data
    });

    await logActivity({
      userId: req.user.id,
      action: 'PROFILE_UPDATE',
      details: 'Updated profile information'
    });

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({
      message: 'Profile updated successfully.',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    await logActivity({
      userId: req.user.id,
      action: 'PASSWORD_CHANGE',
      details: 'Changed account password'
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password.' });
  }
};

// In-memory tracker for IP-based rate limiting (Max 10 requests / hour per IP)
const ipOtpTracker = new Map();

const checkIpRateLimit = (ip) => {
  const now = Date.now();
  const entry = ipOtpTracker.get(ip);
  if (!entry || now > entry.resetAt) {
    ipOtpTracker.set(ip, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (entry.count >= 10) {
    return false;
  }
  entry.count += 1;
  return true;
};

const forgotPassword = async (req, res) => {
  try {
    const rawEmail = req.body.email || req.body.userId || req.body.login;
    if (!rawEmail || typeof rawEmail !== 'string') {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const email = rawEmail.trim().toLowerCase();
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // IP Rate limit check (Max 10 requests / hour per IP)
    if (!checkIpRateLimit(ip)) {
      return res.status(429).json({ message: 'Too many password reset requests from this IP. Please try again later.' });
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    const now = new Date();

    // 60-second cooldown check
    if (user.lastOtpSentAt) {
      const secondsSinceLastSent = (now.getTime() - new Date(user.lastOtpSentAt).getTime()) / 1000;
      if (secondsSinceLastSent < 60) {
        return res.status(429).json({ message: `Please wait ${Math.ceil(60 - secondsSinceLastSent)} seconds before requesting a new OTP.` });
      }
    }

    // Hourly rate limit per email (Max 5 / hour)
    let hourlyCount = user.otpHourlyCount || 0;
    let windowStart = user.otpHourlyWindowStart ? new Date(user.otpHourlyWindowStart) : null;

    if (!windowStart || (now.getTime() - windowStart.getTime()) > 3600000) {
      hourlyCount = 1;
      windowStart = now;
    } else {
      if (hourlyCount >= 5) {
        return res.status(429).json({ message: 'Maximum hourly password reset attempts reached for this email. Please try again in an hour.' });
      }
      hourlyCount += 1;
    }

    // Generate cryptographically secure 6-digit numeric OTP
    const otpNumber = crypto.randomInt(100000, 999999);
    const otpStr = String(otpNumber);

    // Hash OTP with bcrypt
    const resetOtpHash = await bcrypt.hash(otpStr, 10);
    const resetOtpExpiry = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    // Clear any existing reset token and update OTP fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtpHash,
        resetOtpExpiry,
        resetOtpAttempts: 0,
        lastOtpSentAt: now,
        resetTokenHash: null,
        resetTokenExpiry: null,
        otpHourlyCount: hourlyCount,
        otpHourlyWindowStart: windowStart
      }
    });

    await logActivity({
      userId: user.id,
      action: 'FORGOT_PASSWORD_OTP_REQUESTED',
      details: `Password reset OTP requested from IP: ${ip}`,
      ipAddress: ip
    });

    // Send email asynchronously
    sendPasswordResetOtpEmail(user, otpStr).catch((err) => {
      console.error('Failed to dispatch password reset OTP email:', err);
    });

    return res.json({
      success: true,
      message: 'A 6-digit OTP code has been sent to your registered email address.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Failed to process request. Please try again later.' });
  }
};

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const user = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } }
    });

    if (!user || !user.resetOtpHash || !user.resetOtpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired OTP request.' });
    }

    const now = new Date();
    if (now > new Date(user.resetOtpExpiry)) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (user.resetOtpAttempts >= 5) {
      await logActivity({
        userId: user.id,
        action: 'FORGOT_PASSWORD_MAX_ATTEMPTS_EXCEEDED',
        details: 'Exceeded maximum 5 OTP verification attempts',
        ipAddress: req.ip
      });
      return res.status(429).json({ message: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.resetOtpHash);
    if (!isMatch) {
      const updatedAttempts = user.resetOtpAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { resetOtpAttempts: updatedAttempts }
      });
      const remaining = 5 - updatedAttempts;
      return res.status(400).json({ message: `Invalid OTP. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Maximum attempts reached.'}` });
    }

    // Generate short-lived reset token (valid for 5 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = new Date(now.getTime() + 5 * 60 * 1000);

    // Invalidate OTP hash and set reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtpHash: null,
        resetOtpExpiry: null,
        resetOtpAttempts: 0,
        resetTokenHash,
        resetTokenExpiry
      }
    });

    await logActivity({
      userId: user.id,
      action: 'FORGOT_PASSWORD_OTP_VERIFIED',
      details: 'OTP verified successfully',
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'OTP Verified',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    return res.status(500).json({ message: 'Failed to verify OTP.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirm password do not match.' });
    }

    // Password strength check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } }
    });

    if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
      return res.status(400).json({ message: 'Invalid or expired password reset session. Please request a new OTP.' });
    }

    const now = new Date();
    if (now > new Date(user.resetTokenExpiry)) {
      return res.status(400).json({ message: 'Password reset session has expired. Please request a new OTP.' });
    }

    const isTokenMatch = await bcrypt.compare(resetToken, user.resetTokenHash);
    if (!isTokenMatch) {
      return res.status(400).json({ message: 'Invalid password reset token.' });
    }

    // Check against current password (prevent reuse)
    const isCurrentPassword = await bcrypt.compare(newPassword, user.password);
    if (isCurrentPassword) {
      return res.status(400).json({ message: 'Your new password cannot be the same as your current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear all OTP/reset token state
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtpHash: null,
        resetOtpExpiry: null,
        resetOtpAttempts: 0,
        lastOtpSentAt: null,
        resetTokenHash: null,
        resetTokenExpiry: null
      }
    });

    await logActivity({
      userId: user.id,
      action: 'PASSWORD_RESET_SUCCESSFUL',
      details: 'Password reset successfully via Email OTP',
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
};

module.exports = {
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword
};
