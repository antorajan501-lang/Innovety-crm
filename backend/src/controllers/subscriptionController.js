const prisma = require('../utils/db');
const { logOrganizationAction } = require('../services/organizationAuditService');

/**
 * GET /api/subscriptions/plans
 * List all available subscription plans
 */
const getAllSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { maxUsers: 'asc' }
    });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/organizations/:id/subscription
 * Change organization subscription plan
 */
const updateOrganizationSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { planCode } = req.body;

    if (!planCode) {
      return res.status(400).json({ success: false, message: 'planCode is required.' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { subscriptionPlan: true }
    });

    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: planCode.toUpperCase() }
    });

    if (!newPlan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found.' });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id },
      data: { subscriptionPlanId: newPlan.id },
      include: { subscriptionPlan: true }
    });

    await logOrganizationAction(
      id,
      req.user?.id,
      req.user?.email,
      'PLAN_CHANGED',
      {
        previousPlan: organization.subscriptionPlan?.name || 'Starter',
        newPlan: newPlan.name,
        planCode: newPlan.code
      }
    );

    res.json({
      success: true,
      message: `Organization subscription plan updated to ${newPlan.name}.`,
      data: updatedOrg
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organizations/:id/audit-logs
 * Fetch tenant activity audit history
 */
const getOrganizationAuditLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { search } = req.query;

    const whereClause = { organizationId: id };
    if (search && search.trim()) {
      whereClause.OR = [
        { action: { contains: search.trim(), mode: 'insensitive' } },
        { actorEmail: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const logs = await prisma.organizationAuditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSubscriptionPlans,
  updateOrganizationSubscriptionPlan,
  getOrganizationAuditLogs
};
