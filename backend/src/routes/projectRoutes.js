const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  updateProjectWorkflowStages,
  deleteProject,
  uploadDocument,
  deleteDocument
} = require('../controllers/projectController');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.get('/', getProjects);
router.post('/', requireRole(['ADMIN', 'SUPER_ADMIN']), createProject);
router.get('/:id', getProjectById);
router.put('/:id', requireRole(['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER']), updateProject);
router.put('/:id/workflow-stages', requireRole(['ADMIN', 'SUPER_ADMIN']), updateProjectWorkflowStages);
router.delete('/:id', requireRole(['ADMIN', 'SUPER_ADMIN']), deleteProject);

// Project Documents
router.post('/:id/documents', upload.single('file'), uploadDocument);
router.delete('/:id/documents/:docId', deleteDocument);

module.exports = router;
