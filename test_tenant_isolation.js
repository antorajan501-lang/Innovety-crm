const prisma = require('./backend/src/utils/db');

async function test() {
  console.log('=== MULTI-TENANT ISOLATION SECURITY AUDIT TEST ===\n');

  // 1. List Organizations
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true, companyCode: true } });
  console.log('Organizations in DB:');
  console.table(orgs);

  // 2. Find Users for each Org
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });
  console.log('\nAdmin Users:');
  console.table(admins);

  // 3. Test Payroll Settings per Org
  for (const org of orgs) {
    const settings = await prisma.payrollSettings.findFirst({ where: { organizationId: org.id } });
    console.log(`\nPayroll Settings for ${org.name} (${org.id}):`);
    console.log(`  Company Name in Settings: "${settings?.companyName}"`);
    console.log(`  Cycle Start: ${settings?.cycleStartDay}, Pay Date: ${settings?.payDay}, Currency: ${settings?.currency}`);
  }

  // 4. Test Payroll Batches per Org
  const batches = await prisma.payrollBatch.findMany({
    select: { id: true, month: true, year: true, status: true, organizationId: true, totalGross: true, totalNet: true }
  });
  console.log('\nPayroll Batches in DB:');
  console.table(batches);

  // 5. Test Holidays per Org
  const holidays = await prisma.holidayCalendar.findMany({
    select: { id: true, title: true, date: true, organizationId: true }
  });
  console.log('\nHolidays in DB:');
  console.table(holidays);

  // 6. Test Activity Logs per Org
  const logsCount = await prisma.activityLog.groupBy({
    by: ['organizationId'],
    _count: true
  });
  console.log('\nActivity Logs Count by Organization:');
  console.table(logsCount);

  console.log('\n=== DB INTEGRITY AUDIT COMPLETE ===');
}

test()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
