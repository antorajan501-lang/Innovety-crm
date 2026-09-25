const prisma = require('../backend/src/utils/db');

async function inspectBalances() {
  const balances = await prisma.userLeaveBalance.findMany({
    include: {
      leaveType: true,
      user: { select: { id: true, name: true, role: true, organizationId: true, status: true } }
    }
  });

  console.log(`Total UserLeaveBalance rows: ${balances.length}`);
  const summary = {};
  for (const b of balances) {
    const code = b.leaveType?.code || 'UNKNOWN';
    if (!summary[code]) {
      summary[code] = { count: 0, users: [], totalAllocated: 0, totalUsed: 0, totalPending: 0 };
    }
    summary[code].count++;
    summary[code].totalAllocated += b.allocated;
    summary[code].totalUsed += b.used;
    summary[code].totalPending += b.pending;
    summary[code].users.push(`${b.user.name} (${b.user.role}, allocated=${b.allocated}, used=${b.used}, pending=${b.pending})`);
  }
  console.log(JSON.stringify(summary, null, 2));

  const requests = await prisma.leaveRequest.findMany({
    select: { id: true, leaveType: true, status: true, totalDays: true, user: { select: { name: true, role: true } } }
  });
  console.log('\nLeaveRequests:');
  console.log(JSON.stringify(requests, null, 2));

  await prisma.$disconnect();
}

inspectBalances().catch(console.error);
