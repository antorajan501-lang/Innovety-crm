const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * GET /api/organization/tree
 * Centralized Enterprise Organization Tree for dynamic dropdowns and smart reporting manager filtering
 */
const getOrganizationTree = async (req, res) => {
  try {
    const { targetRole, branchId, departmentId } = req.query;

    const [branches, departments, designations, positions, shifts, employmentTypes, unassignedUsers] = await Promise.all([
      prisma.orgBranch.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.departmentMaster.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        include: {
          users: { select: { id: true, name: true, email: true, employeeId: true, role: true, profilePic: true, position: { select: { name: true, color: true } } } },
          _count: { select: { users: true } }
        }
      }),
      prisma.designationMaster.findMany({ where: { status: 'ACTIVE' }, include: { department: true, _count: { select: { users: true } } }, orderBy: { name: 'asc' } }),
      prisma.position.findMany({ where: { status: 'ACTIVE' }, orderBy: { level: 'asc' } }),
      prisma.shiftMaster.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.employmentTypeMaster.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.user.findMany({
        where: { status: 'ACTIVE', departmentId: null },
        select: { id: true, name: true, email: true, employeeId: true, role: true, profilePic: true, position: { select: { id: true, name: true, color: true } } },
        orderBy: { name: 'asc' }
      })
    ]);

    // Reporting Manager Eligibility Rules per specification:
    // Include roles: EMPLOYEE, TEAM_LEADER, ADMIN
    // Exclude roles: INTERN, SUPER_ADMIN, and self (if editing)
    const allowedManagerRoles = ['EMPLOYEE', 'TEAM_LEADER', 'ADMIN'];

    const managerWhere = {
      status: 'ACTIVE',
      role: { in: allowedManagerRoles }
    };

    if (req.query.excludeUserId) {
      managerWhere.id = { not: req.query.excludeUserId };
    }

    const reportingManagers = await prisma.user.findMany({
      where: managerWhere,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        department: true,
        position: { select: { id: true, name: true, code: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      branches,
      departments,
      designations,
      positions,
      shifts,
      employmentTypes,
      unassignedUsers,
      reportingManagers,
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN']
    });
  } catch (error) {
    console.error('Fetch organization tree error:', error);
    res.status(500).json({ message: 'Failed to fetch organization tree.' });
  }
};

// Deprecated Branch CRUD (Single company Innoveity architecture)
const getBranches = async (req, res) => res.json([]);
const createBranch = async (req, res) => res.status(400).json({ message: 'Branch module has been deprecated for single-company architecture.' });
const updateBranch = async (req, res) => res.status(400).json({ message: 'Branch module has been deprecated for single-company architecture.' });

// Department CRUD
const getDepartments = async (req, res) => {
  try {
    const depts = await prisma.departmentMaster.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true } } } });
    res.json(depts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch departments.' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code, memberUserIds } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Name and Code are required.' });

    // Backend Validation: Reject if any requested user is already assigned to another department
    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      const alreadyAssigned = await prisma.user.findMany({
        where: { id: { in: memberUserIds }, departmentId: { not: null } },
        select: { id: true, name: true, department: true }
      });
      if (alreadyAssigned.length > 0) {
        const names = alreadyAssigned.map(u => `"${u.name}" (${u.department || 'Assigned'})`).join(', ');
        return res.status(400).json({
          message: `Cannot assign user(s): ${names} - already belong to a department.`
        });
      }
    }

    const dept = await prisma.departmentMaster.create({ data: { name, code } });

    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: memberUserIds } },
        data: { departmentId: dept.id, department: dept.name }
      });
    }

    res.status(201).json(dept);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to create department.' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, status } = req.body;
    const dept = await prisma.departmentMaster.update({ where: { id }, data: { name, code, status } });
    res.json(dept);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update department.' });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await prisma.departmentMaster.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } }
    });

    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    if (dept._count.users > 0) {
      return res.status(400).json({
        message: 'This department contains members. Move or remove all members before deleting.'
      });
    }

    await prisma.departmentMaster.delete({ where: { id } });
    res.json({ message: 'Department deleted successfully.' });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to delete department.' });
  }
};

