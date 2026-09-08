const prisma = require('./src/utils/db');

async function backfill() {
  console.log('Starting organizationId backfill...');

  // 1. Backfill SalaryStructure
  const structures = await prisma.salaryStructure.findMany({
    include: { user: true }
  });
  console.log(`Found ${structures.length} salary structures.`);
  for (const s of structures) {
    const orgId = s.user?.organizationId || null;
    if (orgId && s.organizationId !== orgId) {
      await prisma.salaryStructure.update({
        where: { id: s.id },
        data: { organizationId: orgId }
      });
      console.log(`Updated SalaryStructure ${s.id} with orgId ${orgId}`);
    }
  }

  // 2. Backfill SalaryRevision
  const revisions = await prisma.salaryRevision.findMany({
    include: { user: true }
  });
  console.log(`Found ${revisions.length} salary revisions.`);
  for (const r of revisions) {
    const orgId = r.user?.organizationId || null;
    if (orgId && r.organizationId !== orgId) {
      await prisma.salaryRevision.update({
        where: { id: r.id },
        data: { organizationId: orgId }
      });
      console.log(`Updated SalaryRevision ${r.id} with orgId ${orgId}`);
    }
  }

  // 3. Backfill HolidayCalendar
  const defaultOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  const holidays = await prisma.holidayCalendar.findMany();
  console.log(`Found ${holidays.length} holidays.`);
  for (const h of holidays) {
    if (!h.organizationId && defaultOrg) {
      await prisma.holidayCalendar.update({
        where: { id: h.id },
        data: { organizationId: defaultOrg.id }
      });
      console.log(`Updated Holiday ${h.id} (${h.title}) with orgId ${defaultOrg.id}`);
    }
  }

  console.log('Backfill completed successfully.');
}

backfill()
  .catch(err => {
    console.error('Backfill error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
