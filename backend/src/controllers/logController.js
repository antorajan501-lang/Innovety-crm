const prisma = require('../utils/db');

const getActivityLogs = async (req, res) => {
  try {
    const { action, search, page = 1, limit = 100 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (search) {
      where.OR = [
        { details: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { employeeId: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [logs, totalCount] = await prisma.$transaction([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, employeeId: true, role: true } }
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
    res.status(500).json({ message: 'Failed to retrieve activity logs.' });
  }
};

module.exports = {
  getActivityLogs
};
