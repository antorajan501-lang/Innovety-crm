const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugDeleteAndCreate() {
  console.log('=== DEBUG DELETE & RE-CREATE HIERARCHY LEVEL 3 ===\n');

  const innoveity = await prisma.organization.findFirst({ where: { name: { contains: 'INNOVEITY', mode: 'insensitive' } } });
  if (!innoveity) throw new Error('INNOVEITY org not found');

  console.log(`INNOVEITY Org ID: ${innoveity.id}`);

  // Step 0: Check current positions in INNOVEITY
  const currentPositions = await prisma.position.findMany({
    where: { organizationId: innoveity.id }
  });
  console.log('Current INNOVEITY Positions:', currentPositions.map(p => ({ id: p.id, name: p.name, code: p.code, level: p.level, status: p.status })));

  // Clean up any test positions
  await prisma.position.deleteMany({
    where: { organizationId: innoveity.id, code: { in: ['POS-TEST-L3-A', 'POS-TEST-L3-B'] } }
  });

  // Step 1: Create Position A with Level 55
  console.log('\n--- Step 1: Creating Position A (Level 55) ---');
  const posA = await prisma.position.create({
    data: {
      organizationId: innoveity.id,
      name: 'Test Pos Level 55 A',
      code: 'POS-TEST-L3-A',
      level: 55
    }
  });
  console.log(`Created Pos A: ID = ${posA.id}, Level = ${posA.level}`);

  // Step 2: Delete Position A
  console.log('\n--- Step 2: Deleting Position A ---');
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { positionId: posA.id, organizationId: innoveity.id },
      data: { positionId: null }
    });
    await tx.position.delete({
      where: { id: posA.id }
    });
  });
  console.log(`Deleted Pos A: ${posA.id}`);

  // Verify Pos A is gone from DB
  const checkA = await prisma.position.findUnique({ where: { id: posA.id } });
  console.log(`Pos A in DB after delete: ${checkA ? 'EXISTS (FAILED DELETE)' : 'NULL (DELETED)'}`);

  // Step 3: Try creating Position B with Level 55
  console.log('\n--- Step 3: Creating Position B with Level 55 ---');
  const existingLevel = await prisma.position.findFirst({
    where: {
      organizationId: innoveity.id,
      level: 55,
      status: { not: 'DELETED' } // checking active/existing
    }
  });

  if (existingLevel) {
    console.error(`❌ Duplicate check found record: ID = ${existingLevel.id}, name = ${existingLevel.name}, status = ${existingLevel.status}`);
  } else {
    const posB = await prisma.position.create({
      data: {
        organizationId: innoveity.id,
        name: 'Test Pos Level 55 B',
        code: 'POS-TEST-L3-B',
        level: 55
      }
    });
    console.log(`✅ Successfully Created Pos B with Level 55: ID = ${posB.id}`);
    await prisma.position.delete({ where: { id: posB.id } });
  }
}

debugDeleteAndCreate().catch(console.error).finally(() => prisma.$disconnect());
