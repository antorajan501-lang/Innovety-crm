const express = require('express');
const router = express.Router();
const { createTicket, getTickets, updateTicketStatus, deleteTicket } = require('../controllers/ticketController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createTicket);
router.get('/', getTickets);
router.put('/:id', updateTicketStatus);
router.delete('/:id', deleteTicket);

module.exports = router;
