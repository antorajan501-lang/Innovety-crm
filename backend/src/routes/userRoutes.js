const express = require('express');
const router = express.Router();
const { createUser, getAllUsers, editUser, deleteUser, toggleUserStatus, resetUserPassword, bulkImport, bulkDelete } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

// All user management routes require admin privilege
router.use(authenticate, requireRole(['ADMIN']));

router.post('/', createUser);
router.get('/', getAllUsers);
router.put('/:id', editUser);
router.delete('/:id', deleteUser);
router.put('/:id/status', toggleUserStatus);
router.put('/:id/reset-password', resetUserPassword);
router.post('/bulk-import', bulkImport);
router.post('/bulk-delete', bulkDelete);

module.exports = router;
