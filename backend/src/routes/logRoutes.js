const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/logController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getActivityLogs);

module.exports = router;
