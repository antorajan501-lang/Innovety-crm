const express = require('express');
const router = express.Router();
const { login, getProfile, updateProfile, changePassword, resetPasswordRequest } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/login', login);
router.post('/forgot-password', resetPasswordRequest);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, upload.single('profilePic'), updateProfile);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
