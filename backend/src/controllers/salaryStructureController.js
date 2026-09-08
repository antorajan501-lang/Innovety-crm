const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { getEffectiveOrgId, assertOrganizationAccess } = require('../utils/organizationScope');

// 1. Get Salary Structure for User
const getSalaryStructure = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const userRole = req.user.role;

    // Permissions Check
    if (userRole === 'INTERN' || userRole === 'EMPLOYEE') {
      if (targetUserId !== req.user.id) {
        return res.status(403).json({ message: 'You are only allowed to view your own salary structure.' });
      }
    } else if (userRole === 'TEAM_LEADER') {
      if (targetUserId !== req.user.id) {
        return res.status(403).json({ message: 'Team Leaders can view their own structure or team status without amounts.' });
      }
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, organizationId: true }
    });
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      assertOrganizationAccess(targetUser, req);
    }

    const structure = await prisma.salaryStructure.findUnique({
      where: { userId: targetUserId },
      include: {
        template: true,
        user: { select: { id: true, name: true, email: true, employeeId: true, role: true, department: true, organizationId: true } }
      }
    });

    if (!structure) {
      return res.status(404).json({ message: 'Salary structure not found for this user.' });
    }

    res.json(structure);
  } catch (error) {
    if (error.statusCode === 403) return res.status(403).json({ message: error.message });
    console.error('Get salary structure error:', error);
    res.status(500).json({ message: 'Failed to retrieve salary structure.' });
  }
};

// 2. Get All Salary Structures / Employees (Admin & Super Admin)
const getAllSalaryStructures = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions to view salary structures.' });
    }

    const targetOrgId = getEffectiveOrgId(req);

    const whereClause = {
      status: 'ACTIVE',
      role: { in: ['ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'] }
    };

    if (targetOrgId) {
      whereClause.organizationId = targetOrgId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        role: true,
        department: true,
        profilePic: true,
        organizationId: true,
        salaryStructure: {
          include: { template: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get all salary structures error:', error);
    res.status(500).json({ message: 'Failed to retrieve salary structures list.' });
  }
};

// 3. Assign or Update Salary Structure (Admin & Super Admin)
const saveSalaryStructure = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can assign or modify salary structures.' });
    }

    const targetOrgId = getEffectiveOrgId(req);

    const {
      userId, templateId, basicSalary, hra, da,
      specialAllowance, travelAllowance, medicalAllowance, otherAllowances, bonus,
      pfDeduction, esiDeduction, profTax, incomeTax, otherDeductions,
      effectiveFrom, reason
    } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'Target user ID is required.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    assertOrganizationAccess(user, req);

    const userOrgId = user.organizationId || targetOrgId;

    const basic = Number(basicSalary) || 0;
    if (basic < 0) {
      return res.status(400).json({ message: 'Basic salary cannot be negative.' });
    }

    const h = Number(hra) || 0;
    const d = Number(da) || 0;
    const sa = Number(specialAllowance) || 0;
    const ta = Number(travelAllowance) || 0;
    const ma = Number(medicalAllowance) || 0;
    const oa = Number(otherAllowances) || 0;
    const b = Number(bonus) || 0;

    const gross = basic + h + d + sa + ta + ma + oa + b;

    const pf = pfDeduction !== undefined ? Number(pfDeduction) : (basic * 0.12);
    const esi = esiDeduction !== undefined ? Number(esiDeduction) : 0;
    const pt = profTax !== undefined ? Number(profTax) : 200;
    const tax = incomeTax !== undefined ? Number(incomeTax) : (gross * 0.05);
    const od = Number(otherDeductions) || 0;

    const totalDeduction = pf + esi + pt + tax + od;
    const net = Math.max(0, gross - totalDeduction);

    const existingStructure = await prisma.salaryStructure.findUnique({ where: { userId } });

    // Log revision entry
    if (existingStructure) {
      const changeAmount = net - existingStructure.netSalary;
      await prisma.salaryRevision.create({
        data: {
          organizationId: userOrgId,
          userId,
          previousSalary: existingStructure.netSalary,
          newSalary: net,
          revisionType: changeAmount > 0 ? 'INCREMENT' : changeAmount < 0 ? 'DECREMENT' : 'REGULAR',
          changeAmount,
          reason: reason || 'Salary Structure Revision',
          revisedById: req.user.id
        }
      });
    } else {
      await prisma.salaryRevision.create({
        data: {
          organizationId: userOrgId,
          userId,
          previousSalary: 0,
          newSalary: net,
          revisionType: 'INITIAL_ASSIGNMENT',
          changeAmount: net,
          reason: reason || 'Initial Salary Structure Assignment',
          revisedById: req.user.id
        }
      });
    }

    const structure = await prisma.salaryStructure.upsert({
      where: { userId },
      update: {
        organizationId: userOrgId,
        templateId: templateId || null,
        basicSalary: basic,
        hra: h,
        da: d,
        specialAllowance: sa,
        travelAllowance: ta,
        medicalAllowance: ma,
        otherAllowances: oa,
        bonus: b,
        pfDeduction: pf,
        esiDeduction: esi,
        profTax: pt,
        incomeTax: tax,
        otherDeductions: od,
        grossSalary: gross,
        netSalary: net,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date()
      },
      create: {
        organizationId: userOrgId,
        userId,
        templateId: templateId || null,
        basicSalary: basic,
        hra: h,
        da: d,
        specialAllowance: sa,
        travelAllowance: ta,
        medicalAllowance: ma,
        otherAllowances: oa,
        bonus: b,
        pfDeduction: pf,
        esiDeduction: esi,
        profTax: pt,
        incomeTax: tax,
        otherDeductions: od,
        grossSalary: gross,
        netSalary: net,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date()
      }
    });

    await logActivity({
      userId: req.user.id,
      organizationId: userOrgId,
      action: 'SALARY_STRUCTURE_SAVE',
      details: `Saved salary structure for ${user.name} (Net: ₹${net})`
    });

    res.json(structure);
  } catch (error) {
    if (error.statusCode === 403) return res.status(403).json({ message: error.message });
    console.error('Save salary structure error:', error);
    res.status(500).json({ message: 'Failed to save salary structure.' });
  }
};

