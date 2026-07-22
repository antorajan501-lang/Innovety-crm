const express = require('express');
const router = express.Router();
const { createUser, getAllUsers, editUser, deleteUser, toggleUserStatus, resetUserPassword, bulkImport, bulkDelete } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/users is allowed for authenticated users so dropdowns, registries, and team lists load smoothly
router.get('/', authenticate, requireRole(['ADMIN', 'TEAM_LEADER', 'INTERN', 'EMPLOYEE']), getAllUsers);

// All user creation, modification, and deletion routes strictly require ADMIN privilege
router.use(authenticate, requireRole(['ADMIN']));

router.post('/', createUser);
router.put('/:id', editUser);
router.delete('/:id', deleteUser);
router.put('/:id/status', toggleUserStatus);
router.put('/:id/reset-password', resetUserPassword);
router.post('/bulk-import', bulkImport);
router.post('/bulk-delete', bulkDelete);

module.exports = router;
