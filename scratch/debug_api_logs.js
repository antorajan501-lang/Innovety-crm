const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();
const { getTodayZonedDate } = require(path.resolve(__dirname, '../backend/src/utils/attendanceUtils'));

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });

  const now = new Date();
  const todayZoned = getTodayZonedDate(now, 'Asia/Kolkata');

  const jefferson = users.find(u => u.email === 'jeffersonsamuel003@gmail.com');
  if (jefferson) {
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
    console.log('Created record in DB:', created);
  }

  // Fetch API response as Jefferson
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jeffersonsamuel003@gmail.com', password: 'Password123!' })
  }).then(r => r.json());

  const logs = await fetch('http://localhost:5000/api/attendance/logs', {
    headers: { Authorization: `Bearer ${loginRes.token}` }
  }).then(r => r.json());

  const rawLogsArray = Array.isArray(logs) ? logs : logs.data || [];
  console.log('API returned logs count:', rawLogsArray.length);
  const jeffLogs = rawLogsArray.filter(l => l.userId === jefferson.id);
  console.log('Jefferson logs from API:');
  console.table(jeffLogs.map(l => ({
    id: l.id,
    userId: l.userId,
    date: l.date,
    clockIn: l.clockIn,
    status: l.status
  })));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
