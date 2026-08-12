const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getOrganizationTree,
  getBranches,
  createBranch,
  updateBranch,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
  addDepartmentMembers,
  removeDepartmentMember,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getEmploymentTypes,
  createEmploymentType,
  updateEmploymentType,
  deleteEmploymentType,
  getDesignations,
  createDesignation,
  updateDesignation
} = require('../controllers/organizationController');

// Public to authenticated users for dropdown population
router.get('/tree', authenticate, getOrganizationTree);

// Super Admin Department Management routes
router.get('/departments', authenticate, getDepartments);
router.post('/departments', authenticate, requireRole(['SUPER_ADMIN']), createDepartment);
router.put('/departments/:id', authenticate, requireRole(['SUPER_ADMIN']), updateDepartment);
router.delete('/departments/:id', authenticate, requireRole(['SUPER_ADMIN']), deleteDepartment);

// Department Member Management
router.get('/departments/:id/members', authenticate, getDepartmentMembers);
router.post('/departments/:id/members', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), addDepartmentMembers);
router.delete('/departments/:id/members/:userId', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), removeDepartmentMember);

// Deprecated / Archived Shift & Employment Type routes (Preserved for future enterprise expansion)
// router.get('/shifts', authenticate, getShifts);
// router.post('/shifts', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), createShift);
// router.put('/shifts/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), updateShift);
// router.delete('/shifts/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), deleteShift);
// router.get('/employment-types', authenticate, getEmploymentTypes);
// router.post('/employment-types', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), createEmploymentType);
// router.put('/employment-types/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), updateEmploymentType);
// router.delete('/employment-types/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), deleteEmploymentType);

// Deprecated Designation routes
router.get('/designations', authenticate, getDesignations);
router.post('/designations', authenticate, requireRole(['SUPER_ADMIN']), createDesignation);
router.put('/designations/:id', authenticate, requireRole(['SUPER_ADMIN']), updateDesignation);

module.exports = router;
