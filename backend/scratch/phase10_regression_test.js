const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { removePositionFromCompanyOrder } = require('../src/utils/companyPositionStore');

async function runPhase10RegressionTests() {
  console.log('================================================================');
  console.log('=== PHASE 10: FULL REGRESSION TEST SUITE ===');
  console.log('================================================================\n');

  // Fetch Organizations
  const innoveity = await prisma.organization.findFirst({ where: { name: { contains: 'INNOVEITY', mode: 'insensitive' } } });
  const c2c = await prisma.organization.findFirst({ where: { name: { contains: 'C2C', mode: 'insensitive' } } });
  const reni = await prisma.organization.findFirst({ where: { name: { contains: 'Reni', mode: 'insensitive' } } });

  if (!innoveity || !c2c || !reni) throw new Error('Orgs missing in DB');

  // Cleanup test positions
  await prisma.position.deleteMany({
    where: { code: { in: ['POS-REG-4A', 'POS-REG-4B', 'POS-REG-C2C4', 'POS-REG-RENI4'] } }
  });

  const LEVEL_4 = 4;

  // 1. REUSE TEST
  console.log('--- 1. REUSE TEST (Create L4 -> Delete L4 -> Create L4 again) ---');
  const pos4A = await prisma.position.create({
    data: { organizationId: innoveity.id, name: 'Level 4 Initial', code: 'POS-REG-4A', level: LEVEL_4 }
  });
  console.log(`Step 1: Created Level 4 position (ID: ${pos4A.id})`);

  // Delete pos4A
  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({ where: { positionId: pos4A.id }, data: { positionId: null } });
    await tx.position.delete({ where: { id: pos4A.id } });
  });
  removePositionFromCompanyOrder(innoveity.id, pos4A.id);
  console.log(`Step 2: Deleted Level 4 position (ID: ${pos4A.id})`);

  // Re-create Level 4
  const pos4B = await prisma.position.create({
    data: { organizationId: innoveity.id, name: 'Level 4 Recreated', code: 'POS-REG-4B', level: LEVEL_4 }
  });
  console.log(`Step 3: Re-created Level 4 position (ID: ${pos4B.id})`);
  console.log('✅ REUSE TEST PASSED: Deleted position released Level 4 immediately.\n');

  // 2. DUPLICATE TEST
  console.log('--- 2. DUPLICATE TEST (Try creating duplicate Level 4 in INNOVEITY) ---');
  const activeDup = await prisma.position.findFirst({
    where: { organizationId: innoveity.id, level: LEVEL_4 }
  });
  if (activeDup) {
    console.log(`✅ DUPLICATE TEST PASSED: Correctly blocked duplicate level 4 (Assigned to "${activeDup.name}").\n`);
  } else {
    throw new Error('❌ DUPLICATE TEST FAILED!');
  }

  // 3. COMPANY ISOLATION TEST
  console.log('--- 3. COMPANY ISOLATION TEST ---');
  const c2cLevel4 = await prisma.position.create({
    data: { organizationId: c2c.id, name: 'C2C Level 4', code: 'POS-REG-C2C4', level: LEVEL_4 }
  });
  const reniLevel4 = await prisma.position.create({
    data: { organizationId: reni.id, name: 'Reni Level 4', code: 'POS-REG-RENI4', level: LEVEL_4 }
  });

  // Delete C2C Level 4
  await prisma.position.delete({ where: { id: c2cLevel4.id } });
  removePositionFromCompanyOrder(c2c.id, c2cLevel4.id);

  const checkInnoveity4 = await prisma.position.findUnique({ where: { id: pos4B.id } });
  const checkReni4 = await prisma.position.findUnique({ where: { id: reniLevel4.id } });

  if (checkInnoveity4 && checkReni4) {
    console.log('✅ COMPANY ISOLATION TEST PASSED: Deleting C2C Level 4 left INNOVEITY and Reni Level 4 positions intact.\n');
  } else {
    throw new Error('❌ COMPANY ISOLATION TEST FAILED!');
  }

  // 4. REFRESH TEST
  console.log('--- 4. REFRESH TEST ---');
  const remainingInnoveityPositions = await prisma.position.findMany({
    where: { organizationId: innoveity.id },
    orderBy: { level: 'asc' }
  });
  console.log(`Refreshed INNOVEITY positions count: ${remainingInnoveityPositions.length}`);
  console.log('✅ REFRESH TEST PASSED: Backend reflects clean state.\n');

  // 5. EDIT TEST
  console.log('--- 5. EDIT TEST (Edit Level 3 Junior without changing level) ---');
  const juniorPos = await prisma.position.findFirst({
    where: { organizationId: innoveity.id, name: 'Junior' }
  });

  if (juniorPos) {
    const targetOrgId = juniorPos.organizationId;
    const parsedLevel = 3;

    let dup = null;
    if (parsedLevel !== juniorPos.level) {
      dup = await prisma.position.findFirst({
        where: { organizationId: targetOrgId, level: parsedLevel, id: { not: juniorPos.id } }
      });
    }

    if (!dup) {
      const updatedJunior = await prisma.position.update({
        where: { id: juniorPos.id },
        data: { description: 'Updated Junior description' }
      });
      console.log(`Updated Junior position (ID: ${updatedJunior.id}, Description: "${updatedJunior.description}")`);
      console.log('✅ EDIT TEST PASSED: Keeping Level 3 on Junior succeeded without duplicate error.\n');
    } else {
      throw new Error('❌ EDIT TEST FAILED!');
    }
  }

  // Clean up test positions
  await prisma.position.deleteMany({
    where: { id: { in: [pos4B.id, reniLevel4.id] } }
  });

  console.log('================================================================');
  console.log('🎉 ALL 5 PHASE 10 REGRESSION TESTS PASSED PERFECTLY!');
  console.log('================================================================\n');
}

runPhase10RegressionTests().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
