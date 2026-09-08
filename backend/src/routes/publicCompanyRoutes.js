const express = require('express');
const router = express.Router();
const { getPublicCompanyBranding } = require('../controllers/publicCompanyController');

// GET /api/public/company/:slug (Unauthenticated public branding)
router.get('/:slug', getPublicCompanyBranding);

module.exports = router;
