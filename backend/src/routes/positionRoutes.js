const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getPositions,
  createPosition,
  updatePosition,
  togglePositionStatus,
  deletePosition,
  reorderPositions,
  getPositionHistory
} = require('../controllers/positionController');

// All authenticated users can view position list
router.get('/', authenticate, getPositions);
router.get('/history/:userId', authenticate, getPositionHistory);

// Super Admin Management Endpoints
router.post('/', authenticate, requireRole(['SUPER_ADMIN']), createPosition);
router.put('/reorder', authenticate, requireRole(['SUPER_ADMIN']), reorderPositions);
router.put('/:id', authenticate, requireRole(['SUPER_ADMIN']), updatePosition);
router.patch('/:id/status', authenticate, requireRole(['SUPER_ADMIN']), togglePositionStatus);
router.delete('/:id', authenticate, requireRole(['SUPER_ADMIN']), deletePosition);

module.exports = router;
