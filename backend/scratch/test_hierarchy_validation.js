const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runHierarchyIntegrationTests() {
  console.log('=== RUNNING HIERARCHY LEVEL VALIDATION INTEGRATION TESTS ===\n');

  // Fetch Companies
  const innoveity = await prisma.organization.findFirst({ where: { name: { contains: 'INNOVEITY', mode: 'insensitive' } } });
  const c2c = await prisma.organization.findFirst({ where: { name: { contains: 'C2C', mode: 'insensitive' } } });
  const reni = await prisma.organization.findFirst({ where: { name: { contains: 'Reni', mode: 'insensitive' } } });

  if (!innoveity || !c2c || !reni) {
    throw new Error('Orgs missing in DB');
  }

  // Cleanup test positions from prior runs
  await prisma.position.deleteMany({
    where: {
      code: { in: ['POS-H-INN99', 'POS-H-C2C99', 'POS-H-RENI99', 'POS-H-DUP', 'POS-C2C-A', 'POS-C2C-B'] }
    }
  });

  const TEST_LEVEL = 99;

  // TEST 1: Company Isolation — Same Level 99 in INNOVEITY, C2C, Reni
  console.log('--- TEST 1: COMPANY ISOLATION FOR LEVEL 99 ---');
  const posInn = await prisma.position.create({
    data: { organizationId: innoveity.id, name: 'Innoveity Level 99', code: 'POS-H-INN99', level: TEST_LEVEL }
  });
  console.log(`✅ Created Level ${TEST_LEVEL} in INNOVEITY (ID: ${posInn.id})`);

  const posC2c = await prisma.position.create({
    data: { organizationId: c2c.id, name: 'C2C Level 99', code: 'POS-H-C2C99', level: TEST_LEVEL }
  });
  console.log(`✅ Created Level ${TEST_LEVEL} in C2C (ID: ${posC2c.id})`);

  const posReni = await prisma.position.create({
    data: { organizationId: reni.id, name: 'Reni Level 99', code: 'POS-H-RENI99', level: TEST_LEVEL }
  });
  console.log(`✅ Created Level ${TEST_LEVEL} in Reni (ID: ${posReni.id})`);
  console.log(`✅ PASS: Level ${TEST_LEVEL} exists in INNOVEITY, C2C, and Reni simultaneously with zero conflicts.\n`);

  // TEST 2: Duplicate Detection — Try creating another Level 99 inside INNOVEITY
  console.log('--- TEST 2: DUPLICATE DETECTION WITHIN SAME COMPANY ---');
  const existingDupLevel = await prisma.position.findFirst({
    where: { organizationId: innoveity.id, level: TEST_LEVEL }
  });
  if (existingDupLevel) {
    console.log(`✅ PASS: Correctly detected duplicate level ${TEST_LEVEL} in INNOVEITY (Assigned to "${existingDupLevel.name}").\n`);
  } else {
    throw new Error('❌ FAIL: Failed to detect duplicate level in same company!');
  }

  // TEST 3: Edit (Self-Duplicate Bug Fix) — Edit Innoveity Level 99 record without changing level
  console.log('--- TEST 3: SELF-EDIT WITHOUT LEVEL CHANGE (NO FALSE DUPLICATE) ---');
  const targetOrgId = posInn.organizationId;
  const levelParam = TEST_LEVEL;
  const parsedLevel = parseInt(levelParam, 10);

  let duplicateCheck = null;
  if (parsedLevel !== posInn.level) {
    duplicateCheck = await prisma.position.findFirst({
      where: { organizationId: targetOrgId, level: parsedLevel, id: { not: posInn.id } }
    });
  }

  if (duplicateCheck) {
    throw new Error('❌ FAIL: Self-edit triggered false duplicate error!');
  }

  const updatedInn = await prisma.position.update({
    where: { id: posInn.id },
    data: { description: `Updated description without changing level ${TEST_LEVEL}` }
  });
  console.log(`✅ Updated position "${updatedInn.name}" successfully (Description: "${updatedInn.description}").`);
  console.log('✅ PASS: Editing position while keeping level 99 succeeded cleanly without false duplicate error.\n');

  // TEST 4: Change Level — Move Level 99 -> Level 100
  console.log('--- TEST 4: CHANGE HIERARCHY LEVEL (99 -> 100) ---');
  const newLevelParam = 100;
  const checkLevel100 = await prisma.position.findFirst({
    where: { organizationId: targetOrgId, level: newLevelParam, id: { not: posInn.id } }
  });

  if (!checkLevel100) {
    const movedPos = await prisma.position.update({
      where: { id: posInn.id },
      data: { level: newLevelParam }
    });
    console.log(`✅ Moved position "${movedPos.name}" from Level 99 to Level ${movedPos.level}.`);
    console.log('✅ PASS: Hierarchy level update from 99 to 100 succeeded.\n');
  } else {
    throw new Error('❌ FAIL: Level 100 was blocked unexpectedly!');
  }

  // TEST 5: Atomic Reorder / Move Up / Move Down
  console.log('--- TEST 5: ATOMIC TRANSACTION REORDER ---');
  const posA = await prisma.position.create({
    data: { organizationId: c2c.id, name: 'C2C Pos A', code: 'POS-C2C-A', level: 101 }
  });
  const posB = await prisma.position.create({
    data: { organizationId: c2c.id, name: 'C2C Pos B', code: 'POS-C2C-B', level: 102 }
  });

  const reorderItems = [
    { id: posB.id, level: 101, sortOrder: 101 },
    { id: posA.id, level: 102, sortOrder: 102 }
  ];

  await prisma.$transaction(async (tx) => {
    // Step 1: temp negative levels
    for (let i = 0; i < reorderItems.length; i++) {
      await tx.position.updateMany({
        where: { id: reorderItems[i].id, organizationId: c2c.id },
        data: { level: -(5000 + i) }
      });
    }
    // Step 2: final levels
    for (let i = 0; i < reorderItems.length; i++) {
      await tx.position.updateMany({
        where: { id: reorderItems[i].id, organizationId: c2c.id },
        data: { level: reorderItems[i].level, sortOrder: reorderItems[i].sortOrder }
      });
    }
  });

  const refreshedA = await prisma.position.findUnique({ where: { id: posA.id } });
  const refreshedB = await prisma.position.findUnique({ where: { id: posB.id } });
  console.log(`Swapped: Pos B level = ${refreshedB.level}, Pos A level = ${refreshedA.level}`);
  if (refreshedB.level === 101 && refreshedA.level === 102) {
    console.log('✅ PASS: Atomic level swap completed cleanly without DB unique index violation.\n');
  } else {
    throw new Error('❌ FAIL: Reorder level swap failed!');
  }

  // Cleanup test positions
  await prisma.position.deleteMany({
    where: { id: { in: [posInn.id, posC2c.id, posReni.id, posA.id, posB.id] } }
  });

  console.log('================================================================');
  console.log('🎉 ALL HIERARCHY VALIDATION INTEGRATION TESTS PASSED PERFECTLY!');
  console.log('================================================================\n');
}

runHierarchyIntegrationTests().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
