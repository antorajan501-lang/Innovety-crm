const prisma = require('../src/utils/db');

async function inspectTeams() {
  const teams = await prisma.team.findMany({
    include: {
      leader: true,
      members: { include: { user: true } }
    }
  });
  console.log('Total Teams in DB:', teams.length);
  teams.forEach(t => {
    console.log(`Team ID: ${t.id} | Name: ${t.name} | Leader: ${t.leader?.name} (${t.leader?.email}, Role: ${t.leader?.role})`);
    console.log(' Members:');
    t.members.forEach(m => console.log(`   - ${m.user?.name} (${m.user?.email}, Role: ${m.user?.role})`));
  });

  await prisma.$disconnect();
}

inspectTeams();
