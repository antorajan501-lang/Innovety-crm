const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const positions = await prisma.position.findMany({
    include: { organization: { select: { id: true, name: true } } }
  });
  console.log('Total positions:', positions.length);
  console.log(JSON.stringify(positions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
