const express = require('express');
const router = express.Router();
const { login, getProfile, updateProfile, changePassword, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

const profileUpload = upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, profileUpload, updateProfile);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
