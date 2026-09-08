const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { addDepartmentToCompany, filterDepartmentsForCompany, getCompanyDepartmentIds } = require('../utils/companyDepartmentStore');

/**
 * GET /api/organization/tree
 * Centralized Enterprise Organization Tree for dynamic dropdowns and smart reporting manager filtering
 */
const getOrganizationTree = async (req, res) => {
  try {
    const { targetRole, branchId, departmentId } = req.query;
    const organizationId = req.query.organizationId || req.user?.organizationId;

    const positionWhere = { status: 'ACTIVE', ...(organizationId ? { organizationId } : {}) };

    const [branches, departments, designations, positions, shifts, employmentTypes, unassignedUsers] = await Promise.all([
      prisma.orgBranch.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.departmentMaster.findMany({
        where: {
          status: 'ACTIVE',
          NOT: [
            { name: 'Unassigned' },
            { code: 'DEP-UNASSIGNED' }
          ]
        },
        orderBy: { name: 'asc' },
        include: {
          users: { select: { id: true, name: true, email: true, employeeId: true, role: true, profilePic: true, position: { select: { name: true, color: true } } } },
          _count: { select: { users: true } }
        }
      }),
      prisma.designationMaster.findMany({ where: { status: 'ACTIVE' }, include: { department: true, _count: { select: { users: true } } }, orderBy: { name: 'asc' } }),
      prisma.position.findMany({ where: positionWhere, orderBy: { level: 'asc' } }),
      prisma.shiftMaster.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.employmentTypeMaster.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { departmentId: null },
            { department: 'Unassigned' },
            { departmentRef: { code: 'DEP-UNASSIGNED' } },
            { departmentRef: { name: 'Unassigned' } }
          ]
        },
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
    const { organizationId } = req.query;
    const whereUsers = organizationId ? { organizationId } : {};

    const depts = await prisma.departmentMaster.findMany({
      where: {
        NOT: [
          { name: 'Unassigned' },
          { code: 'DEP-UNASSIGNED' }
        ]
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: {
              where: whereUsers
            }
          }
        }
      }
    });

    const companyDepts = filterDepartmentsForCompany(depts, organizationId);
    res.json(companyDepts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch departments.' });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, code, description, status, organizationId, memberUserIds } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Name and Code are required.' });

    const cleanName = String(name).trim();
    const cleanCode = String(code).trim().toUpperCase();

    // Per-company uniqueness check
    const existingDepts = await prisma.departmentMaster.findMany({
      where: {
        OR: [
          { name: { equals: cleanName, mode: 'insensitive' } },
          { code: { equals: cleanCode, mode: 'insensitive' } }
        ]
      }
    });

    if (organizationId) {
      const companyDeptIds = getCompanyDepartmentIds(organizationId) || [];
      const duplicateName = existingDepts.find(
        (d) => d.name.toLowerCase() === cleanName.toLowerCase() && companyDeptIds.includes(d.id)
      );
      if (duplicateName) {
        return res.status(400).json({ message: `Department name "${cleanName}" already exists for this company.` });
      }

      const duplicateCode = existingDepts.find(
        (d) => d.code.toUpperCase() === cleanCode.toUpperCase() && companyDeptIds.includes(d.id)
      );
      if (duplicateCode) {
        return res.status(400).json({ message: `Department code "${cleanCode}" already exists for this company.` });
      }
    }

    // Backend Validation: Only reject if user is assigned to an existing active valid department
    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      const usersCheck = await prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, name: true, departmentId: true, department: true, departmentRef: { select: { id: true, name: true, code: true } } }
      });
      const alreadyAssigned = usersCheck.filter(u => {
        if (!u.departmentId) return false;
        if (!u.departmentRef) return false;
        if (u.departmentRef.name === 'Unassigned' || u.departmentRef.code === 'DEP-UNASSIGNED' || u.department === 'Unassigned') return false;
        return true;
      });
      if (alreadyAssigned.length > 0) {
        const names = alreadyAssigned.map(u => `"${u.name}" (${u.departmentRef?.name || u.department || 'Assigned'})`).join(', ');
        return res.status(400).json({
          message: `Cannot assign user(s): ${names} - already belong to a department.`
        });
      }
    }

    let uniqueCode = cleanCode;
    let uniqueName = cleanName;
    const globalCodeMatch = existingDepts.find(d => d.code.toUpperCase() === cleanCode);
    const globalNameMatch = existingDepts.find(d => d.name.toLowerCase() === cleanName.toLowerCase());

    if (globalCodeMatch && organizationId) {
      uniqueCode = `${cleanCode}-${organizationId.slice(-4).toUpperCase()}`;
    }
    if (globalNameMatch && organizationId) {
      uniqueName = `${cleanName} (${organizationId.slice(-4).toUpperCase()})`;
    }

    const dept = await prisma.departmentMaster.create({
      data: {
        name: globalNameMatch ? uniqueName : cleanName,
        code: globalCodeMatch ? uniqueCode : cleanCode,
        description: description || null,
        status: status || 'ACTIVE'
      }
    });

    if (organizationId) {
      addDepartmentToCompany(organizationId, dept.id);
    }

    if (Array.isArray(memberUserIds) && memberUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: memberUserIds } },
        data: { departmentId: dept.id, department: dept.name }
      });
    }

    res.status(201).json({
      ...dept,
      displayName: cleanName,
      displayCode: cleanCode
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (Array.isArray(target) && target.includes('name')) {
        return res.status(400).json({ message: 'Department name already exists for this company.' });
      }
      if (typeof target === 'string' && target.includes('name')) {
        return res.status(400).json({ message: 'Department name already exists for this company.' });
      }
      if (Array.isArray(target) && target.includes('code')) {
        return res.status(400).json({ message: 'Department code already exists for this company.' });
      }
      return res.status(400).json({ message: 'Department name already exists for this company.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Unable to create department. Please try again.' });
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

    // 1. Move all members of this department to NULL (Unassigned)
    if (dept._count.users > 0) {
      await prisma.user.updateMany({
        where: { departmentId: id },
        data: {
          departmentId: null,
          department: null
        }
      });
    }

    // 2. Delete the department from DepartmentMaster
    await prisma.departmentMaster.delete({ where: { id } });

    res.json({ message: 'Department deleted successfully.' });
  } catch (err) {
    console.error('Delete department error:', err);
    res.status(500).json({ message: 'Failed to delete department. Please try again.' });
  }
};

