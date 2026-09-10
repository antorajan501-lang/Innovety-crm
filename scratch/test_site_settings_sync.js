const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });

  const admin = users.find(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
  const employee = users.find(u => u.role === 'EMPLOYEE');
  const intern = users.find(u => u.role === 'INTERN');
  const teamLeader = users.find(u => u.role === 'TEAM_LEADER');

  console.log('Testing users:', {
    admin: admin?.email,
    employee: employee?.email,
    intern: intern?.email,
    teamLeader: teamLeader?.email
  });

  // Login as Admin
  const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: 'Password123!' })
  }).then(r => r.json());

  console.log('Admin login success:', Boolean(adminLogin.token));

  // Get current settings
  const currentSettings = await fetch('http://localhost:5000/api/settings', {
    headers: { Authorization: `Bearer ${adminLogin.token}` }
  }).then(r => r.json());

  console.log('Current settings before update:');
  console.log({ clockInTime: currentSettings.clockInTime, clockOutTime: currentSettings.clockOutTime });

  // Update clockOutTime to 12:35
  const updateRes = await fetch('http://localhost:5000/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      ...currentSettings,
      clockOutTime: '12:35',
      internShiftEnd: '12:35',
      tlShiftEnd: '12:35'
    })
  }).then(r => r.json());

  console.log('Updated settings res:', { clockInTime: updateRes.clockInTime, clockOutTime: updateRes.clockOutTime });

  // Test status for employee, intern, team leader
  for (const u of [employee, intern, teamLeader]) {
    if (!u) continue;
    const userLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: 'Password123!' })
    }).then(r => r.json());

    if (userLogin.token) {
      const statusRes = await fetch('http://localhost:5000/api/attendance/status', {
        headers: { Authorization: `Bearer ${userLogin.token}` }
      }).then(r => r.json());

      console.log(`\n--- Status for ${u.name} (${u.role}) ---`);
      console.log({
        clockInTime: statusRes.clockInTime,
        clockOutTime: statusRes.clockOutTime,
        shiftEndAt: statusRes.shiftEndAt,
        secondsRemaining: statusRes.secondsRemaining,
        isClockedIn: statusRes.isClockedIn
      });
    }
  }

  // Restore settings back to 18:00 for cleanliness
  await fetch('http://localhost:5000/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      ...currentSettings,
      clockOutTime: '18:00',
      internShiftEnd: '18:00',
      tlShiftEnd: '18:00'
    })
  });
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
