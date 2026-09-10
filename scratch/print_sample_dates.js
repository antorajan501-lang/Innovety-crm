const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function run() {
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jeffersonsamuel003@gmail.com', password: 'Password123!' })
  }).then(r => r.json());

  const logs = await fetch('http://localhost:5000/api/attendance/logs', {
    headers: { Authorization: `Bearer ${loginRes.token}` }
  }).then(r => r.json());

  console.log('Sample log dates:');
  logs.slice(0, 5).forEach(l => {
    console.log({ user: l.user?.name, date: l.date, dateType: typeof l.date, clockIn: l.clockIn, status: l.status });
  });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
