const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteInternsAndTLs() {
  console.log('Deleting all INTERNs and TEAM_LEADERs from the database...\n');

  // First, nullify leaderId on teams where the leader is a TL (to avoid FK constraint issues)
  const tlUsers = await prisma.user.findMany({
    where: { role: { in: ['INTERN', 'TEAM_LEADER'] } },
    select: { id: true, name: true, role: true, employeeId: true }
  });

  console.log(`Found ${tlUsers.length} user(s) to delete:`);
  for (const u of tlUsers) {
    console.log(`  - [${u.role}] ${u.employeeId} | ${u.name}`);
  }

  const userIds = tlUsers.map(u => u.id);

  // Unset leaderId on any team led by these users
  const teamsUpdated = await prisma.team.updateMany({
    where: { leaderId: { in: userIds } },
    data: { leaderId: null }
  });
  console.log(`\nUnset leaderId on ${teamsUpdated.count} team(s).`);

  // Delete the users (cascades handle attendance, tasks, tickets, notifications, etc.)
  const deleted = await prisma.user.deleteMany({
    where: { role: { in: ['INTERN', 'TEAM_LEADER'] } }
  });

  console.log(`\n✅ Deleted ${deleted.count} user(s) (INTERNs + TEAM_LEADERs).`);

  // Show remaining users
  const remaining = await prisma.user.findMany({
    select: { employeeId: true, name: true, email: true, role: true }
  });

  console.log('\n=== REMAINING USERS ===');
  for (const u of remaining) {
    console.log(`  ${u.employeeId} | ${u.name} | ${u.email} | ${u.role}`);
  }

  await prisma.$disconnect();
}

deleteInternsAndTLs().catch(async (e) => {
  console.error('Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
