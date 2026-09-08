const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { getEffectiveOrgId } = require('../utils/organizationScope');

// 1. Get all Salary Templates (Scoped strictly to Organization)
const getTemplates = async (req, res) => {
  try {
    const targetOrgId = getEffectiveOrgId(req);

    const where = {};
    if (targetOrgId) {
      where.organizationId = targetOrgId;
    }

    const templates = await prisma.salaryTemplate.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            structures: targetOrgId ? { where: { user: { organizationId: targetOrgId } } } : true
          }
        }
      }
    });
    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ message: 'Failed to retrieve salary templates.' });
  }
};

// 2. Create Salary Template (Admin & Super Admin Only)
const createTemplate = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can create salary templates.' });
    }

    const targetOrgId = getEffectiveOrgId(req);

    const {
      name, description, targetRole, basicSalary, hra, da,
      specialAllowance, travelAllowance, medicalAllowance, otherAllowances, bonus,
      pfRatePercent, esiRatePercent, profTax, incomeTaxPercent, otherDeductions, isDefault
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Template name is required.' });
    }

    const existing = await prisma.salaryTemplate.findFirst({
      where: {
        name,
        organizationId: targetOrgId
      }
    });
    if (existing) {
      return res.status(400).json({ message: `Template with name "${name}" already exists for this company.` });
    }

    if (isDefault) {
      const defaultWhere = { targetRole: targetRole || 'EMPLOYEE' };
      if (targetOrgId) defaultWhere.organizationId = targetOrgId;
      await prisma.salaryTemplate.updateMany({
        where: defaultWhere,
        data: { isDefault: false }
      });
    }

    const template = await prisma.salaryTemplate.create({
      data: {
        organizationId: targetOrgId || null,
        name,
        description,
        targetRole: targetRole || 'EMPLOYEE',
        basicSalary: Number(basicSalary) || 0,
        hra: Number(hra) || 0,
        da: Number(da) || 0,
        specialAllowance: Number(specialAllowance) || 0,
        travelAllowance: Number(travelAllowance) || 0,
        medicalAllowance: Number(medicalAllowance) || 0,
        otherAllowances: Number(otherAllowances) || 0,
        bonus: Number(bonus) || 0,
        pfRatePercent: Number(pfRatePercent) || 0,
        esiRatePercent: Number(esiRatePercent) || 0,
        profTax: Number(profTax) || 0,
        incomeTaxPercent: Number(incomeTaxPercent) || 0,
        otherDeductions: Number(otherDeductions) || 0,
        isDefault: Boolean(isDefault)
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SALARY_TEMPLATE_CREATE',
      details: `Created salary template "${name}"`
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ message: 'Failed to create salary template.' });
  }
};

// 3. Update Salary Template (Admin & Super Admin Only)
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can edit salary templates.' });
    }

    const targetOrgId = getEffectiveOrgId(req);

    const template = await prisma.salaryTemplate.findUnique({ where: { id } });
    if (!template) {
      return res.status(404).json({ message: 'Salary template not found.' });
    }

    if (targetOrgId && template.organizationId && template.organizationId !== targetOrgId) {
      return res.status(403).json({ message: 'Unauthorized: Template does not belong to the selected company scope.' });
    }

    const updated = await prisma.salaryTemplate.update({
      where: { id },
      data: {
        name: req.body.name || template.name,
        description: req.body.description !== undefined ? req.body.description : template.description,
        targetRole: req.body.targetRole || template.targetRole,
        basicSalary: req.body.basicSalary !== undefined ? Number(req.body.basicSalary) : template.basicSalary,
        hra: req.body.hra !== undefined ? Number(req.body.hra) : template.hra,
        da: req.body.da !== undefined ? Number(req.body.da) : template.da,
        specialAllowance: req.body.specialAllowance !== undefined ? Number(req.body.specialAllowance) : template.specialAllowance,
        travelAllowance: req.body.travelAllowance !== undefined ? Number(req.body.travelAllowance) : template.travelAllowance,
        medicalAllowance: req.body.medicalAllowance !== undefined ? Number(req.body.medicalAllowance) : template.medicalAllowance,
        otherAllowances: req.body.otherAllowances !== undefined ? Number(req.body.otherAllowances) : template.otherAllowances,
        bonus: req.body.bonus !== undefined ? Number(req.body.bonus) : template.bonus,
        pfRatePercent: req.body.pfRatePercent !== undefined ? Number(req.body.pfRatePercent) : template.pfRatePercent,
        esiRatePercent: req.body.esiRatePercent !== undefined ? Number(req.body.esiRatePercent) : template.esiRatePercent,
        profTax: req.body.profTax !== undefined ? Number(req.body.profTax) : template.profTax,
        incomeTaxPercent: req.body.incomeTaxPercent !== undefined ? Number(req.body.incomeTaxPercent) : template.incomeTaxPercent,
        otherDeductions: req.body.otherDeductions !== undefined ? Number(req.body.otherDeductions) : template.otherDeductions
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SALARY_TEMPLATE_UPDATE',
      details: `Updated salary template "${updated.name}"`
    });

    res.json(updated);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ message: 'Failed to update salary template.' });
  }
};

// 4. Delete Salary Template (Admin & Super Admin Only)
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can delete salary templates.' });
    }

    const targetOrgId = getEffectiveOrgId(req);

    const template = await prisma.salaryTemplate.findUnique({ where: { id } });
    if (!template) {
      return res.status(404).json({ message: 'Salary template not found.' });
    }

    if (targetOrgId && template.organizationId && template.organizationId !== targetOrgId) {
      return res.status(403).json({ message: 'Unauthorized: Template does not belong to the selected company scope.' });
    }

    await prisma.salaryTemplate.delete({ where: { id } });
    res.json({ success: true, message: 'Salary template deleted successfully.' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ message: 'Failed to delete salary template.' });
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
