const express = require('express');
const router = express.Router();
const { createAnnouncement, getAnnouncements } = require('../controllers/announcementController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.post('/', requireRole(['ADMIN', 'TEAM_LEADER']), createAnnouncement);
router.get('/', getAnnouncements);

module.exports = router;
