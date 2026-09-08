const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWorkforce() {
  const orgs = await prisma.organization.findMany();
  console.log("ORGANIZATIONS FOUND:", orgs.map(o => ({ id: o.id, name: o.name, slug: o.slug, code: o.companyCode })));

  for (const org of orgs) {
    const users = await prisma.user.findMany({
      where: { organizationId: org.id },
      select: { id: true, name: true, email: true, role: true, status: true, organizationId: true }
    });

    const breakdown = {
      total: users.length,
      activeTotal: users.filter(u => u.status === 'ACTIVE').length,
      employees: users.filter(u => u.role === 'EMPLOYEE').length,
      interns: users.filter(u => u.role === 'INTERN').length,
      teamLeaders: users.filter(u => u.role === 'TEAM_LEADER').length,
      admins: users.filter(u => u.role === 'ADMIN').length,
      superAdmins: users.filter(u => u.role === 'SUPER_ADMIN').length
    };

    console.log(`\n--- Org: ${org.name} (${org.id}) [${org.slug}] ---`);
    console.log("Breakdown:", breakdown);
    console.log("Users:", users.map(u => `${u.name} (${u.role}, ${u.status})`));
  }

  // Users without organizationId
  const nullOrgUsers = await prisma.user.findMany({
    where: { organizationId: null },
    select: { id: true, name: true, email: true, role: true, status: true }
  });
  console.log(`\n--- Users without organizationId (${nullOrgUsers.length}) ---`);
  console.log(nullOrgUsers);
}

checkWorkforce().catch(console.error).finally(() => prisma.$disconnect());
