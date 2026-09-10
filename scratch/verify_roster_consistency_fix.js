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
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // 1. Clock in Jefferson Samuel A for today
  const jefferson = users.find(u => u.email === 'jeffersonsamuel003@gmail.com');
  if (jefferson) {
    await prisma.attendance.deleteMany({
      where: {
        userId: jefferson.id,
        date: todayZoned
      }
    });

    await prisma.attendance.create({
      data: {
        userId: jefferson.id,
        date: todayZoned,
        clockIn: new Date(),
        status: 'PRESENT'
      }
    });
    console.log(`\n>>> Clocked in ${jefferson.name} for today (${todayStr}) <<<\n`);
  }

  // 2. Ensure Nancy has NO clock-in for today
  const nancy = users.find(u => u.email === 'nancythomasselva@gmail.com');
  if (nancy) {
    await prisma.attendance.deleteMany({
      where: {
        userId: nancy.id,
        date: todayZoned
      }
    });
    console.log(`>>> Cleared attendance for ${nancy.name} for today (${todayStr}) <<<\n`);
  }

  const testViewers = [
    { email: 'somusuraj72@gmail.com', name: 'Suraj S (Team Leader)' },
    { email: 'jeffersonsamuel003@gmail.com', name: 'Jefferson Samuel A (Clocked-In Employee)' },
    { email: 'antorajan501@gmail.com', name: 'Anto A (Intern)' },
    { email: 'nancythomasselva@gmail.com', name: 'Nancy Narmadha T (No Clock-In Intern)' }
  ];

  for (const viewer of testViewers) {
    try {
      const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: viewer.email, password: 'Password123!' })
      }).then(r => r.json());

      if (!loginRes.token) continue;

      console.log(`======================================================`);
      console.log(`VIEWER: ${viewer.name}`);
      console.log(`======================================================`);

      const rawLogs = await fetch('http://localhost:5000/api/attendance/logs', {
        headers: { Authorization: `Bearer ${loginRes.token}` }
      }).then(r => r.json());

      const logsList = Array.isArray(rawLogs) ? rawLogs : rawLogs.data || [];

      // Build per-member O(1) attendance map using robust date matching (exact frontend logic)
      const todayAttendanceMap = {};
      logsList.forEach(log => {
        const logDateStr = log.date ? new Date(log.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null;
        if (logDateStr === todayStr || (typeof log.date === 'string' && log.date.startsWith(todayStr))) {
          todayAttendanceMap[log.userId] = log;
        }
      });

      const innoveityMembers = users.filter(m => m.organizationId === loginRes.user.organizationId);

      const tableData = innoveityMembers
        .filter(m => ['jeffersonsamuel003@gmail.com', 'nancythomasselva@gmail.com', 'somusuraj72@gmail.com'].includes(m.email))
        .map(m => {
          const todayLog = todayAttendanceMap[m.id];
          const isClockedIn = Boolean(
            todayLog && (
              todayLog.clockIn !== null ||
              ['PRESENT', 'LATE', 'WORK_FROM_HOME', 'HALF_DAY'].includes(todayLog.status)
            )
          );
          return {
            'Member Name': m.name,
            'Role': m.role,
            'Today Clock-In': todayLog?.clockIn ? new Date(todayLog.clockIn).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }) : 'None',
            'Evaluated Status': isClockedIn ? 'PRESENT' : 'ABSENT'
          };
        });

      console.table(tableData);

    } catch (err) {
      console.error(`Error testing viewer ${viewer.name}:`, err.message);
    }
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
