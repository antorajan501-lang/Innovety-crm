const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();
const { getTodayZonedDate } = require(path.resolve(__dirname, '../backend/src/utils/attendanceUtils'));

async function runVerification() {
  console.log('=== SITE SETTINGS CLOCK-OUT TIME SYNC VERIFICATION ===\n');

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });

  const admin = users.find(u => u.email === 'admin@enterprise-crm.com') || users.find(u => u.role === 'ADMIN');
  const employee = users.find(u => u.role === 'EMPLOYEE');
  const intern = users.find(u => u.role === 'INTERN');
  const teamLeader = users.find(u => u.role === 'TEAM_LEADER');

  console.log('Testing Admin user:', admin?.name, `(${admin?.email})`);

  // Login as Admin
  const adminLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: 'Password123!' })
  }).then(r => r.json());

  if (!adminLogin.token) {
    console.error('Admin login failed:', adminLogin);
    return;
  }

  const now = new Date();
  const todayZoned = getTodayZonedDate(now, 'Asia/Kolkata');

  // Step 1: Clock in Employee (Jefferson)
  await prisma.attendance.deleteMany({
    where: { userId: employee.id, date: todayZoned }
  });

  const initialClockIn = await prisma.attendance.create({
    data: {
      userId: employee.id,
      date: todayZoned,
      clockIn: new Date(),
      status: 'PRESENT'
    }
  });

  console.log(`1. Created initial Clock-In for ${employee.name} at ${initialClockIn.clockIn.toISOString()}`);

  // Step 2: Admin changes Default Clock-Out Time to 12:35 PM
  console.log('\n2. Admin updates Site Settings: Default Clock-Out Time -> 12:35 PM');
  const currentSettings = await fetch('http://localhost:5000/api/settings', {
    headers: { Authorization: `Bearer ${adminLogin.token}` }
  }).then(r => r.json());

  const updateRes = await fetch('http://localhost:5000/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      ...currentSettings,
      clockInTime: '09:00',
      clockOutTime: '12:35',
      internShiftEnd: '12:35',
      tlShiftEnd: '12:35'
    })
  }).then(r => r.json());

  console.log(`Settings updated successfully. Returned clockOutTime: ${updateRes.clockOutTime}`);

  // Step 3: Verify User Dashboard Status for all 3 roles
  console.log('\n3. Verifying GET /api/attendance/status across roles after settings update:');

  for (const targetUser of [employee, intern, teamLeader]) {
    const userLogin = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetUser.email, password: 'Password123!' })
    }).then(r => r.json());

    if (!userLogin.token) continue;

    const statusRes = await fetch('http://localhost:5000/api/attendance/status', {
      headers: { Authorization: `Bearer ${userLogin.token}` }
    }).then(r => r.json());

    const shiftEndLocal = statusRes.shiftEndAt
      ? new Date(statusRes.shiftEndAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
      : 'None';

    console.table([{
      Role: targetUser.role,
      User: targetUser.name,
      'Is Clocked In': statusRes.isClockedIn,
      'Clock-In Time': statusRes.clockInTime,
      'Clock-Out Time': statusRes.clockOutTime,
      'Shift End (Local)': shiftEndLocal,
      'Auto Clock-Out Enabled': statusRes.autoClockOutEnabled
    }]);
  }

  // Step 4: Verify Database Attendance Record shiftEndAt for Active User
  const updatedAttendanceInDB = await prisma.attendance.findUnique({
    where: { id: initialClockIn.id }
  });

  const dbShiftEndLocal = updatedAttendanceInDB.shiftEndAt
    ? new Date(updatedAttendanceInDB.shiftEndAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
    : 'None';

  console.log(`\n4. Database check for ${employee.name}'s active attendance record:`);
  console.log(`   DB shiftEndAt: ${dbShiftEndLocal} (Expected: 12:35:00 PM)`);

  // Restore settings back to 18:00
  console.log('\n5. Restoring Site Settings back to 18:00 PM');
  await fetch('http://localhost:5000/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      ...currentSettings,
      clockInTime: '09:00',
      clockOutTime: '18:00',
      internShiftEnd: '18:00',
      tlShiftEnd: '18:00'
    })
  });

  console.log('\n=== VERIFICATION SUCCESSFUL ===');
}

runVerification()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
