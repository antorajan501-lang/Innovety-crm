const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  updateOrganizationStatus,
  deleteOrganization,
  resetCompanyAdminPassword,
  getOrganizationStats,
  getPlatformHealthStats
} = require('../controllers/companyController');

// All Company Management endpoints are restricted to SUPER_ADMIN
router.get('/platform/health', authenticate, requireRole(['SUPER_ADMIN']), getPlatformHealthStats);
router.get('/', authenticate, getAllOrganizations);
router.get('/:id', authenticate, requireRole(['SUPER_ADMIN']), getOrganizationById);
router.get('/:id/stats', authenticate, requireRole(['SUPER_ADMIN']), getOrganizationStats);
router.post('/', authenticate, requireRole(['SUPER_ADMIN']), upload.single('logo'), createOrganization);
router.put('/:id', authenticate, requireRole(['SUPER_ADMIN']), upload.single('logo'), updateOrganization);
router.patch('/:id/status', authenticate, requireRole(['SUPER_ADMIN']), updateOrganizationStatus);
router.post('/:id/reset-admin-password', authenticate, requireRole(['SUPER_ADMIN']), resetCompanyAdminPassword);
router.delete('/:id', authenticate, requireRole(['SUPER_ADMIN']), deleteOrganization);

module.exports = router;
