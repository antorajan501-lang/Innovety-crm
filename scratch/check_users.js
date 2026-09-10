const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });
  console.log('Users in DB:');
  console.table(users);

  // Check today's attendance records
  const todayStr = new Date().toISOString().split('T')[0];
  const attendance = await prisma.attendance.findMany({
    where: { date: todayStr },
    include: { user: { select: { name: true, email: true } } }
  });
  console.log('\nAttendance records for today (' + todayStr + '):');
  console.table(attendance.map(a => ({
    user: a.user.name,
    clockIn: a.clockIn,
    clockOut: a.clockOut,
    status: a.status
  })));
}

run().finally(() => prisma.$disconnect());
