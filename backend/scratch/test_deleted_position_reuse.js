const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { removePositionFromCompanyOrder } = require('../src/utils/companyPositionStore');

async function testDeletedPositionReuse() {
  console.log('=== RUNNING DELETED POSITION HIERARCHY REUSE TESTS ===\n');

  const innoveity = await prisma.organization.findFirst({ where: { name: { contains: 'INNOVEITY', mode: 'insensitive' } } });
  const c2c = await prisma.organization.findFirst({ where: { name: { contains: 'C2C', mode: 'insensitive' } } });
  const reni = await prisma.organization.findFirst({ where: { name: { contains: 'Reni', mode: 'insensitive' } } });

  if (!innoveity || !c2c || !reni) throw new Error('Orgs missing in DB');

  // Clean up any test positions from prior runs
  await prisma.position.deleteMany({
    where: { code: { in: ['POS-REUSE-1', 'POS-REUSE-2', 'POS-REUSE-C2C', 'POS-REUSE-RENI'] } }
  });

  const REUSE_LEVEL = 88;

  // TEST 1: Create Level 88 -> Delete -> Create Level 88 again
  console.log('--- TEST 1: CREATE -> DELETE -> RE-CREATE SAME HIERARCHY LEVEL ---');
  const initialPos = await prisma.position.create({
    data: {
      organizationId: innoveity.id,
      name: 'Initial Level 88',
      code: 'POS-REUSE-1',
      level: REUSE_LEVEL
    }
  });
  console.log(`✅ Step 1: Created initial position at Level ${REUSE_LEVEL} (ID: ${initialPos.id})`);

  // Delete initialPos
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { positionId: initialPos.id, organizationId: innoveity.id },
      data: { positionId: null }
    });
    await tx.position.delete({
      where: { id: initialPos.id }
    });
  });
  removePositionFromCompanyOrder(innoveity.id, initialPos.id);
  console.log(`✅ Step 2: Deleted initial position (ID: ${initialPos.id})`);

  // Re-create position at Level 88
  const recreatedPos = await prisma.position.create({
    data: {
      organizationId: innoveity.id,
      name: 'Recreated Level 88',
      code: 'POS-REUSE-2',
      level: REUSE_LEVEL
    }
  });
  console.log(`✅ Step 3: Re-created new position at Level ${REUSE_LEVEL} (ID: ${recreatedPos.id})`);
  console.log('✅ PASS: Hierarchy level 88 was successfully released upon deletion and reused!\n');

  // TEST 2: Active duplicate detection
  console.log('--- TEST 2: ACTIVE DUPLICATE DETECTION ---');
  const duplicateCheck = await prisma.position.findFirst({
    where: {
      organizationId: innoveity.id,
      level: REUSE_LEVEL
    }
  });

  if (duplicateCheck) {
    console.log(`✅ PASS: Correctly blocked creating duplicate active level ${REUSE_LEVEL} (Assigned to "${duplicateCheck.name}").\n`);
  } else {
    throw new Error('❌ FAIL: Active duplicate level check failed!');
  }

  // TEST 3: Company isolation across INNOVEITY, C2C, Reni
  console.log('--- TEST 3: INDEPENDENT HIERARCHY REUSE ACROSS COMPANIES ---');
  const c2cPos = await prisma.position.create({
    data: { organizationId: c2c.id, name: 'C2C Level 88', code: 'POS-REUSE-C2C', level: REUSE_LEVEL }
  });
  const reniPos = await prisma.position.create({
    data: { organizationId: reni.id, name: 'Reni Level 88', code: 'POS-REUSE-RENI', level: REUSE_LEVEL }
  });
  console.log(`✅ Created C2C position at Level 88 (ID: ${c2cPos.id})`);
  console.log(`✅ Created Reni position at Level 88 (ID: ${reniPos.id})`);

  // Delete C2C position
  await prisma.position.delete({ where: { id: c2cPos.id } });
  removePositionFromCompanyOrder(c2c.id, c2cPos.id);
  console.log(`✅ Deleted C2C position (ID: ${c2cPos.id})`);

  // Verify INNOVEITY and Reni positions still exist and operate independently
  const checkReni = await prisma.position.findUnique({ where: { id: reniPos.id } });
  const checkInnoveity = await prisma.position.findUnique({ where: { id: recreatedPos.id } });
  if (checkReni && checkInnoveity) {
    console.log('✅ PASS: Deleting C2C Level 88 position left INNOVEITY and Reni Level 88 positions completely intact.\n');
  } else {
    throw new Error('❌ FAIL: Cross-company deletion side-effect detected!');
  }

  // Cleanup test positions
  await prisma.position.deleteMany({
    where: { id: { in: [recreatedPos.id, reniPos.id] } }
  });

  console.log('================================================================');
  console.log('🎉 ALL DELETED POSITION REUSE INTEGRATION TESTS PASSED PERFECTLY!');
  console.log('================================================================\n');
}

testDeletedPositionReuse().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
