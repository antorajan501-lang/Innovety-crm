const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getCalendar,
  createOverride,
  updateOverride,
  deleteOverride
} = require('../controllers/workCalendarController');

// All authenticated roles can view the calendar
router.get('/', authenticate, getCalendar);

// ADMIN and SUPER_ADMIN can create, update, or delete calendar overrides
router.post('/', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN']), createOverride);
router.put('/:id', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN']), updateOverride);
router.delete('/:id', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN']), deleteOverride);

module.exports = router;
