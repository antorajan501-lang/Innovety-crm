const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload folders exist
const uploadDir = path.join(__dirname, '../../uploads');
const subDirs = ['profile-pics', 'attachments', 'submissions', 'resumes'];

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

subDirs.forEach((dir) => {
  const fullPath = path.join(uploadDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'attachments';
    
    if (file.fieldname === 'profilePic') {
      folder = 'profile-pics';
    } else if (file.fieldname === 'resume') {
      folder = 'resumes';
    } else if (file.fieldname === 'submissions' || file.fieldname === 'files') {
      folder = 'submissions';
    }
    
    cb(null, path.join(uploadDir, folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    const randomHex = Math.round(Math.random() * 1e9).toString(16);
    if (file.fieldname === 'resume') {
      cb(null, `resume_${timestamp}_${randomHex}${ext}`);
    } else {
      const uniqueSuffix = timestamp + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume') {
      const ext = path.extname(file.originalname).toLowerCase();
      if (['.pdf', '.doc', '.docx'].includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed for resumes.'));
      }
    } else {
      cb(null, true);
    }
  }
});

module.exports = upload;
