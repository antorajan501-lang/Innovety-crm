const prisma = require('../backend/src/utils/db');

async function run() {
  const orgId = 'cmteaqlih0000sj52wckjbgci';
  const leaveTypes = await prisma.leaveType.findMany();
  console.log('=== Global Leave Types in DB ===');
  console.log(leaveTypes.map(lt => ({ id: lt.id, code: lt.code, name: lt.name, annualDays: lt.annualDays, monthlyCreditDays: lt.monthlyCreditDays, isActive: lt.isActive })));

  const balances = await prisma.userLeaveBalance.findMany({
    where: {
      user: { organizationId: orgId }
    },
    include: { user: { select: { name: true, role: true } }, leaveType: true }
  });
  console.log('\n=== User Leave Balances in DB for Innoveity Tech ===');
  for (const b of balances) {
    console.log(`${b.user.name} (${b.user.role}) - ${b.leaveType.code}: allocated=${b.allocated}, used=${b.used}, pending=${b.pending}`);
  }
}

run().finally(() => prisma.$disconnect());
