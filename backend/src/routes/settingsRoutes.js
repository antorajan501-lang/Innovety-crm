const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getSettings);
router.put('/', requireRole(['ADMIN']), updateSettings);

module.exports = router;
