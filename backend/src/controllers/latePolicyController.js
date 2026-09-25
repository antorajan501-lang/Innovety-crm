const prisma = require('../utils/db');
const { getEffectiveOrgId } = require('../utils/organizationScope');
const { getEffectiveSettings } = require('../utils/settingsResolver');
const { broadcastAttendanceEvent } = require('../socket');
const { logActivity } = require('../utils/activityLogger');

/**
 * GET /api/late-policy
 * Retrieve current dynamic late policy settings for the effective organization.
 */
const getLatePolicy = async (req, res) => {
  try {
    const targetOrgId = getEffectiveOrgId(req);
    const settings = await getEffectiveSettings(targetOrgId);

    // Convert latePolicyAppliesTo string to array for frontend convenience
    const appliesToArray = (settings.latePolicyAppliesTo || 'INTERN,EMPLOYEE,TEAM_LEADER')
      .split(',')
      .map(r => r.trim())
      .filter(Boolean);

    res.json({
      success: true,
      data: {
        latePolicyEnabled: settings.latePolicyEnabled !== undefined ? settings.latePolicyEnabled : true,
        warningLateLimit: settings.warningLateLimit !== undefined ? Number(settings.warningLateLimit) : 3,
        deductionPerLate: settings.deductionPerLate || '1_DAY_SALARY',
        latePolicyAppliesTo: appliesToArray,
        monthlyReset: true
      }
    });
  } catch (error) {
    console.error('[LatePolicy] Error fetching policy:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve late policy settings.' });
  }
};

/**
 * PUT /api/late-policy
 * Update dynamic late policy settings (Super Admin / Admin).
 */
const updateLatePolicy = async (req, res) => {
  try {
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only administrators can configure the late policy.' });
    }

    const targetOrgId = getEffectiveOrgId(req);
    const {
      latePolicyEnabled,
      warningLateLimit,
      deductionPerLate,
      latePolicyAppliesTo
    } = req.body;

    const appliesToStr = Array.isArray(latePolicyAppliesTo)
      ? latePolicyAppliesTo.join(',')
      : (latePolicyAppliesTo || 'INTERN,EMPLOYEE,TEAM_LEADER');

    const warningLimitNum = warningLateLimit !== undefined ? Math.max(1, parseInt(warningLateLimit, 10)) : 3;
    const isEnabled = latePolicyEnabled !== undefined ? Boolean(latePolicyEnabled) : true;
    const deductionRule = deductionPerLate || '1_DAY_SALARY';

    // 1. Update or create in SystemSettings
    let systemSettings = null;
    if (targetOrgId) {
      systemSettings = await prisma.systemSettings.findFirst({
        where: { organizationId: targetOrgId }
      });

      if (systemSettings) {
        systemSettings = await prisma.systemSettings.update({
          where: { id: systemSettings.id },
          data: {
            latePolicyEnabled: isEnabled,
            warningLateLimit: warningLimitNum,
            deductionPerLate: deductionRule,
            latePolicyAppliesTo: appliesToStr
          }
        });
      } else {
        systemSettings = await prisma.systemSettings.create({
          data: {
            organizationId: targetOrgId,
            latePolicyEnabled: isEnabled,
            warningLateLimit: warningLimitNum,
            deductionPerLate: deductionRule,
            latePolicyAppliesTo: appliesToStr
          }
        });
      }
    } else {
      // Global fallback / update
      const existingGlobal = await prisma.systemSettings.findFirst({
        where: { id: 'GLOBAL' }
      });
      if (existingGlobal) {
        systemSettings = await prisma.systemSettings.update({
          where: { id: 'GLOBAL' },
          data: {
            latePolicyEnabled: isEnabled,
            warningLateLimit: warningLimitNum,
            deductionPerLate: deductionRule,
            latePolicyAppliesTo: appliesToStr
          }
        });
      } else {
        systemSettings = await prisma.systemSettings.create({
          data: {
            id: 'GLOBAL',
            companyName: 'INNOVEITY',
            latePolicyEnabled: isEnabled,
            warningLateLimit: warningLimitNum,
            deductionPerLate: deductionRule,
            latePolicyAppliesTo: appliesToStr
          }
        });
      }
    }

    // 2. Also sync with PayrollSettings if it exists for consistency
    if (targetOrgId) {
      const payrollSettings = await prisma.payrollSettings.findFirst({
        where: { organizationId: targetOrgId }
      });
      if (payrollSettings) {
        await prisma.payrollSettings.update({
          where: { id: payrollSettings.id },
          data: {
            latePolicyEnabled: isEnabled,
            warningLateLimit: warningLimitNum,
            deductionPerLate: deductionRule,
            latePolicyAppliesTo: appliesToStr
          }
        });
      }
    }

    // 3. Log Activity
    await logActivity({
      userId: req.user.id,
      action: 'UPDATE_LATE_POLICY',
      details: `Updated Late Policy: enabled=${isEnabled}, limit=${warningLimitNum}, deduction=${deductionRule}, appliesTo=${appliesToStr}`
    });

    // 4. Notify connected users via socket
    try {
      broadcastAttendanceEvent('settings_updated', {
        type: 'LATE_POLICY_UPDATED',
        organizationId: targetOrgId,
        settings: {
          latePolicyEnabled: isEnabled,
          warningLateLimit: warningLimitNum,
          deductionPerLate: deductionRule,
          latePolicyAppliesTo: appliesToStr
        }
      });
    } catch (sockErr) {
      console.warn('[LatePolicy] Socket broadcast failed:', sockErr.message);
    }

    res.json({
      success: true,
      message: 'Late policy updated successfully.',
      data: {
        latePolicyEnabled: isEnabled,
        warningLateLimit: warningLimitNum,
        deductionPerLate: deductionRule,
        latePolicyAppliesTo: appliesToStr.split(',').map(s => s.trim()),
        monthlyReset: true
      }
    });
  } catch (error) {
    console.error('[LatePolicy] Error updating policy:', error);
    res.status(500).json({ success: false, message: 'Failed to update late policy settings.' });
  }
};

module.exports = {
  getLatePolicy,
  updateLatePolicy
};