// Department Member Management
const getDepartmentMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.query;

    const userOrgWhere = organizationId ? { organizationId } : {};

    const dept = await prisma.departmentMaster.findUnique({
      where: { id },
      include: {
        users: {
          where: userOrgWhere,
          select: {
            id: true, name: true, email: true, employeeId: true, role: true, profilePic: true,
            position: { select: { id: true, name: true, color: true } }
          },
          orderBy: { name: 'asc' }
        }
      }
    });
    if (!dept) return res.status(404).json({ message: 'Department not found.' });

    // Return unassigned users scoped to company (if specified)
    const availableUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(organizationId ? { organizationId } : {}),
        OR: [
          { departmentId: null },
          { department: null },
          { department: 'Unassigned' },
          { departmentRef: { is: null } },
          { departmentRef: { name: 'Unassigned' } },
          { departmentRef: { code: 'DEP-UNASSIGNED' } }
        ]
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

    // Backend Validation: Reject if requested user belongs to ANOTHER valid department
    const usersCheck = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, departmentId: true, department: true, departmentRef: { select: { id: true, name: true, code: true } } }
    });

    const alreadyAssigned = usersCheck.filter(u => {
      if (!u.departmentId || u.departmentId === id) return false;
      if (!u.departmentRef) return false;
      if (u.departmentRef.name === 'Unassigned' || u.departmentRef.code === 'DEP-UNASSIGNED' || u.department === 'Unassigned') return false;
      return true;
    });

    if (alreadyAssigned.length > 0) {
      const names = alreadyAssigned.map(u => `"${u.name}" (${u.departmentRef?.name || u.department || 'Assigned'})`).join(', ');
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
