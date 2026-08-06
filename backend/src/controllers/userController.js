const bcrypt = require('bcrypt');
const prisma = require('../utils/db');
const { sendWelcomeEmail } = require('../services/email');
const { logActivity } = require('../utils/activityLogger');
const { addUserToCompanyChat, removeUserFromCompanyChat } = require('../services/companyChatService');
const { disconnectUserSocket } = require('../socket');

// Helper to auto-generate employee ID per role (e.g. EM-1001, IN-1005)
const generateEmployeeId = async (role) => {
  const prefix = role === 'EMPLOYEE' ? 'EM' : role === 'ADMIN' ? 'AD' : role === 'TEAM_LEADER' ? 'TL' : 'IN';

  const users = await prisma.user.findMany({
    where: {
      employeeId: {
        startsWith: `${prefix}-`
      }
    },
    select: {
      employeeId: true
    }
  });

  let maxNum = 1000;
  users.forEach(u => {
    if (u.employeeId) {
      const match = u.employeeId.match(/^[A-Z]+-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1;
  return `${prefix}-${nextNum}`;
};

// Helper to format DOB to temporary password (DDMMYYYY)
const formatDobToPassword = (dobString) => {
  const date = new Date(dobString);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}${month}${year}`;
};

const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      dob,
      college,
      department,
      joiningDate,
      role,
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

    if (!name || !email || !dob || !role) {
      return res.status(400).json({ message: 'Name, email, date of birth, and role are required.' });
    }

    // Check candidate type dynamic mandatory fields if candidateType is provided
    let resumePath = null;
    if (req.files?.resume?.[0]) {
      resumePath = `/uploads/resumes/${req.files.resume[0].filename}`;
    } else if (req.body.resume) {
      resumePath = req.body.resume;
    }

    let profilePicPath = null;
    if (req.files?.profilePic?.[0]) {
      profilePicPath = `/uploads/profile-pics/${req.files.profilePic[0].filename}`;
    }

    if (candidateType) {
      if (candidateType === 'Student') {
        if (!college && !companyName) return res.status(400).json({ message: 'College/University Name is required for Student.' });
        if (!degree) return res.status(400).json({ message: 'Degree is required for Student.' });
        if (!currentYearSemester) return res.status(400).json({ message: 'Current Year / Semester is required for Student.' });
        if (!resumePath) return res.status(400).json({ message: 'Resume (PDF/DOC) is required for Student.' });
      } else if (candidateType === 'Graduate') {
        if (!college && !companyName) return res.status(400).json({ message: 'College/University Name is required for Graduate.' });
        if (!degree) return res.status(400).json({ message: 'Degree is required for Graduate.' });
        if (!graduationYear) return res.status(400).json({ message: 'Graduation Year is required for Graduate.' });
        if (!resumePath) return res.status(400).json({ message: 'Resume (PDF/DOC) is required for Graduate.' });
      } else if (candidateType === 'Intern') {
        if (!college && !companyName) return res.status(400).json({ message: 'College / Company Name is required for Intern.' });
        if (!internshipRole) return res.status(400).json({ message: 'Internship Role is required for Intern.' });
        if (!internshipDuration) return res.status(400).json({ message: 'Internship Duration is required for Intern.' });
        if (!resumePath) return res.status(400).json({ message: 'Resume (PDF/DOC) is required for Intern.' });
      } else if (candidateType === 'Fresher') {
        if (!highestQualification) return res.status(400).json({ message: 'Highest Qualification is required for Fresher.' });
        if (!graduationYear) return res.status(400).json({ message: 'Graduation Year is required for Fresher.' });
        if (!keySkills) return res.status(400).json({ message: 'Key Skills are required for Fresher.' });
        if (!resumePath) return res.status(400).json({ message: 'Resume (PDF/DOC) is required for Fresher.' });
      } else if (candidateType === 'Professional') {
        if (!companyName && !college) return res.status(400).json({ message: 'Current / Previous Company is required for Professional.' });
        if (!designation) return res.status(400).json({ message: 'Designation is required for Professional.' });
        if (!totalExperience) return res.status(400).json({ message: 'Total Experience is required for Professional.' });
        if (!resumePath) return res.status(400).json({ message: 'Resume (PDF/DOC) is required for Professional.' });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const tempPasswordText = formatDobToPassword(dob);
    const hashedPassword = await bcrypt.hash(tempPasswordText, 10);

    let newUser = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!newUser && attempts < maxAttempts) {
      attempts++;
      const employeeId = await generateEmployeeId(role);
      try {
        newUser = await prisma.user.create({
          data: {
            employeeId,
            name,
            email,
            password: hashedPassword,
            phone,
            dob: new Date(dob),
            college: college || companyName || null,
            department,
            joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
            role,
            status: 'ACTIVE',
            profilePic: profilePicPath,
            candidateType: candidateType || null,
            resume: resumePath || null,
            degree: degree || null,
            currentYearSemester: currentYearSemester || null,
            graduationYear: graduationYear || null,
            internshipRole: internshipRole || null,
            internshipDuration: internshipDuration || null,
            highestQualification: highestQualification || null,
            keySkills: keySkills || null,
            companyName: companyName || college || null,
            designation: designation || null,
            totalExperience: totalExperience || null
          }
        });
      } catch (err) {
        if (err.code === 'P2002' && (err.meta?.target?.includes('employeeId') || String(err).includes('employeeId')) && attempts < maxAttempts) {
          console.warn(`[createUser] Concurrency collision on employeeId. Retrying attempt ${attempts}...`);
          continue;
        }
        throw err;
      }
    }

    console.log('[createUser] Successfully created user:', {
      createdEmployeeId: newUser.employeeId,
      createdUserId: newUser.id,
      role: newUser.role
    });

    // Sync user with Company Chat Room
    await addUserToCompanyChat(newUser.id);

    // Send automated email in background
    sendWelcomeEmail(newUser, tempPasswordText).catch((err) => {
      console.error('Failed to send welcome email to user:', newUser.email, err);
    });

    await logActivity({
      userId: req.user.id,
      action: 'USER_CREATE',
      details: `Created new user ${newUser.name} (${newUser.employeeId}) with role ${role}`
    });

    const { password: _, ...userWithoutPassword } = newUser;
    console.log('[createUser] Returning success response');
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: error.message || 'Failed to create user.' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { role, status, teamId, search, page = 1, limit = 50, excludeSuperAdmin = 'true', excludeSelf } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Filter clauses
    const where = {};

    // Always exclude Super Admin account from registry listings
    if (excludeSuperAdmin === 'true' || role?.includes('ADMIN') || role?.includes('TEAM_LEADER')) {
      where.email = { not: 'admin@enterprise-crm.com' };
      where.employeeId = { not: 'AD-0001' };
    }

    if (excludeSelf === 'true' && req.user?.id) {
      where.id = { not: req.user.id };
    }

    if (role) {
      let parsedRoles = [];
      if (typeof role === 'string' && role.includes(',')) {
        parsedRoles = role.split(',').map(r => r.trim());
      } else if (Array.isArray(role)) {
        parsedRoles = role;
      } else {
        parsedRoles = [role];
      }
      parsedRoles = parsedRoles.filter(r => r === 'ADMIN' || r === 'TEAM_LEADER' || r === 'INTERN' || r === 'EMPLOYEE');
      if (parsedRoles.length > 0) {
        where.role = { in: parsedRoles };
      }
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
        { college: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { candidateType: { contains: search, mode: 'insensitive' } }
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
      return {
        ...details,
        profilePhoto: details.profilePic || null
      };
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

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        teamMembers: {
          include: { team: { include: { leader: true } } }
        },
        attendances: {
          take: 30,
          orderBy: { date: 'desc' }
        },
        assignedAssets: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const { password, ...details } = user;
    res.json(details);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch user details.' });
  }
};

const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      dob,
      college,
      department,
      joiningDate,
      role,
      status,
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

    // Fetch current user to compare DOB
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const data = {
      name,
      email,
      phone,
      college: college !== undefined ? (college || companyName || null) : existingUser.college,
      department,
      role,
      status
    };

    if (candidateType !== undefined) data.candidateType = candidateType || null;
    if (degree !== undefined) data.degree = degree || null;
    if (currentYearSemester !== undefined) data.currentYearSemester = currentYearSemester || null;
    if (graduationYear !== undefined) data.graduationYear = graduationYear || null;
    if (internshipRole !== undefined) data.internshipRole = internshipRole || null;
    if (internshipDuration !== undefined) data.internshipDuration = internshipDuration || null;
    if (highestQualification !== undefined) data.highestQualification = highestQualification || null;
    if (keySkills !== undefined) data.keySkills = keySkills || null;
    if (companyName !== undefined) data.companyName = companyName || college || null;
    if (designation !== undefined) data.designation = designation || null;
    if (totalExperience !== undefined) data.totalExperience = totalExperience || null;

    if (req.files?.resume?.[0]) {
      data.resume = `/uploads/resumes/${req.files.resume[0].filename}`;
    } else if (req.body.resume !== undefined) {
      data.resume = req.body.resume || null;
    }

    if (req.files?.profilePic?.[0]) {
      data.profilePic = `/uploads/profile-pics/${req.files.profilePic[0].filename}`;
    }

    let dobPasswordReset = false;

    if (dob) {
      const newDob = new Date(dob);
      data.dob = newDob;

      // Detect DOB change for non-admin roles and auto-reset password
      const oldDobStr = existingUser.dob ? existingUser.dob.toISOString().split('T')[0] : null;
      const newDobStr = newDob.toISOString().split('T')[0];
      const roleRequiresReset = ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'].includes(existingUser.role);

      if (roleRequiresReset && oldDobStr !== newDobStr) {
        const newTempPassword = formatDobToPassword(newDob);
        data.password = await bcrypt.hash(newTempPassword, 10);
        dobPasswordReset = true;

        // Audit: record DOB change and password reset — never log the password value
        await logActivity({
          userId: req.user.id,
          action: 'USER_DOB_CHANGED',
          details: `Admin updated DOB for ${existingUser.name} (${existingUser.employeeId}): ` +
                   `${oldDobStr || 'not set'} → ${newDobStr}. ` +
                   `Initial password automatically reset based on new DOB.`
        });
      }
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
    res.json({ ...userWithoutPassword, dobPasswordReset });
  } catch (error) {
    console.error('Edit user error:', error);
    res.status(500).json({ message: error.message || 'Failed to update user.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'SUPER_ADMIN' || user.email === 'admin@enterprise-crm.com' || user.employeeId === 'AD-0001') {
      return res.status(403).json({ success: false, message: 'Super Admin account cannot be modified or deleted.' });
    }

    // Wrap the complete deletion inside an atomic Prisma transaction
    await prisma.$transaction(async (tx) => {
      // 1. Reset references on assigned Assets: set assignedToId = null, assignedDate = null, expectedReturn = null, status = AVAILABLE
      await tx.asset.updateMany({
        where: { assignedToId: id },
        data: {
          assignedToId: null,
          assignedDate: null,
          expectedReturn: null,
          status: 'AVAILABLE'
        }
      });

      // 2. Set assignedById = null on AssetAssignment history
      await tx.assetAssignment.updateMany({
        where: { assignedById: id },
        data: { assignedById: null }
      });

      // 3. Reset references on assigned Tickets: set assigneeId = null
      await tx.ticket.updateMany({
        where: { assigneeId: id },
        data: { assigneeId: null }
      });

      // 4. Reset references on Teams led by this user: set leaderId = null
      await tx.team.updateMany({
        where: { leaderId: id },
        data: { leaderId: null }
      });

      // 5. Delete team memberships
      await tx.teamMember.deleteMany({
        where: { userId: id }
      });

      // 6. Reset targetUserId on Announcements
      await tx.announcement.updateMany({
        where: { targetUserId: id },
        data: { targetUserId: null }
      });

      // 7. Delete ChatRoomMember records
      await tx.chatRoomMember.deleteMany({
        where: { userId: id }
      });

      // 8. Permanently delete user record from PostgreSQL
      await tx.user.delete({
        where: { id }
      });
    });

    // Disconnect active socket connection if user is online
    if (disconnectUserSocket) {
      disconnectUserSocket(id);
    }

    await logActivity({
      userId: req.user.id,
      action: 'USER_DELETE',
      details: `Deleted user ${user.name} (${user.employeeId})`
    });

    return res.json({
      success: true,
      message: 'Record deleted successfully.',
      deletedUserId: id
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete record. Please try again.' });
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

    if (status === 'ACTIVE') {
      await addUserToCompanyChat(id);
    } else {
      await removeUserFromCompanyChat(id);
    }

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

      const parsedDob = new Date(dob);
      if (isNaN(parsedDob.getTime())) {
        console.warn(`Skipping invalid DOB line in bulk import for email: ${email}`);
        continue;
      }

      const created = await prisma.user.create({
        data: {
          employeeId,
          name,
          email,
          password: hashedPassword,
          phone,
          dob: parsedDob,
          college,
          department,
          role,
          status: 'ACTIVE'
        }
      });

      await addUserToCompanyChat(created.id);

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
  getUserById,
  editUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  bulkImport,
  bulkDelete
};
