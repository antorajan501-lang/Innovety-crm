const express = require('express');
const router = express.Router();
const { getPublicCompanyBranding, getActiveCompanyBranding } = require('../controllers/publicCompanyController');

// GET /api/public/company/branding/active (Unauthenticated active company branding)
router.get('/branding/active', getActiveCompanyBranding);
router.get('/active/branding', getActiveCompanyBranding);
router.get('/active', getActiveCompanyBranding);

// GET /api/public/company/:slug (Unauthenticated public branding)
router.get('/:slug', getPublicCompanyBranding);

module.exports = router;
