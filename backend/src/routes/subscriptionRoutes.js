const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireOrganizationActive } = require('../middleware/auth');
const {
  getAllSubscriptionPlans,
  updateOrganizationSubscriptionPlan,
  getOrganizationAuditLogs
} = require('../controllers/subscriptionController');

// All subscription management requires SUPER_ADMIN
router.use(authenticate);
router.use(requireOrganizationActive);

// GET /api/subscriptions/plans
router.get('/plans', requireRole(['SUPER_ADMIN']), getAllSubscriptionPlans);

// PUT /api/organizations/:id/subscription
router.put('/organizations/:id/subscription', requireRole(['SUPER_ADMIN']), updateOrganizationSubscriptionPlan);

// GET /api/organizations/:id/audit-logs
router.get('/organizations/:id/audit-logs', requireRole(['SUPER_ADMIN']), getOrganizationAuditLogs);

module.exports = router;
