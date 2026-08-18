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
const assetRoutes = require('./routes/assetRoutes');
const chatRoutes = require('./routes/chatRoutes');
const projectRoutes = require('./routes/projectRoutes');
const milestoneRoutes = require('./routes/milestoneRoutes');
const taskDependencyRoutes = require('./routes/taskDependencyRoutes');
const workLogRoutes = require('./routes/workLogRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');


// Payroll Route modules
const salaryTemplateRoutes = require('./routes/salaryTemplateRoutes');
const salaryStructureRoutes = require('./routes/salaryStructureRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const payrollSettingsRoutes = require('./routes/payrollSettingsRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const payslipRoutes = require('./routes/payslipRoutes');
const payrollReportRoutes = require('./routes/payrollReportRoutes');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // In Production mode, strictly validate origin against configured FRONTEND_URL
    if (process.env.NODE_ENV === 'production') {
      const allowedProd = [process.env.FRONTEND_URL].filter(Boolean);
      if (!origin || allowedProd.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy violation: Origin not allowed by FRONTEND_URL configuration.'));
    }

    // In Development mode, allow local development origins
    const allowedDev = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174'
    ];
    if (!origin || allowedDev.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const fs = require('fs');
const { authenticate } = require('./middleware/auth');

// Serve static upload directories with headers (supports both /uploads and /api/uploads for Nginx reverse proxies)
app.use(['/uploads', '/api/uploads'], express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
}));

// Dedicated file download endpoint with proper MIME headers & Content-Disposition
app.get('/api/download-file', authenticate, (req, res) => {
  try {
    const rawFile = req.query.file || req.query.filename;
    if (!rawFile) {
      return res.status(400).json({ message: 'File parameter is required.' });
    }

    // Decode URL parameter
    let fileRelPath = decodeURIComponent(rawFile).trim();

    // Normalization & leading slash cleanup
    if (fileRelPath.startsWith('/') || fileRelPath.startsWith('\\')) {
      fileRelPath = fileRelPath.substring(1);
    }

    // Strip optional leading 'uploads/' prefix
    let targetRelPath = fileRelPath;
    if (/^uploads[/\\]/i.test(targetRelPath)) {
      targetRelPath = targetRelPath.replace(/^uploads[/\\]/i, '');
    }

    const uploadsDir = path.resolve(__dirname, '../uploads');
    const resolvedPath = path.resolve(uploadsDir, targetRelPath);

    // SECURITY CHECK: Path Traversal Prevention
    if (!resolvedPath.startsWith(uploadsDir)) {
      console.warn(`[SECURITY] Path traversal blocked for: ${rawFile}`);
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!fs.existsSync(resolvedPath)) {
      console.warn(`File download failed - physical file not found at: ${resolvedPath}`);
      return res.status(404).json({ message: 'File not found on server.' });
    }

    // Use custom download name from query if provided, otherwise fallback to physical basename
    const customName = req.query.name || req.query.originalFileName || path.basename(resolvedPath);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(customName)}"; filename*=UTF-8''${encodeURIComponent(customName)}`);

    res.download(resolvedPath, customName, (err) => {
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

const superAdminRoutes = require('./routes/superAdminRoutes');
const platformBuilderRoutes = require('./routes/platformBuilderRoutes');

app.use('/api/super-admin/platform-builder', platformBuilderRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.get('/api/platform/settings', async (req, res) => {
  try {
    const prisma = require('./utils/db');
    let settings = await prisma.platformSettings.findUnique({ where: { id: 'PLATFORM' } });
    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: 'PLATFORM', companyName: 'Innoviety Enterprise', selectedTheme: 'emerald', themeMode: 'light' }
      });
    }
    res.json(settings);
  } catch (err) {
    res.json({ companyName: 'Innoviety Enterprise', selectedTheme: 'emerald', themeMode: 'light', companyLogo: null });
  }
});
const organizationRoutes = require('./routes/organizationRoutes');
const positionRoutes = require('./routes/positionRoutes');

app.use('/api/organization', organizationRoutes);
app.use('/api/positions', positionRoutes);

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
const leavePolicyRoutes = require('./routes/leavePolicyRoutes');

app.use('/api/leave-policy', leavePolicyRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/task-dependencies', taskDependencyRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
const workCalendarRoutes = require('./routes/workCalendarRoutes');
app.use('/api/work-calendar', workCalendarRoutes);



// Finance & Payroll API Endpoints
app.use('/api/payroll/templates', salaryTemplateRoutes);
app.use('/api/payroll/salary-structures', salaryStructureRoutes);
app.use('/api/payroll/holidays', holidayRoutes);
app.use('/api/payroll/settings', payrollSettingsRoutes);
app.use('/api/payroll/payslips', payslipRoutes);
app.use('/api/payroll/reports', payrollReportRoutes);
app.use('/api/payroll', payrollRoutes);

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

const { ensureCompanyChatRoom } = require('./services/companyChatService');

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Enterprise CRM backend server is running on port ${PORT}`);
  await ensureCompanyChatRoom();
});
