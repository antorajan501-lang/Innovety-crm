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
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            status: true,
            companyCode: true,
            timezone: true
          }
        },
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

    if (req.user.role === 'SUPER_ADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: 'Access denied: Insufficient privileges.' });
  };
};

/**
 * Centralized middleware that blocks requests from users belonging to a SUSPENDED organization.
 * SUPER_ADMIN users bypass this restriction.
 */
const requireOrganizationActive = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (req.user.organization && req.user.organization.status === 'SUSPENDED') {
    return res.status(403).json({ message: 'Your organization has been suspended. Please contact your system administrator.' });
  }

  next();
};

/**
 * Optional Authentication middleware: Attaches req.user if a valid Bearer token is provided,
 * but proceeds safely without error if unauthenticated.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!');
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logo: true,
              status: true,
              companyCode: true,
              timezone: true
            }
          }
        }
      });
      if (user && user.status === 'ACTIVE') {
        req.user = user;
      }
    }
  } catch (error) {
    // Soft ignore token verification failures for optional auth
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireOrganizationActive
};
