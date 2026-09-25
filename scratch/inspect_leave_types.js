const prisma = require('../backend/src/utils/db');

async function check() {
  const types = await prisma.leaveType.findMany({
    orderBy: { displayOrder: 'asc' }
  });
  console.log('--- CURRENT LEAVE TYPES ---');
  console.table(types.map(t => ({
    id: t.id,
    name: t.name,
    code: t.code,
    annualDays: t.annualDays,
    monthlyCreditDays: t.monthlyCreditDays,
    isPaid: t.isPaid,
    isSystem: t.isSystem,
    isActive: t.isActive
  })));
  await prisma.$disconnect();
}

check().catch(console.error);
