const prisma = require('../utils/db');

/**
 * Service to manage centralized enterprise audit logging,
 * filtering (User, Company, Action, Date), and CSV/PDF export.
 */

const logAuditEvent = async ({
  organizationId,
  action,
  category = 'GENERAL',
  entityType,
  entityId,
  performedById,
  targetUserId,
  details,
  ipAddress,
  userAgent
}) => {
  if (!organizationId || !action) {
    return null;
  }

  try {
    const log = await prisma.organizationAuditLog.create({
      data: {
        organizationId,
        action,
        category,
        entityType: entityType || null,
        entityId: entityId ? String(entityId) : null,
        performedById: performedById || null,
        targetUserId: targetUserId || null,
        details: details && typeof details === 'object' ? details : undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      }
    });
    return log;
  } catch (err) {
    console.error('[auditService] Failed to record audit log:', err);
    return null;
  }
};

const getAuditLogs = async ({
  organizationId,
  userId,
  action,
  category,
  startDate,
  endDate,
  search,
  page = 1,
  limit = 25
}) => {
  const where = {};
  if (organizationId) where.organizationId = organizationId;

  if (userId) {
    where.OR = [
      { performedById: userId },
      { targetUserId: userId }
    ];
  }

  if (action && action !== 'ALL') {
    where.action = action;
  }

  if (category && category !== 'ALL') {
    where.category = category;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setUTCHours(23, 59, 59, 999);
      where.createdAt.lte = eDate;
    }
  }

  if (search) {
    const searchClause = {
      OR: [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { performedBy: { name: { contains: search, mode: 'insensitive' } } },
        { targetUser: { name: { contains: search, mode: 'insensitive' } } }
      ]
    };

    if (where.OR) {
      where.AND = [
        { OR: where.OR },
        searchClause
      ];
      delete where.OR;
    } else {
      where.OR = searchClause.OR;
    }
  }

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 25;
  const skip = (pageNum - 1) * limitNum;

  const [logs, totalCount] = await Promise.all([
    prisma.organizationAuditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: {
          select: { id: true, name: true, employeeId: true, role: true, email: true }
        },
        targetUser: {
          select: { id: true, name: true, employeeId: true, role: true, email: true }
        }
      }
    }),
    prisma.organizationAuditLog.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum)
    }
  };
};

const exportAuditLogsToCsv = async ({ organizationId, ...filters }) => {
  const { logs } = await getAuditLogs({
    organizationId,
    ...filters,
    page: 1,
    limit: 1000 // Export up to 1000 entries
  });

  const headers = [
    'Timestamp',
    'Action',
    'Category',
    'Performed By',
    'Target Employee',
    'Entity Type',
    'Entity ID',
    'IP Address',
    'Details'
  ];

  const rows = logs.map((log) => [
    `"${new Date(log.createdAt).toISOString()}"`,
    `"${log.action}"`,
    `"${log.category || 'GENERAL'}"`,
    `"${log.performedBy ? `${log.performedBy.name} (${log.performedBy.employeeId})` : 'System / Auto'}"`,
    `"${log.targetUser ? `${log.targetUser.name} (${log.targetUser.employeeId})` : '-'}"`,
    `"${log.entityType || '-'}"`,
    `"${log.entityId || '-'}"`,
    `"${log.ipAddress || '-'}"`,
    `"${log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '-'}"`
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};

const getAuditStats = async (organizationId) => {
  const where = organizationId ? { organizationId } : {};

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [totalCount, todayCount, recentLogs] = await Promise.all([
    prisma.organizationAuditLog.count({ where }),
    prisma.organizationAuditLog.count({
      where: {
        ...where,
        createdAt: { gte: startOfToday }
      }
    }),
    prisma.organizationAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        performedBy: { select: { id: true, name: true, employeeId: true } },
        targetUser: { select: { id: true, name: true, employeeId: true } }
      }
    })
  ]);

  return {
    totalCount,
    todayCount,
    recentActivity: recentLogs
  };
};

module.exports = {
  logAuditEvent,
  getAuditLogs,
  exportAuditLogsToCsv,
  getAuditStats
};
