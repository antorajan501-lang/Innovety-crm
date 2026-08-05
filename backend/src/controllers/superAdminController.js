const prisma = require('../utils/db');
const bcrypt = require('bcrypt');
const { logActivity } = require('../utils/activityLogger');

/**
 * 1. Platform Statistics & Overview
 */
const getPlatformStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalTeamLeaders,
      totalEmployees,
      totalInterns,
      totalTeams,
      activeProjects,
      recentLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'TEAM_LEADER' } }),
      prisma.user.count({ where: { role: 'EMPLOYEE' } }),
      prisma.user.count({ where: { role: 'INTERN' } }),
      prisma.team.count(),
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, role: true } } }
      })
    ]);

    const platformSettings = await getOrCreatePlatformSettings();

    res.json({
      stats: {
        totalUsers,
        totalAdmins,
        totalTeamLeaders,
        totalEmployees,
        totalInterns,
        totalTeams,
        activeProjects
      },
      branding: platformSettings,
      recentLogs
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({ message: 'Failed to retrieve platform statistics.' });
  }
};

/**
 * Helper to get or initialize PlatformSettings single instance
 */
const getOrCreatePlatformSettings = async () => {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: 'PLATFORM' }
  });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: {
        id: 'PLATFORM',
        companyName: 'Innoviety Enterprise',
        selectedTheme: 'emerald',
        themeMode: 'light'
      }
    });
  }

  return settings;
};

/**
 * 2. Get Platform Branding & Theme Settings
 */
const getPlatformSettings = async (req, res) => {
  try {
    const settings = await getOrCreatePlatformSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get platform settings error:', error);
    res.status(500).json({ message: 'Failed to retrieve platform settings.' });
  }
};

/**
 * 3. Update Platform Branding & Theme
 */
const updatePlatformSettings = async (req, res) => {
  try {
    const { companyName, companyLogo, selectedTheme, themeMode, removeLogo } = req.body;
    const currentSettings = await getOrCreatePlatformSettings();

    let newLogo = currentSettings.companyLogo;
    if (req.file) {
      newLogo = `/uploads/branding/${req.file.filename}`;
    } else if (removeLogo === 'true' || removeLogo === true) {
      newLogo = null;
    } else if (companyLogo !== undefined) {
      newLogo = companyLogo;
    }

    const updated = await prisma.platformSettings.update({
      where: { id: 'PLATFORM' },
      data: {
        companyName: companyName || currentSettings.companyName,
        companyLogo: newLogo,
        selectedTheme: selectedTheme || currentSettings.selectedTheme,
        themeMode: themeMode || currentSettings.themeMode
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_UPDATE_BRANDING',
      details: `Updated platform branding: Name='${updated.companyName}', Theme='${updated.selectedTheme}', Mode='${updated.themeMode}'`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(updated);
  } catch (error) {
    console.error('Update platform settings error:', error);
    res.status(500).json({ message: 'Failed to update platform settings.' });
  }
};

/**
 * 4. Users Directory (Super Admin - All Roles)
 */
const getUsersDirectory = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role && role !== 'ALL') {
      where.role = role;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [users, totalCount, superAdminCount, adminCount, tlCount, empCount, internCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          department: true,
          designation: true,
          college: true,
          profilePic: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'TEAM_LEADER' } }),
      prisma.user.count({ where: { role: 'EMPLOYEE' } }),
      prisma.user.count({ where: { role: 'INTERN' } })
    ]);

    res.json({
      users,
      totalCount,
      roleCounts: {
        ALL: totalCount,
        SUPER_ADMIN: superAdminCount,
        ADMIN: adminCount,
        TEAM_LEADER: tlCount,
        EMPLOYEE: empCount,
        INTERN: internCount
      },
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Get users directory error:', error);
    res.status(500).json({ message: 'Failed to retrieve users directory.' });
  }
};

/**
 * 5. Get User Audit & Activity History
 */
const getUserAuditHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        department: true,
        designation: true,
        college: true,
        companyName: true,
        totalExperience: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const logs = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ user, logs });
  } catch (error) {
    console.error('Get user audit history error:', error);
    res.status(500).json({ message: 'Failed to retrieve user audit history.' });
  }
};

/**
 * 6. Update User Status (Activate / Deactivate)
 */
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_UPDATE_USER_STATUS',
      details: `Changed user status for ${targetUser.name} (${targetUser.employeeId}) from '${targetUser.status}' to '${status}'`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(updated);
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Failed to update user status.' });
  }
};

/**
 * 7. Reset User Password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_RESET_USER_PASSWORD',
      details: `Reset password for user ${targetUser.name} (${targetUser.employeeId})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ message: `Password reset successfully for ${targetUser.name}.` });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ message: 'Failed to reset user password.' });
  }
};

/**
 * 8. Unlock User Account
 */
const unlockUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_UNLOCK_USER',
      details: `Unlocked account for user ${targetUser.name} (${targetUser.employeeId})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ message: `Account unlocked successfully for ${targetUser.name}.` });
  } catch (error) {
    console.error('Unlock user account error:', error);
    res.status(500).json({ message: 'Failed to unlock user account.' });
  }
};

/**
 * 9. Team Directory (Super Admin - STRICTLY READ ONLY)
 */
const getTeamsDirectory = async (req, res) => {
  try {
    const { search } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } }
      ];
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        leader: {
          select: { id: true, name: true, email: true, employeeId: true, profilePic: true }
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, employeeId: true } }
          }
        },
        projects: {
          select: { id: true, name: true, status: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedTeams = teams.map(t => ({
      id: t.id,
      name: t.name,
      code: t.code,
      department: t.department,
      leader: t.leader,
      memberCount: t.members.length,
      members: t.members.map(m => m.user),
      activeProjectCount: t.projects.filter(p => p.status === 'ACTIVE').length,
      createdAt: t.createdAt
    }));

    res.json(formattedTeams);
  } catch (error) {
    console.error('Get teams directory error:', error);
    res.status(500).json({ message: 'Failed to retrieve teams directory.' });
  }
};

/**
 * 10. Admin Management - Get Admins List
 */
const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        department: true,
        designation: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Failed to retrieve admin accounts.' });
  }
};

/**
 * Helper to auto-generate Admin Employee ID (e.g. AD-1005)
 */
const generateAdminEmployeeId = async () => {
  const admins = await prisma.user.findMany({
    where: { employeeId: { startsWith: 'AD-' } },
    select: { employeeId: true }
  });

  let maxNum = 1000;
  admins.forEach(u => {
    if (u.employeeId) {
      const match = u.employeeId.match(/AD-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1;
  return `AD-${nextNum.toString().padStart(4, '0')}`;
};

/**
 * 11. Admin Management - Create Admin Account
 */
const createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, department, designation, status = 'ACTIVE' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let newAdmin = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!newAdmin && attempts < maxAttempts) {
      attempts++;
      const employeeId = await generateAdminEmployeeId();
      try {
        newAdmin = await prisma.user.create({
          data: {
            employeeId,
            name,
            email,
            phone: phone || null,
            password: hashedPassword,
            role: 'ADMIN',
            status,
            department: department || 'Administration',
            designation: designation || 'System Administrator'
          },
          select: {
            id: true,
            employeeId: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            department: true,
            designation: true,
            createdAt: true
          }
        });
      } catch (err) {
        if (err.code === 'P2002' && (err.meta?.target?.includes('employeeId') || String(err).includes('employeeId')) && attempts < maxAttempts) {
          console.warn(`[createAdmin] Concurrency collision on employeeId. Retrying attempt ${attempts}...`);
          continue;
        }
        throw err;
      }
    }

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_CREATE_ADMIN',
      details: `Created Admin account for ${newAdmin.name} (${newAdmin.employeeId}, ${newAdmin.email})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.status(201).json(newAdmin);
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Failed to create admin account.' });
  }
};

/**
 * 12. Admin Management - Update Admin Account
 */
const updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { name, email, phone, department, designation, status } = req.body;

    const targetAdmin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!targetAdmin || targetAdmin.role !== 'ADMIN') {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    const updatedAdmin = await prisma.user.update({
      where: { id: adminId },
      data: {
        name: name || targetAdmin.name,
        email: email || targetAdmin.email,
        phone: phone !== undefined ? phone : targetAdmin.phone,
        department: department || targetAdmin.department,
        designation: designation || targetAdmin.designation,
        status: status || targetAdmin.status
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        department: true,
        designation: true,
        updatedAt: true
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_UPDATE_ADMIN',
      details: `Updated Admin account for ${updatedAdmin.name} (${updatedAdmin.employeeId})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json(updatedAdmin);
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: 'Failed to update admin account.' });
  }
};

/**
 * 13. Admin Management - Delete Admin Account
 */
const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    const targetAdmin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!targetAdmin || targetAdmin.role !== 'ADMIN') {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    await prisma.user.delete({ where: { id: adminId } });

    await logActivity({
      userId: req.user.id,
      action: 'SUPER_ADMIN_DELETE_ADMIN',
      details: `Deleted Admin account for ${targetAdmin.name} (${targetAdmin.employeeId})`,
      ipAddress: req.ip || '127.0.0.1'
    });

    res.json({ message: `Admin account ${targetAdmin.name} deleted successfully.` });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ message: 'Failed to delete admin account.' });
  }
};

module.exports = {
  getPlatformStats,
  getPlatformSettings,
  updatePlatformSettings,
  getUsersDirectory,
  getUserAuditHistory,
  updateUserStatus,
  resetUserPassword,
  unlockUserAccount,
  getTeamsDirectory,
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin
};
