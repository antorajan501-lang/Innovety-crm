const express = require('express');
const router = express.Router();
const { getLeaves, applyLeave, updateLeaveStatus } = require('../controllers/leaveController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getLeaves);
router.post('/', authenticate, applyLeave);
router.put('/:id/status', authenticate, updateLeaveStatus);

module.exports = router;
