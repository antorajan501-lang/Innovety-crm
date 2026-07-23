require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const socketManager = require('./socket');

// Route modules
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const teamRoutes = require('./routes/teamRoutes');
const taskRoutes = require('./routes/taskRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const reportRoutes = require('./routes/reportRoutes');
const logRoutes = require('./routes/logRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const repositoryRoutes = require('./routes/repositoryRoutes');
const leaveRoutes = require('./routes/leaveRoutes');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin "${origin}" not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const fs = require('fs');

// Serve static upload directories with headers
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// Dedicated file download endpoint with proper MIME headers & Content-Disposition
app.get('/api/download-file', (req, res) => {
  try {
    const rawFile = req.query.file || req.query.filename;
    if (!rawFile) {
      return res.status(400).json({ message: 'File parameter is required.' });
    }

    const cleanFileName = path.basename(rawFile);
    const filePath = path.join(__dirname, '../uploads', cleanFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    res.download(filePath, cleanFileName, (err) => {
      if (err && !res.headersSent) {
        console.error('File download stream error:', err);
        res.status(500).json({ message: 'Error downloading file.' });
      }
    });
  } catch (error) {
    console.error('Download route exception:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/repositories', repositoryRoutes);
app.use('/api/leaves', leaveRoutes);

// Simple healthcheck / diagnostic
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Express global error handler caught:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'An unexpected error occurred on the server.',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Initialize Socket.io
socketManager.init(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Enterprise CRM backend server is running on port ${PORT}`);
});
