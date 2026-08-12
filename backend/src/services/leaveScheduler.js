const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');

/**
 * Execute monthly automated leave credit for active users.
 * Checks global policy allocationType === 'MONTHLY'.
 * Uses LeaveCreditHistory to ensure idempotent execution (no duplicate monthly credits).
 */
const runMonthlyLeaveCredit = async () => {
  try {
    const policy = await prisma.leavePolicy.findFirst({ where: { isGlobal: true } });
    if (!policy || policy.allocationType !== 'MONTHLY') {
      return { executed: false, reason: 'Allocation type is not MONTHLY.' };
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1 - 12
    const currentYear = now.getFullYear();

    const activeLeaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true, monthlyCreditDays: { gt: 0 } }
    });

    if (activeLeaveTypes.length === 0) {
      return { executed: false, reason: 'No active leave types with monthly credit days configured.' };
    }

    const activeUsers = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, employeeId: true }
    });

    let creditedCount = 0;

    for (const u of activeUsers) {
      for (const lt of activeLeaveTypes) {
        // Check if already credited for this month/year
        const existingCredit = await prisma.leaveCreditHistory.findUnique({
          where: {
            userId_leaveTypeId_month_year: {
              userId: u.id,
              leaveTypeId: lt.id,
              month: currentMonth,
              year: currentYear
            }
          }
        });

        if (!existingCredit) {
          const creditAmount = lt.monthlyCreditDays;

          // 1. Create credit audit history
          await prisma.leaveCreditHistory.create({
            data: {
              userId: u.id,
              leaveTypeId: lt.id,
              creditedDays: creditAmount,
              creditedOn: now,
              month: currentMonth,
              year: currentYear,
              note: `Automated monthly credit for ${now.toLocaleString('default', { month: 'long' })} ${currentYear}`
            }
          });

          // 2. Update UserLeaveBalance
          await prisma.userLeaveBalance.upsert({
            where: {
              userId_leaveTypeId: {
                userId: u.id,
                leaveTypeId: lt.id
              }
            },
            update: {
              allocated: { increment: creditAmount },
              available: { increment: creditAmount },
              lastCreditedAt: now
            },
            create: {
              userId: u.id,
              leaveTypeId: lt.id,
              allocated: creditAmount,
              used: 0,
              pending: 0,
              available: creditAmount,
              carryForward: 0,
              expired: 0,
              lastCreditedAt: now
            }
          });

          creditedCount++;
        }
      }
    }

    if (creditedCount > 0) {
      console.log(`[LEAVE SCHEDULER] Successfully executed monthly credit for ${currentMonth}/${currentYear}: ${creditedCount} records updated.`);
    }

    return { executed: true, creditedCount, month: currentMonth, year: currentYear };
  } catch (error) {
    console.error('[LEAVE SCHEDULER ERROR]:', error);
    return { executed: false, error: error.message };
  }
};

module.exports = {
  runMonthlyLeaveCredit
};
