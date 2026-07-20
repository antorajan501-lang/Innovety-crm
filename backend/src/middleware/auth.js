const jwt = require('jsonwebtoken');
const prisma = require('../utils/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication token missing or invalid.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!');

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        teamMembers: {
          include: { team: true }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User account not found.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'This account has been disabled.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Insufficient privileges.' });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireRole
};
