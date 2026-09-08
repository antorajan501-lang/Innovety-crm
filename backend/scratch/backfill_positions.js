const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const innoveity = await prisma.organization.findFirst({
    where: { name: { contains: 'INNOVEITY', mode: 'insensitive' } }
  });

  if (!innoveity) {
    console.error('INNOVEITY organization not found!');
    return;
  }

  const unassignedPositions = await prisma.position.findMany({
    where: { organizationId: null }
  });

  console.log(`Found ${unassignedPositions.length} unassigned positions.`);

  for (const pos of unassignedPositions) {
    // Check users assigned to this position
    const user = await prisma.user.findFirst({
      where: { positionId: pos.id, organizationId: { not: null } },
      select: { organizationId: true }
    });

    const targetOrgId = user?.organizationId || innoveity.id;
    await prisma.position.update({
      where: { id: pos.id },
      data: { organizationId: targetOrgId }
    });
    console.log(`Updated position ${pos.name} (${pos.code}) -> organizationId: ${targetOrgId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
