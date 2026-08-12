const express = require('express');
const router = express.Router();
const {
  getGlobalLeavePolicy,
  updateGlobalLeavePolicy,
  createLeaveType,
  updateLeaveType,
  toggleLeaveTypeStatus,
  deleteLeaveType,
  getUserLeaveBalances,
  adjustUserLeaveBalance,
  executeAnnualReset
} = require('../controllers/leavePolicyController');
const { authenticate, requireRole } = require('../middleware/auth');

// User Leave Balance query (Accessible to authenticated users)
router.get('/balances/:userId?', authenticate, getUserLeaveBalances);

// Super Admin ONLY Policy Management Routes
router.use(authenticate, requireRole(['SUPER_ADMIN']));

router.get('/', getGlobalLeavePolicy);

router.put('/', updateGlobalLeavePolicy);
router.post('/types', createLeaveType);
router.put('/types/:id', updateLeaveType);
router.put('/types/:id/status', toggleLeaveTypeStatus);
router.delete('/types/:id', deleteLeaveType);
router.post('/adjust-balance', adjustUserLeaveBalance);
router.post('/annual-reset', executeAnnualReset);

module.exports = router;
