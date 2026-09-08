const express = require('express');
const router = express.Router();
const {
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  removeProfilePicture,
  refreshToken
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

const profileUpload = upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, profileUpload, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.delete('/profile/picture', authenticate, removeProfilePicture);
router.delete('/profile-photo', authenticate, removeProfilePicture);

module.exports = router;
