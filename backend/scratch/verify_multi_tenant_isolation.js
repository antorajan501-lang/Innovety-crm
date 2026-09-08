const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runIntegrityCheck() {
  console.log('====================================================');
  console.log('MULTI-TENANT ORGANIZATION ISOLATION INTEGRITY CHECK');
  console.log('====================================================\n');

  const orgs = await prisma.organization.findMany({
    orderBy: { name: 'asc' }
  });

  for (const org of orgs) {
    const depts = await prisma.departmentMaster.findMany({
      where: { organizationId: org.id }
    });

    const members = await prisma.user.findMany({
      where: { organizationId: org.id }
    });

    const positions = await prisma.position.findMany({
      where: { organizationId: org.id }
    });

    console.log(`Company: ${org.name} (ID: ${org.id}, Code: ${org.companyCode})`);
    console.log(`  Departments (${depts.length}):`);
    depts.forEach(d => console.log(`    - ${d.name} (${d.code}) [ID: ${d.id}]`));
    console.log(`  Positions (${positions.length}):`);
    positions.forEach(p => console.log(`    - ${p.name} (${p.code}) [Level ${p.level}]`));
    console.log(`  Members Count: ${members.length}\n`);
  }

  // Detect orphan departments (organizationId is null or references non-existent org)
  console.log('--- DETECTING ORPHAN RECORDS & MISMATCHES ---');
  const orphanDepts = await prisma.departmentMaster.findMany({
    where: {
      OR: [
        { organizationId: null },
        { organization: { is: null } }
      ]
    }
  });

  console.log(`Orphan Departments (no orgId): ${orphanDepts.length}`);
  orphanDepts.forEach(d => console.log(`  - ${d.name} (${d.code})`));

  // Detect orphan positions
  const allPositions = await prisma.position.findMany({ include: { organization: true } });
  const orphanPositions = allPositions.filter(p => !p.organization);

  console.log(`Orphan Positions: ${orphanPositions.length}`);
  orphanPositions.forEach(p => console.log(`  - ${p.name} (${p.code})`));

  // Detect users assigned to wrong organization (e.g. user.organizationId !== department.organizationId)
  const usersWithDepts = await prisma.user.findMany({
    where: {
      departmentId: { not: null }
    },
    include: {
      departmentRef: true,
      organization: true
    }
  });

  const mismatchedUsers = usersWithDepts.filter(u => {
    if (!u.departmentRef?.organizationId) return false;
    return u.departmentRef.organizationId !== u.organizationId;
  });

  console.log(`Users Assigned to Wrong Organization Department: ${mismatchedUsers.length}`);
  mismatchedUsers.forEach(u => {
    console.log(`  - User ${u.name} (${u.email}) [Org: ${u.organization?.name}] is in Dept "${u.departmentRef?.name}" [Dept OrgId: ${u.departmentRef?.organizationId}]`);
  });

  // Detect users assigned to position of different org
  const usersWithPositions = await prisma.user.findMany({
    where: { positionId: { not: null } },
    include: { position: true, organization: true }
  });

  const mismatchedPositions = usersWithPositions.filter(u => {
    if (!u.position?.organizationId) return false;
    return u.position.organizationId !== u.organizationId;
  });

  console.log(`Users Assigned to Wrong Organization Position: ${mismatchedPositions.length}`);
  mismatchedPositions.forEach(u => {
    console.log(`  - User ${u.name} (${u.email}) [Org: ${u.organization?.name}] has Position "${u.position?.name}" [Position OrgId: ${u.position?.organizationId}]`);
  });

  console.log('\n====================================================');
  console.log('INTEGRITY CHECK COMPLETE');
  console.log('====================================================');
}

runIntegrityCheck().finally(() => prisma.$disconnect());
