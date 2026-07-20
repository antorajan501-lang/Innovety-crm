const bcrypt = require('bcrypt');
const prisma = require('../utils/db');
const { sendWelcomeEmail } = require('../services/email');
const { logActivity } = require('../utils/activityLogger');

// Helper to auto-generate employee ID
const generateEmployeeId = async (role) => {
  const count = await prisma.user.count();
  const prefix = role === 'ADMIN' ? 'AD' : role === 'TEAM_LEADER' ? 'TL' : 'IN';
  const number = 1000 + count + 1;
  return `${prefix}-${number}`;
};

// Helper to format DOB to temporary password (DDMMYYYY)
const formatDobToPassword = (dobString) => {
  // dobString expected as YYYY-MM-DD or standard ISO date
  const date = new Date(dobString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, dob, college, department, joiningDate, role } = req.body;

    if (!name || !email || !dob || !role) {
      return res.status(400).json({ message: 'Name, email, date of birth, and role are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const employeeId = await generateEmployeeId(role);
    const tempPasswordText = formatDobToPassword(dob);
    const hashedPassword = await bcrypt.hash(tempPasswordText, 10);

    const newUser = await prisma.user.create({
      data: {
        employeeId,
        name,
        email,
        password: hashedPassword,
        phone,
        dob: new Date(dob),
        college,
        department,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        role,
        status: 'ACTIVE'
      }
    });

    // Send automated email in background
    sendWelcomeEmail(newUser, tempPasswordText).catch((err) => {
      console.error('Failed to send welcome email to user:', newUser.email, err);
    });

    await logActivity({
      userId: req.user.id,
      action: 'USER_CREATE',
      details: `Created new user ${newUser.name} (${employeeId}) with role ${role}`
    });

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Failed to create user.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { role, status, teamId, search, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Filter clauses
    const where = {};

    if (role) {
      where.role = role;
    }
    if (status) {
      where.status = status;
    }
    if (teamId) {
      where.teamMembers = {
        some: { teamId }
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { college: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          teamMembers: {
            include: { team: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    const usersWithoutPassword = users.map((u) => {
      const { password, ...details } = u;
      return details;
    });

    res.json({
      users: usersWithoutPassword,
      meta: {
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
};

const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, dob, college, department, joiningDate, role, status } = req.body;

    const data = {
      name,
      email,
      phone,
      college,
      department,
      role,
      status
    };

    if (dob) {
      data.dob = new Date(dob);
    }
    if (joiningDate) {
      data.joiningDate = new Date(joiningDate);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data
    });

    await logActivity({
      userId: req.user.id,
      action: 'USER_EDIT',
      details: `Updated user info for ${updatedUser.name} (${updatedUser.employeeId})`
    });

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Edit user error:', error);
    res.status(500).json({ message: 'Failed to update user.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await prisma.user.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'USER_DELETE',
      details: `Deleted user ${user.name} (${user.employeeId})`
    });

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // ACTIVE or INACTIVE

    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status }
    });

    await logActivity({
      userId: req.user.id,
      action: 'USER_STATUS_TOGGLE',
      details: `Set status of ${updatedUser.name} to ${status}`
    });

    res.json({ message: `User status set to ${status}.` });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ message: 'Failed to modify account status.' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.dob) {
      return res.status(400).json({ message: 'DOB must be set on user record to reset password.' });
    }

    const tempPasswordText = formatDobToPassword(user.dob);
    const hashedPassword = await bcrypt.hash(tempPasswordText, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    await logActivity({
      userId: req.user.id,
      action: 'USER_PASSWORD_RESET',
      details: `Admin reset password for user ${user.name} (${user.employeeId})`
    });

    res.json({
      message: 'Password successfully reset to DOB format.',
      tempPassword: tempPasswordText
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password.' });
  }
};

const bulkImport = async (req, res) => {
  try {
    const { usersList } = req.body; // Array of user objects

    if (!Array.isArray(usersList) || usersList.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty user list provided.' });
    }

    const createdUsers = [];
    const skippedUsers = [];

    for (let u of usersList) {
      const { name, email, phone, dob, college, department, role } = u;

      if (!name || !email || !dob || !role) {
        skippedUsers.push({ email, reason: 'Missing required fields.' });
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        skippedUsers.push({ email, reason: 'Email already exists.' });
        continue;
      }

      const employeeId = await generateEmployeeId(role);
      const tempPasswordText = formatDobToPassword(dob);
      const hashedPassword = await bcrypt.hash(tempPasswordText, 10);

      const created = await prisma.user.create({
        data: {
          employeeId,
          name,
          email,
          password: hashedPassword,
          phone,
          dob: new Date(dob),
          college,
          department,
          role,
          status: 'ACTIVE'
        }
      });

      sendWelcomeEmail(created, tempPasswordText).catch((err) => {
        console.error('Failed to send welcome email inside bulk import:', created.email, err);
      });

      createdUsers.push(created.email);
    }

    await logActivity({
      userId: req.user.id,
      action: 'USER_BULK_IMPORT',
      details: `Bulk imported ${createdUsers.length} users successfully. Skipped ${skippedUsers.length}.`
    });

    res.status(201).json({
      message: `Successfully imported ${createdUsers.length} users.`,
      createdCount: createdUsers.length,
      skipped: skippedUsers
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Failed to process bulk import.' });
  }
};

const bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body; // Array of IDs

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty list of IDs.' });
    }

    const deleteResult = await prisma.user.deleteMany({
      where: {
        id: { in: ids },
        role: { not: 'ADMIN' } // Prevent deleting admins
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'USER_BULK_DELETE',
      details: `Bulk deleted ${deleteResult.count} users.`
    });

    res.json({ message: `Successfully deleted ${deleteResult.count} users.` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: 'Failed to process bulk delete.' });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  editUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  bulkImport,
  bulkDelete
};
