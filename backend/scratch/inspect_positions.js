const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log('Organizations:', orgs.map(o => ({ id: o.id, name: o.name, code: o.companyCode })));

  const positions = await prisma.position.findMany();
  console.log('Positions count:', positions.length);
  console.log('Positions:', positions.map(p => ({ id: p.id, name: p.name, code: p.code, level: p.level, organizationId: p.organizationId })));

  const usersWithPosition = await prisma.user.findMany({
    where: { positionId: { not: null } },
    select: { id: true, email: true, name: true, organizationId: true, positionId: true }
  });
  console.log('Users with position count:', usersWithPosition.length);
  console.log('Users with position:', usersWithPosition);
}

main().catch(console.error).finally(() => prisma.$disconnect());
