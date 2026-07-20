const express = require('express');
const router = express.Router();
const { createTask, getTasks, getTaskById, updateTaskStatus, submitTask, addComment, updateTask, createSubtask, toggleSubtask, deleteSubtask } = require('../controllers/taskController');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

router.post('/', requireRole(['ADMIN', 'TEAM_LEADER']), upload.array('attachments', 5), createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', requireRole(['ADMIN', 'TEAM_LEADER']), upload.array('attachments', 5), updateTask);
router.put('/:id/status', updateTaskStatus);
router.post('/:id/submit', requireRole(['INTERN']), upload.array('files', 5), submitTask);
router.post('/:id/comment', addComment);

// Subtasks routes
router.post('/:id/subtasks', createSubtask);
router.put('/subtasks/:subtaskId', toggleSubtask);
router.delete('/subtasks/:subtaskId', deleteSubtask);

module.exports = router;
