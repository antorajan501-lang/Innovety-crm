const express = require('express');
const router = express.Router();
const { getLatePolicy, updateLatePolicy } = require('../controllers/latePolicyController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getLatePolicy);
router.put('/', requireRole(['SUPER_ADMIN', 'ADMIN']), updateLatePolicy);

module.exports = router;
