const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditDatabasePositions() {
  console.log('=== PHASE 2: DATABASE INVESTIGATION ===\n');

  const positions = await prisma.position.findMany({
    include: {
      organization: { select: { id: true, name: true, companyCode: true } }
    },
    orderBy: [
      { organizationId: 'asc' },
      { level: 'asc' }
    ]
  });

  console.log(`Total Positions in Database: ${positions.length}\n`);

  console.log('| ID | Position Name | Code | Level | Status | Org ID | Org Name |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');

  for (const pos of positions) {
    console.log(`| ${pos.id} | ${pos.name} | ${pos.code} | ${pos.level} | ${pos.status} | ${pos.organizationId} | ${pos.organization?.name || 'N/A'} |`);
  }
}

auditDatabasePositions().catch(console.error).finally(() => prisma.$disconnect());