// 4. Get Salary Revisions (Audit History)
const getSalaryRevisions = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const userRole = req.user.role;

    if (['INTERN', 'EMPLOYEE'].includes(userRole) && targetUserId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, organizationId: true }
    });
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      assertOrganizationAccess(targetUser, req);
    }

    const revisions = await prisma.salaryRevision.findMany({
      where: { userId: targetUserId },
      include: {
        user: { select: { id: true, name: true, role: true, employeeId: true, organizationId: true } },
        revisedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(revisions);
  } catch (error) {
    if (error.statusCode === 403) return res.status(403).json({ message: error.message });
    console.error('Get salary revisions error:', error);
    res.status(500).json({ message: 'Failed to retrieve salary revision history.' });
  }
};

// 5. Bulk Assign Salary Structures (Admin & Super Admin)
const bulkAssignSalaryStructures = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can bulk assign salary structures.' });
    }

    const targetOrgId = getEffectiveOrgId(req);

    const {
      userIds, templateId, basicSalary, hra, da,
      specialAllowance, travelAllowance, medicalAllowance, otherAllowances, bonus,
      pfDeduction, esiDeduction, profTax, incomeTax, otherDeductions,
      effectiveFrom, reason
    } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'At least one target employee must be selected.' });
    }

    const basic = Number(basicSalary) || 0;
    const h = Number(hra) || 0;
    const d = Number(da) || 0;
    const sa = Number(specialAllowance) || 0;
    const ta = Number(travelAllowance) || 0;
    const ma = Number(medicalAllowance) || 0;
    const oa = Number(otherAllowances) || 0;
    const b = Number(bonus) || 0;

    const gross = basic + h + d + sa + ta + ma + oa + b;

    const pf = pfDeduction !== undefined ? Number(pfDeduction) : (basic * 0.12);
    const esi = esiDeduction !== undefined ? Number(esiDeduction) : 0;
    const pt = profTax !== undefined ? Number(profTax) : 200;
    const tax = incomeTax !== undefined ? Number(incomeTax) : (gross * 0.05);
    const od = Number(otherDeductions) || 0;

    const totalDeduction = pf + esi + pt + tax + od;
    const net = Math.max(0, gross - totalDeduction);

    const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    const results = [];

    for (const userId of userIds) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;

      if (targetOrgId && user.organizationId && user.organizationId !== targetOrgId) {
        continue; // Skip users outside target organization scope
      }

      const userOrgId = user.organizationId || targetOrgId;
      const existingStructure = await prisma.salaryStructure.findUnique({ where: { userId } });

      if (existingStructure) {
        const changeAmount = net - existingStructure.netSalary;
        await prisma.salaryRevision.create({
          data: {
            organizationId: userOrgId,
            userId,
            previousSalary: existingStructure.netSalary,
            newSalary: net,
            revisionType: changeAmount > 0 ? 'INCREMENT' : changeAmount < 0 ? 'DECREMENT' : 'REGULAR',
            changeAmount,
            reason: reason || 'Bulk Salary Structure Revision',
            effectiveDate,
            revisedById: req.user.id
          }
        });
      } else {
        await prisma.salaryRevision.create({
          data: {
            organizationId: userOrgId,
            userId,
            previousSalary: 0,
            newSalary: net,
            revisionType: 'INITIAL_ASSIGNMENT',
            changeAmount: net,
            reason: reason || 'Initial Bulk Structure Assignment',
            effectiveDate,
            revisedById: req.user.id
          }
        });
      }

      const struct = await prisma.salaryStructure.upsert({
        where: { userId },
        update: {
          organizationId: userOrgId,
          templateId: templateId || null,
          basicSalary: basic,
          hra: h,
          da: d,
          specialAllowance: sa,
          travelAllowance: ta,
          medicalAllowance: ma,
          otherAllowances: oa,
          bonus: b,
          pfDeduction: pf,
          esiDeduction: esi,
          profTax: pt,
          incomeTax: tax,
          otherDeductions: od,
          grossSalary: gross,
          netSalary: net,
          effectiveFrom: effectiveDate
        },
        create: {
          organizationId: userOrgId,
          userId,
          templateId: templateId || null,
          basicSalary: basic,
          hra: h,
          da: d,
          specialAllowance: sa,
          travelAllowance: ta,
          medicalAllowance: ma,
          otherAllowances: oa,
          bonus: b,
          pfDeduction: pf,
          esiDeduction: esi,
          profTax: pt,
          incomeTax: tax,
          otherDeductions: od,
          grossSalary: gross,
          netSalary: net,
          effectiveFrom: effectiveDate
        }
      });

      // Create notification for employee
      await prisma.notification.create({
        data: {
          userId,
          title: 'Salary Structure Assigned',
          message: `Your salary structure has been assigned/updated by the Administrator. Net Pay: ₹${net.toLocaleString('en-IN')}`,
          type: 'SYSTEM'
        }
      }).catch(err => console.error('Notification log error:', err));

      results.push(struct);
    }

    await logActivity({
      userId: req.user.id,
      organizationId: targetOrgId,
      action: 'BULK_SALARY_STRUCTURE_SAVE',
      details: `Assigned salary structure to ${results.length} employees (Net Pay: ₹${net})`
    });

    res.json({ message: `Successfully assigned structure to ${results.length} employees.`, count: results.length });
  } catch (error) {
    if (error.statusCode === 403) return res.status(403).json({ message: error.message });
    console.error('Bulk save salary structure error:', error);
    res.status(500).json({ message: 'Failed to bulk assign salary structures.' });
  }
};

module.exports = {
  getSalaryStructure,
  getAllSalaryStructures,
  saveSalaryStructure,
  getSalaryRevisions,
  bulkAssignSalaryStructures
};
