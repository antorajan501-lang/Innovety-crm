const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedLeavePolicy() {
  console.log('Seeding Global Leave Policy & Default Leave Types...');

  // 1. Global Leave Policy
  let globalPolicy = await prisma.leavePolicy.findFirst({
    where: { isGlobal: true }
  });

  if (!globalPolicy) {
    globalPolicy = await prisma.leavePolicy.create({
      data: {
        isGlobal: true,
        allocationType: 'ANNUAL',
        carryForwardEnabled: true,
        maxCarryForwardDays: 5.0,
        halfDayAllowed: true,
        workingDaysOnly: true,
        autoApproval: false
      }
    });
    console.log('Created Global Leave Policy:', globalPolicy.id);
  }

  // 2. Default System Leave Types
  const defaultLeaveTypes = [
    {
      name: 'Work From Home',
      code: 'WFH',
      description: 'Remote work leave',
      color: '#3B82F6',
      icon: 'Home',
      displayOrder: 1,
      isPaid: true,
      annualDays: 24.0,
      monthlyCreditDays: 2.0,
      allowCarryForward: false,
      isSystem: true,
      isActive: true
    },
    {
      name: 'Casual Leave',
      code: 'CL',
      description: 'Paid casual leave for personal obligations',
      color: '#10B981',
      icon: 'Calendar',
      displayOrder: 2,
      isPaid: true,
      annualDays: 12.0,
      monthlyCreditDays: 1.0,
      allowCarryForward: true,
      isSystem: true,
      isActive: true
    },
    {
      name: 'Sick Leave',
      code: 'SL',
      description: 'Paid medical and sick leave',
      color: '#EF4444',
      icon: 'Stethoscope',
      displayOrder: 3,
      isPaid: true,
      annualDays: 10.0,
      monthlyCreditDays: 0.0,
      allowCarryForward: false,
      isSystem: true,
      isActive: true
    },
    {
      name: 'Emergency Leave',
      code: 'EL',
      description: 'Urgent emergency leave',
      color: '#F59E0B',
      icon: 'AlertCircle',
      displayOrder: 4,
      isPaid: true,
      annualDays: 5.0,
      monthlyCreditDays: 0.0,
      allowCarryForward: false,
      isSystem: false,
      isActive: true
    },
    {
      name: 'Loss Of Pay',
      code: 'LOP',
      description: 'Unpaid leave when balance is exhausted',
      color: '#6B7280',
      icon: 'Clock',
      displayOrder: 5,
      isPaid: false,
      annualDays: 0.0,
      monthlyCreditDays: 0.0,
      allowCarryForward: false,
      isSystem: false,
      isActive: true
    }
  ];

  for (const lt of defaultLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        color: lt.color,
        icon: lt.icon,
        isSystem: lt.isSystem,
        displayOrder: lt.displayOrder,
        annualDays: lt.annualDays,
        monthlyCreditDays: lt.monthlyCreditDays
      },
      create: lt
    });
  }
  console.log('Seeded default Leave Types (Work From Home, Casual Leave, Sick Leave, Emergency Leave, Loss Of Pay).');

  // 3. Initialize User Leave Balances for all active users
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true, role: true } });
  const activeLeaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  let initializedCount = 0;
  for (const u of allUsers) {
    for (const lt of activeLeaveTypes) {
      await prisma.userLeaveBalance.upsert({
        where: {
          userId_leaveTypeId: {
            userId: u.id,
            leaveTypeId: lt.id
          }
        },
        update: {},
        create: {
          userId: u.id,
          leaveTypeId: lt.id,
          allocated: lt.annualDays,
          used: 0,
          pending: 0,
          available: lt.annualDays,
          carryForward: 0,
          expired: 0,
          lastCreditedAt: new Date()
        }
      });
      initializedCount++;
    }
  }

  console.log(`Initialized ${initializedCount} UserLeaveBalance records across ${allUsers.length} users.`);
}

seedLeavePolicy()
  .catch((err) => {
    console.error('Seed leave policy error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
