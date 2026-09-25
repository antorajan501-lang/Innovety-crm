const prisma = require('../utils/db');

/**
 * Service to manage visitors, host approvals, QR passes, and check-in/out logs
 */

const generateQrCodeString = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VIS-${timestamp}-${randomStr}`;
};

const registerVisitor = async ({
  organizationId,
  hostId,
  visitorName,
  email,
  phone,
  companyName,
  purpose,
  branchId,
  idProofType,
  idProofNumber,
  notes,
  autoApprove = false
}) => {
  if (!visitorName || !purpose || !organizationId || !hostId) {
    throw new Error('Visitor name, purpose, host, and organization are required.');
  }

  const host = await prisma.user.findFirst({
    where: { id: hostId, organizationId }
  });
  if (!host) {
    throw new Error('Host employee not found in this organization.');
  }

  const qrCode = generateQrCodeString();
  const badgeNumber = `V-${Math.floor(100 + Math.random() * 900)}`;

  const visitor = await prisma.visitor.create({
    data: {
      organizationId,
      hostId: host.id,
      visitorName: visitorName.trim(),
      email: email ? email.trim().toLowerCase() : null,
      phone: phone ? phone.trim() : null,
      companyName: companyName ? companyName.trim() : null,
      purpose: purpose.trim(),
      branchId: branchId || host.branchId || null,
      idProofType: idProofType || 'National ID',
      idProofNumber: idProofNumber ? idProofNumber.trim() : null,
      qrCode,
      badgeNumber,
      status: autoApprove ? 'APPROVED' : 'PENDING_APPROVAL',
      approvalStatus: autoApprove ? 'APPROVED' : 'PENDING',
      notes: notes || null
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          employeeId: true
        }
      },
      branch: true
    }
  });

  return visitor;
};

const approveVisitor = async ({
  visitorId,
  organizationId,
  hostId,
  status = 'APPROVED',
  notes
}) => {
  const where = { id: visitorId };
  if (organizationId) where.organizationId = organizationId;

  const visitor = await prisma.visitor.findFirst({ where });
  if (!visitor) {
    throw new Error('Visitor record not found.');
  }

  if (hostId && visitor.hostId !== hostId) {
    // Check if hostId is Super Admin or Admin
    const actor = await prisma.user.findUnique({ where: { id: hostId } });
    if (actor && actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      throw new Error('Only the assigned host or an administrator can review this visitor.');
    }
  }

  const updatedStatus = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.visitor.update({
    where: { id: visitorId },
    data: {
      status: updatedStatus,
      approvalStatus: updatedStatus,
      notes: notes ? (visitor.notes ? `${visitor.notes} | ${notes}` : notes) : visitor.notes
    },
    include: {
      host: true,
      branch: true
    }
  });

  return updated;
};

const checkInVisitor = async ({
  visitorId,
  qrCode,
  organizationId,
  badgeNumber
}) => {
  const where = {};
  if (visitorId) where.id = visitorId;
  else if (qrCode) where.qrCode = qrCode;
  else throw new Error('Either visitorId or qrCode must be provided for check-in.');

  if (organizationId) where.organizationId = organizationId;

  const visitor = await prisma.visitor.findFirst({ where });
  if (!visitor) {
    throw new Error('Visitor record not found.');
  }

  if (visitor.status === 'CHECKED_IN') {
    throw new Error(`Visitor ${visitor.visitorName} is already checked in.`);
  }

  if (visitor.status === 'REJECTED') {
    throw new Error('Cannot check in a rejected visitor invitation.');
  }

  const updated = await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      status: 'CHECKED_IN',
      approvalStatus: 'APPROVED',
      checkIn: new Date(),
      badgeNumber: badgeNumber || visitor.badgeNumber
    },
    include: {
      host: true,
      branch: true
    }
  });

  return updated;
};

const checkOutVisitor = async ({
  visitorId,
  qrCode,
  organizationId
}) => {
  const where = {};
  if (visitorId) where.id = visitorId;
  else if (qrCode) where.qrCode = qrCode;
  else throw new Error('Either visitorId or qrCode must be provided for check-out.');

  if (organizationId) where.organizationId = organizationId;

  const visitor = await prisma.visitor.findFirst({ where });
  if (!visitor) {
    throw new Error('Visitor record not found.');
  }

  if (visitor.status === 'CHECKED_OUT') {
    throw new Error(`Visitor ${visitor.visitorName} has already checked out.`);
  }

  const updated = await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      status: 'CHECKED_OUT',
      checkOut: new Date()
    },
    include: {
      host: true,
      branch: true
    }
  });

  return updated;
};

const getVisitorPass = async (visitorId, organizationId) => {
  const where = { id: visitorId };
  if (organizationId) where.organizationId = organizationId;

  const visitor = await prisma.visitor.findFirst({
    where,
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          phone: true,
          employeeId: true
        }
      },
      branch: true,
      organization: {
        select: {
          id: true,
          name: true,
          logo: true,
          address: true
        }
      }
    }
  });

  if (!visitor) {
    throw new Error('Visitor pass not found.');
  }

  return {
    ...visitor,
    qrPayload: JSON.stringify({
      code: visitor.qrCode,
      name: visitor.visitorName,
      badge: visitor.badgeNumber,
      host: visitor.host?.name,
      org: visitor.organization?.name
    })
  };
};

const getVisitorHistory = async ({
  organizationId,
  branchId,
  status,
  search
}) => {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (branchId && branchId !== 'ALL') where.branchId = branchId;
  if (status && status !== 'ALL') where.status = status;

  if (search) {
    where.OR = [
      { visitorName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { badgeNumber: { contains: search, mode: 'insensitive' } },
      { qrCode: { contains: search, mode: 'insensitive' } },
      { host: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const visitors = await prisma.visitor.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          employeeId: true
        }
      },
      branch: true
    }
  });

  return visitors;
};

const getVisitorStats = async (organizationId) => {
  const where = organizationId ? { organizationId } : {};

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [totalToday, currentlyInside, pendingApproval, totalOverall] = await Promise.all([
    prisma.visitor.count({
      where: {
        ...where,
        createdAt: { gte: startOfToday }
      }
    }),
    prisma.visitor.count({
      where: {
        ...where,
        status: 'CHECKED_IN'
      }
    }),
    prisma.visitor.count({
      where: {
        ...where,
        status: 'PENDING_APPROVAL'
      }
    }),
    prisma.visitor.count({ where })
  ]);

  return {
    totalToday,
    currentlyInside,
    pendingApproval,
    totalOverall
  };
};

module.exports = {
  registerVisitor,
  approveVisitor,
  checkInVisitor,
  checkOutVisitor,
  getVisitorPass,
  getVisitorHistory,
  getVisitorStats
};