// Department Member Management
const getDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await prisma.departmentMaster.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true, name: true, email: true, employeeId: true, role: true, profilePic: true,
            position: { select: { id: true, name: true, color: true } }
          },
          orderBy: { name: 'asc' }
        }
      }
    });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    // Return ONLY unassigned users (departmentId === null) to prevent duplicate assignments
    const availableUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        departmentId: null
      },
      select: {
        id: true, name: true, email: true, employeeId: true, role: true, profilePic: true,
        position: { select: { id: true, name: true, color: true } }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      department: dept,
      members: dept.users,
      availableUsers
    });
  } catch (err) {
    console.error('Fetch department members error:', err);
    res.status(500).json({ message: 'Failed to fetch department members.' });
  }
};

const addDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'No user IDs provided to add.' });
    }

    const dept = await prisma.departmentMaster.findUnique({ where: { id } });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    // Backend Validation: Reject if any requested user is already assigned to ANOTHER department
    const alreadyAssigned = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        departmentId: { not: null, notIn: [id] }
      },
      select: { id: true, name: true, department: true }
    });

    if (alreadyAssigned.length > 0) {
      const names = alreadyAssigned.map(u => `"${u.name}" (${u.department || 'Assigned'})`).join(', ');
      return res.status(400).json({
        message: `Cannot assign user(s): ${names} - already belong to another department.`
      });
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { departmentId: id, department: dept.name }
    });

    const updatedUsers = await prisma.user.findMany({
      where: { departmentId: id },
      select: { id: true, name: true, email: true, employeeId: true, role: true, profilePic: true, position: { select: { name: true, color: true } } }
    });

    res.json({ message: `Successfully added ${userIds.length} member(s) to ${dept.name}.`, members: updatedUsers });
  } catch (err) {
    console.error('Add department members error:', err);
    res.status(500).json({ message: 'Failed to add department members.' });
  }
};

const removeDepartmentMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    await prisma.user.update({
      where: { id: userId },
      data: { departmentId: null, department: null }
    });

    res.json({ message: 'Member removed from department successfully.' });
  } catch (err) {
    console.error('Remove department member error:', err);
    res.status(500).json({ message: 'Failed to remove member from department.' });
  }
};

/* 
 * ============================================================================
 * ARCHIVED: SHIFTS & EMPLOYMENT TYPES MODULES
 * Preserved for future multi-branch / enterprise HRMS expansion.
 * ============================================================================
 * 
 * const getShifts = async (req, res) => { ... };
 * const createShift = async (req, res) => { ... };
 * const updateShift = async (req, res) => { ... };
 * const deleteShift = async (req, res) => { ... };
 * const getEmploymentTypes = async (req, res) => { ... };
 * const createEmploymentType = async (req, res) => { ... };
 * const updateEmploymentType = async (req, res) => { ... };
 * const deleteEmploymentType = async (req, res) => { ... };
 */

// Deprecated Module Placeholders
const getShifts = async (req, res) => res.json([]);
const createShift = async (req, res) => res.status(400).json({ message: 'Shifts & Types module has been deprecated for single-company setup.' });
const updateShift = async (req, res) => res.status(400).json({ message: 'Shifts & Types module has been deprecated for single-company setup.' });
const deleteShift = async (req, res) => res.status(400).json({ message: 'Shifts & Types module has been deprecated for single-company setup.' });

const getEmploymentTypes = async (req, res) => res.json([]);
const createEmploymentType = async (req, res) => res.status(400).json({ message: 'Shifts & Types module has been deprecated for single-company setup.' });
const updateEmploymentType = async (req, res) => res.status(400).json({ message: 'Shifts & Types module has been deprecated for single-company setup.' });
const deleteEmploymentType = async (req, res) => res.status(400).json({ message: 'Shifts & Types module has been deprecated for single-company setup.' });

// Deprecated Designation Placeholders for backward compatibility
const getDesignations = async (req, res) => res.json([]);
const createDesignation = async (req, res) => res.status(400).json({ message: 'Designations module has been deprecated. Use Departments.' });
const updateDesignation = async (req, res) => res.status(400).json({ message: 'Designations module has been deprecated. Use Departments.' });

module.exports = {
  getOrganizationTree,
  getBranches,
  createBranch,
  updateBranch,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
  addDepartmentMembers,
  removeDepartmentMember,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getEmploymentTypes,
  createEmploymentType,
  updateEmploymentType,
  deleteEmploymentType,
  getDesignations,
  createDesignation,
  updateDesignation
};
