const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// Configure Multer storage for chat uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/chat');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

// All chat routes require JWT Auth
router.use(authenticate);

// Rooms & Conversations
router.get('/rooms', chatController.getRooms);
router.get('/rooms/project/:projectId', chatController.getOrCreateProjectChatRoom);
router.post('/rooms/direct', chatController.createDirectRoom);
router.post('/rooms/team', chatController.createTeamRoom);
router.delete('/groups/:groupId', chatController.deleteGroup);
router.delete('/rooms/:roomId', chatController.deleteGroup);

// Messages
router.get('/rooms/:roomId/messages', chatController.getRoomMessages);
router.post('/messages', chatController.sendMessage);
router.put('/messages/:messageId', chatController.editMessage);
router.delete('/messages/:messageId', chatController.softDeleteMessage);
router.put('/messages/:messageId/pin', chatController.togglePinMessage);
router.get('/messages/:messageId/download', chatController.downloadAttachment);
router.post('/rooms/:roomId/read', chatController.markRoomAsRead);

// Search
router.get('/search', chatController.searchChat);

// File Attachment Upload Endpoint
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided.' });
    }

    const attachmentUrl = `/uploads/chat/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const isImage = req.file.mimetype.startsWith('image/');
    const messageType = isImage ? 'IMAGE' : 'FILE';

    res.json({
      attachmentUrl,
      fileName,
      fileSize,
      messageType
    });
  } catch (error) {
    console.error('Chat file upload error:', error);
    res.status(500).json({ message: 'File upload failed.' });
  }
});

module.exports = router;
