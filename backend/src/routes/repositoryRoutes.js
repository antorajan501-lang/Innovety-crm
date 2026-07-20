const express = require('express');
const router = express.Router();
const { 
  getRepositories, 
  createRepository, 
  deleteRepository,
  createBranch,
  deleteBranch 
} = require('../controllers/repositoryController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getRepositories);
router.post('/', authenticate, createRepository);
router.delete('/:id', authenticate, deleteRepository);

// Branch operations
router.post('/:repoId/branches', authenticate, createBranch);
router.delete('/:repoId/branches/:branchId', authenticate, deleteBranch);

module.exports = router;
