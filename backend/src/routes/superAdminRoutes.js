const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/superAdminMiddleware');
const superAdminController = require('../controllers/superAdminController');

// Ensure branding uploads directory exists
const brandingUploadDir = path.join(__dirname, '../../uploads/branding');
if (!fs.existsSync(brandingUploadDir)) {
  fs.mkdirSync(brandingUploadDir, { recursive: true });
}

// Multer storage configuration for branding logo and background uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, brandingUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname === 'backgroundImage' ? 'login-bg-' : 'company-logo-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max logo/bg size
});

const brandingUpload = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'backgroundImage', maxCount: 1 }
]);

// All Super Admin routes require JWT authentication and SUPER_ADMIN role guard
router.use(authenticate);
router.use(requireSuperAdmin);

// Platform Overview & Settings
router.get('/stats', superAdminController.getPlatformStats);
router.get('/branding', superAdminController.getPlatformSettings);
router.put('/branding', brandingUpload, superAdminController.updatePlatformSettings);

// Users Directory (All roles)
router.get('/users', superAdminController.getUsersDirectory);
router.get('/users/:userId/audit-history', superAdminController.getUserAuditHistory);
router.put('/users/:userId/status', superAdminController.updateUserStatus);
router.put('/users/:userId/reset-password', superAdminController.resetUserPassword);
router.put('/users/:userId/unlock', superAdminController.unlockUserAccount);

// Team Directory (Read-Only)
router.get('/teams', superAdminController.getTeamsDirectory);

// Admin Management
router.get('/admins', superAdminController.getAdmins);
router.post('/admins', superAdminController.createAdmin);
router.put('/admins/:adminId', superAdminController.updateAdmin);
router.delete('/admins/:adminId', superAdminController.deleteAdmin);

module.exports = router;
