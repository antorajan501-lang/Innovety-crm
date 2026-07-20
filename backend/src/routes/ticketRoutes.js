const express = require('express');
const router = express.Router();
const { createTicket, getTickets, updateTicketStatus } = require('../controllers/ticketController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createTicket);
router.get('/', getTickets);
router.put('/:id', updateTicketStatus);

module.exports = router;
