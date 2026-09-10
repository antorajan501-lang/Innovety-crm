const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function check() {
  const sysSettings = await prisma.systemSettings.findMany();
  console.log('=== SYSTEM SETTINGS ===');
  console.table(sysSettings.map(s => ({
    id: s.id,
    orgId: s.organizationId,
    clockIn: s.clockInTime,
    clockOut: s.clockOutTime,
    autoClockOut: s.autoClockOutEnabled
  })));

  const orgSettings = await prisma.organizationSettings.findMany();
  console.log('=== ORGANIZATION SETTINGS ===');
  console.table(orgSettings.map(o => ({
    id: o.id,
    orgId: o.organizationId,
    companyName: o.companyName,
    clockIn: o.clockInTime,
    clockOut: o.clockOutTime,
    autoClockOut: o.autoClockOutEnabled
  })));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
