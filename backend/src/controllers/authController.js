const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        teamMembers: {
          include: { team: true }
        }
      }
    });

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

    // Strip password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword,
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
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to retrieve profile.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, college, department } = req.body;
    let profilePicPath = undefined;

    if (req.file) {
      profilePicPath = `/uploads/profile-pics/${req.file.filename}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        phone,
        college,
        department,
        ...(profilePicPath && { profilePic: profilePicPath })
      }
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

const resetPasswordRequest = async (req, res) => {
  // Simple check: for developers or admins to trigger reset, or simulated SMTP request
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email.' });
    }

    // In a fully fledged setup, generate a reset token.
    // For local simulation, we reset to temporary password (DOB without slashes)
    if (!user.dob) {
      return res.status(400).json({ message: 'Unable to reset: DOB not set on profile. Contact administrator.' });
    }

    const dobFormatted = user.dob.toISOString().split('T')[0];
    const parts = dobFormatted.split('-');
    const dobTemp = `${parts[2]}${parts[1]}${parts[0]}`; // DDMMYYYY
    
    const hashedPassword = await bcrypt.hash(dobTemp, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    await logActivity({
      userId: user.id,
      action: 'PASSWORD_RESET',
      details: 'Password reset to default DOB format'
    });

    res.json({
      message: 'Password reset successful. Check your email or use your Date of Birth (DDMMYYYY) to login.',
      tempPassword: dobTemp // Returned for testing purposes in UI
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Failed to process password reset.' });
  }
};

module.exports = {
  login,
  getProfile,
  updateProfile,
  changePassword,
  resetPasswordRequest
};
