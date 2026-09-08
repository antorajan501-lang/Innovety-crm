const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { getEffectiveOrgId } = require('../utils/organizationScope');

// 1. Get Company-Scoped Payroll Settings
const getPayrollSettings = async (req, res) => {
  try {
    const targetOrgId = getEffectiveOrgId(req);

    let settings = null;
    if (targetOrgId) {
      settings = await prisma.payrollSettings.findFirst({
        where: { organizationId: targetOrgId }
      });
    }

    if (!settings) {
      const org = targetOrgId ? await prisma.organization.findUnique({ where: { id: targetOrgId } }) : null;
      const defaultName = org?.name || 'Company Workspace';

      if (targetOrgId) {
        settings = await prisma.payrollSettings.create({
          data: {
            organizationId: targetOrgId,
            companyName: defaultName,
            cycleStartDay: 1,
            payDay: 30,
            currency: 'INR',
            overtimeHourlyRate: 150.0,
            holidayPayMultiplier: 2.0,
            weekendPayMultiplier: 1.5,
            lateDeductionRule: 'FLAT_RATE',
            lateDeductionRate: 100.0,
            halfDayDeductionRate: 0.5,
            minimumWorkingHours: 8.0,
            roundingRule: 'ROUND_HALF_UP',
            payslipTemplate: 'STANDARD',
            companyAddress: org?.address || 'Corporate Headquarters',
            authorizedSignature: 'Authorized HR Signatory'
          }
        });
      } else {
        // SUPER_ADMIN without targeted org: return default unassigned object (never borrow another company's DB record)
        settings = {
          companyName: 'All Organizations',
          cycleStartDay: 1,
          payDay: 30,
          currency: 'INR',
          overtimeHourlyRate: 150.0,
          holidayPayMultiplier: 2.0,
          weekendPayMultiplier: 1.5,
          lateDeductionRule: 'FLAT_RATE',
          lateDeductionRate: 100.0,
          halfDayDeductionRate: 0.5,
          minimumWorkingHours: 8.0,
          roundingRule: 'ROUND_HALF_UP',
          payslipTemplate: 'STANDARD',
          companyAddress: 'Corporate Headquarters',
          authorizedSignature: 'Authorized HR Signatory'
        };
      }
    }

    res.json(settings);
  } catch (error) {
    console.error('Get payroll settings error:', error);
    res.status(500).json({ message: 'Failed to retrieve payroll settings.' });
  }
};

// 2. Update Company-Scoped Payroll Settings (Admin Only)
const updatePayrollSettings = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can modify payroll settings.' });
    }

    const targetOrgId = getEffectiveOrgId(req);
    if (!targetOrgId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Organization context required.' });
    }

    const {
      cycleStartDay, payDay, currency, overtimeHourlyRate,
      holidayPayMultiplier, weekendPayMultiplier, lateDeductionRule, lateDeductionRate,
      halfDayDeductionRate, minimumWorkingHours, roundingRule, payslipTemplate,
      companyName, companyLogo, companyAddress, authorizedSignature
    } = req.body;

    const dataPayload = {
      cycleStartDay: cycleStartDay !== undefined ? Number(cycleStartDay) : 1,
      payDay: payDay !== undefined ? Number(payDay) : 30,
      currency: currency || 'INR',
      overtimeHourlyRate: overtimeHourlyRate !== undefined ? Number(overtimeHourlyRate) : 150.0,
      holidayPayMultiplier: holidayPayMultiplier !== undefined ? Number(holidayPayMultiplier) : 2.0,
      weekendPayMultiplier: weekendPayMultiplier !== undefined ? Number(weekendPayMultiplier) : 1.5,
      lateDeductionRule: lateDeductionRule || 'FLAT_RATE',
      lateDeductionRate: lateDeductionRate !== undefined ? Number(lateDeductionRate) : 100.0,
      halfDayDeductionRate: halfDayDeductionRate !== undefined ? Number(halfDayDeductionRate) : 0.5,
      minimumWorkingHours: minimumWorkingHours !== undefined ? Number(minimumWorkingHours) : 8.0,
      roundingRule: roundingRule || 'ROUND_HALF_UP',
      payslipTemplate: payslipTemplate || 'STANDARD',
      companyName: companyName || 'Company Workspace',
      companyLogo: companyLogo || null,
      companyAddress: companyAddress || 'Corporate Headquarters',
      authorizedSignature: authorizedSignature || 'Authorized HR Signatory'
    };

    let settings = null;
    if (targetOrgId) {
      const existing = await prisma.payrollSettings.findFirst({
        where: { organizationId: targetOrgId }
      });

      if (existing) {
        settings = await prisma.payrollSettings.update({
          where: { id: existing.id },
          data: dataPayload
        });
      } else {
        settings = await prisma.payrollSettings.create({
          data: {
            organizationId: targetOrgId,
            ...dataPayload
          }
        });
      }
    } else {
      return res.status(400).json({ message: 'Select an organization to update payroll settings.' });
    }

    await logActivity({
      userId: req.user.id,
      organizationId: targetOrgId,
      action: 'PAYROLL_SETTINGS_UPDATE',
      details: `Updated payroll settings configuration for organization: ${targetOrgId}`
    });

    res.json(settings);
  } catch (error) {
    console.error('Update payroll settings error:', error);
    res.status(500).json({ message: 'Failed to update payroll settings.' });
  }
};

module.exports = {
  getPayrollSettings,
  updatePayrollSettings
};
