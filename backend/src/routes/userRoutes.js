const express = require('express');
const router = express.Router();
const {
  createUser,
  getAllUsers,
  getUserById,
  editUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  bulkImport,
  bulkDelete,
  promoteUser,
  getUserPromotionHistory
} = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const userUpload = upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

// GET /api/users and GET /api/users/:id allowed for authenticated users
router.get('/', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']), getAllUsers);
router.get('/:id/promotion-history', authenticate, getUserPromotionHistory);
router.get('/:id', authenticate, requireRole(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']), getUserById);

// All user creation, modification, promotion, and deletion routes strictly require ADMIN privilege
router.use(authenticate, requireRole(['ADMIN']));

router.post('/', userUpload, createUser);
router.post('/:id/promote', promoteUser);
router.put('/:id', userUpload, editUser);
router.delete('/:id', deleteUser);
router.put('/:id/status', toggleUserStatus);
router.put('/:id/reset-password', resetUserPassword);
router.post('/bulk-import', bulkImport);
router.post('/bulk-delete', bulkDelete);

module.exports = router;
