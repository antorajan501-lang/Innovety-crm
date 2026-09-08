const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAll() {
  const depts = await prisma.departmentMaster.findMany({
    include: {
      users: { select: { id: true, name: true, role: true, organizationId: true } }
    }
  });
  console.log('--- ALL DEPARTMENTS & THEIR USERS ---');
  for (const d of depts) {
    const orgIds = [...new Set(d.users.map(u => u.organizationId))];
    console.log(`Dept: "${d.name}" (${d.code}) ID: ${d.id} | User count: ${d.users.length} | User orgs: ${JSON.stringify(orgIds)}`);
  }

  const positions = await prisma.position.findMany({
    select: { id: true, name: true, code: true, organizationId: true }
  });
  console.log('\n--- ALL POSITIONS ---');
  for (const p of positions) {
    console.log(`Position: "${p.name}" (${p.code}) OrgId: ${p.organizationId}`);
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, organizationId: true, departmentId: true }
  });
  console.log('\n--- ALL USERS ---');
  for (const u of users) {
    console.log(`User: ${u.name} (${u.email}) Role: ${u.role} OrgId: ${u.organizationId} DeptId: ${u.departmentId}`);
  }
}

inspectAll().finally(() => prisma.$disconnect());
