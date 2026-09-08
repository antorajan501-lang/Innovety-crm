const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillTeams() {
  const innoveityOrg = await prisma.organization.findUnique({ where: { slug: 'innoveity' } });
  if (!innoveityOrg) {
    console.error('INNOVEITY Organization not found!');
    return;
  }

  console.log(`Found INNOVEITY Org: ${innoveityOrg.name} (${innoveityOrg.id})`);

  const updated = await prisma.team.updateMany({
    where: { organizationId: null },
    data: { organizationId: innoveityOrg.id }
  });

  console.log(`Updated ${updated.count} team records with organizationId = ${innoveityOrg.id}`);

  const teams = await prisma.team.findMany({ select: { id: true, name: true, organizationId: true } });
  console.log('Current teams in DB:', teams);
}

backfillTeams().catch(console.error).finally(() => prisma.$disconnect());
