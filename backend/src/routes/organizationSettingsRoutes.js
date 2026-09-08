const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getOrganizationSettings,
  updateOrganizationSettings
} = require('../controllers/organizationSettingsController');

// GET /api/organizations/:id/settings (Requires authentication)
router.get('/:id/settings', authenticate, getOrganizationSettings);

// PUT /api/organizations/:id/settings (Requires SUPER_ADMIN role + logo file upload support)
router.put('/:id/settings', authenticate, requireRole(['SUPER_ADMIN']), upload.single('logo'), updateOrganizationSettings);

module.exports = router;
