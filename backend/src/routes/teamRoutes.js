const express = require('express');
const router = express.Router();
const { createTeam, getAllTeams, getTeamDetails, editTeam, deleteTeam, assignMembers } = require('../controllers/teamController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// View-only endpoints accessible by any authenticated user
router.get('/', getAllTeams);
router.get('/:id', getTeamDetails);

// Modifying endpoints restricted to Admin role
router.post('/', requireRole(['ADMIN']), createTeam);
router.put('/:id', requireRole(['ADMIN']), editTeam);
router.delete('/:id', requireRole(['ADMIN']), deleteTeam);
router.put('/:id/members', requireRole(['ADMIN']), assignMembers);

module.exports = router;
