const express = require('express');
const router = express.Router();
const { getTeamPerformance } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/dashboard/team-performance
router.get('/team-performance', getTeamPerformance);

module.exports = router;