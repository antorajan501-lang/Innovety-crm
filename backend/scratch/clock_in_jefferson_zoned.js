const prisma = require('../src/utils/db');
const { getTodayZonedDate } = require('../src/utils/attendanceUtils');

async function testClockInZoned() {
  const jefferson = await prisma.user.findFirst({ where: { email: 'jeffersonsamuel003@gmail.com' } });
  const todayZoned = getTodayZonedDate(new Date(), 'Asia/Kolkata');
  console.log('todayZoned (Asia/Kolkata):', todayZoned.toISOString());

  await prisma.attendance.upsert({
    where: {
      userId_date: {
        userId: jefferson.id,
        date: todayZoned
      }
    },
    update: {
      clockIn: new Date(),
      status: 'PRESENT',
      workLocation: 'OFFICE'
    },
    create: {
      userId: jefferson.id,
      date: todayZoned,
      clockIn: new Date(),
      status: 'PRESENT',
      workLocation: 'OFFICE'
    }
  });

  console.log('✓ Upserted attendance for Jefferson with todayZoned.');
  await prisma.$disconnect();
}

testClockInZoned();
