const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function run() {
  const teams = await prisma.team.findMany({
    include: {
      leader: { select: { name: true, email: true } },
      members: { include: { user: { select: { name: true, email: true, role: true } } } }
    }
  });

  console.log('=== TEAMS & TEAM MEMBERS IN DB ===');
  teams.forEach(t => {
    console.log(`\nTeam: ${t.name} | Leader: ${t.leader?.name} (${t.leader?.email})`);
    console.table(t.members.map(m => ({
      name: m.user?.name,
      email: m.user?.email,
      role: m.user?.role
    })));
  });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
