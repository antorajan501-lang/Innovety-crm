const prisma = require('../utils/db');
const { getEffectiveOrgId } = require('../utils/organizationScope');

const getActivityLogs = async (req, res) => {
  try {
    const userRole = req.user.role;
    const targetOrgId = getEffectiveOrgId(req);

    const { action, search, page = 1, limit = 25 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (userRole !== 'SUPER_ADMIN') {
      if (!targetOrgId) {
        return res.status(403).json({ message: 'Organization context required.' });
      }
      where.organizationId = targetOrgId;
    } else if (targetOrgId) {
      where.organizationId = targetOrgId;
    }

    if (action) {
      where.action = action;
    }

    if (search) {
      const searchCondition = {
        OR: [
          { details: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { employeeId: { contains: search, mode: 'insensitive' } } }
        ]
      };

      if (Object.keys(where).length > 0) {
        where.AND = [
          searchCondition
        ];
      } else {
        where.OR = searchCondition.OR;
      }
    }

    const [logs, totalCount] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, employeeId: true, role: true, organizationId: true } }
        }
      }),
      prisma.activityLog.count({ where })
    ]);

    res.json({
      logs,
      meta: {
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Fetch activity logs error:', error);
    res.status(500).json({ message: 'Failed to retrieve activity logs.', reason: error.message });
  }
};

module.exports = {
  getActivityLogs
};
