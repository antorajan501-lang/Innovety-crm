const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTeams() {
  const teams = await prisma.team.findMany({
    include: {
      leader: true,
      members: { include: { user: true } },
      projects: true
    }
  });

  console.log(`TOTAL TEAMS IN DB: ${teams.length}`);
  teams.forEach(t => {
    console.log(`\nTeam: ${t.name} (ID: ${t.id})`);
    console.log(`  Leader: ${t.leader ? `${t.leader.name} (org: ${t.leader.organizationId})` : 'None'}`);
    console.log(`  Members (${t.members.length}):`, t.members.map(m => `${m.user?.name} (org: ${m.user?.organizationId})`));
    console.log(`  Projects (${t.projects.length}):`, t.projects.map(p => `${p.name} (org: ${p.organizationId})`));
  });
}

checkTeams().catch(console.error).finally(() => prisma.$disconnect());
