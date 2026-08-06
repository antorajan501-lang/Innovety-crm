const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/globalSearchController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, globalSearch);

module.exports = router;
