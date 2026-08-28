const express = require('express');
const router = express.Router();
const {
  getLeaves,
  getLeaveBalances,
  applyLeave,
  updateLeave,
  approveLeaveTL,
  approveLeaveAdmin,
  rejectLeave,
  cancelLeave
} = require('../controllers/leaveController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getLeaves);
router.get('/balances', authenticate, getLeaveBalances);
router.post('/', authenticate, applyLeave);
router.put('/:id', authenticate, updateLeave);
router.put('/:id/tl-approve', authenticate, approveLeaveTL);
router.put('/:id/admin-approve', authenticate, approveLeaveAdmin);
router.put('/:id/reject', authenticate, rejectLeave);
router.put('/:id/cancel', authenticate, cancelLeave);

// Legacy fallback router
router.put('/:id/status', authenticate, (req, res, next) => {
  if (req.body.status === 'APPROVED') return approveLeaveAdmin(req, res, next);
  if (req.body.status === 'REJECTED') return rejectLeave(req, res, next);
  res.status(400).json({ message: 'Invalid status parameter.' });
});

module.exports = router;
