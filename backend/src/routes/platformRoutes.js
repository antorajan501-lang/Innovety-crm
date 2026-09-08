const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getSystemHealth, getPlatformJobs } = require('../controllers/platformController');

// All platform operational endpoints are restricted to SUPER_ADMIN
router.use(authenticate);
router.use(requireRole(['SUPER_ADMIN']));

// GET /api/platform/health
router.get('/health', getSystemHealth);

// GET /api/platform/jobs
router.get('/jobs', getPlatformJobs);

module.exports = router;
