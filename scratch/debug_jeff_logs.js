const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();
const { getTodayZonedDate, getZonedParts } = require(path.resolve(__dirname, '../backend/src/utils/attendanceUtils'));

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });

  const jefferson = users.find(u => u.email === 'jeffersonsamuel003@gmail.com');
  const now = new Date();
  const todayZoned = getTodayZonedDate(now, 'Asia/Kolkata');

  // Clock in Jefferson
  await prisma.attendance.deleteMany({
    where: { userId: jefferson.id, date: todayZoned }
  });

  const created = await prisma.attendance.create({
    data: {
      userId: jefferson.id,
      date: todayZoned,
      clockIn: new Date(),
      status: 'PRESENT'
    }
  });

  console.log('Created record date:', created.date.toISOString());
  console.log('Created record dateStr:', getZonedParts(created.date, 'Asia/Kolkata').dateStr);

  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jeffersonsamuel003@gmail.com', password: 'Password123!' })
  }).then(r => r.json());

  const logs = await fetch('http://localhost:5000/api/attendance/logs', {
    headers: { Authorization: `Bearer ${loginRes.token}` }
  }).then(r => r.json());

  const jeffLogs = logs.filter(l => l.userId === jefferson.id);
  console.log('Jefferson logs returned by API:');
  jeffLogs.slice(0, 5).forEach(l => {
    console.log({
      id: l.id,
      isSynthetic: l.isSynthetic,
      date: l.date,
      clockIn: l.clockIn,
      status: l.status
    });
  });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
