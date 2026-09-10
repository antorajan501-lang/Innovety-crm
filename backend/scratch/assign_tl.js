const prisma = require('../src/utils/db');

async function assignTLToTeamBest() {
  const suraj = await prisma.user.findFirst({ where: { email: 'somusuraj72@gmail.com' } });
  if (suraj) {
    await prisma.team.update({
      where: { id: '3026d8be-7850-4cf8-b6a8-a09db14a6aa4' },
      data: { leaderId: suraj.id }
    });
    console.log(`✓ Set ${suraj.name} (${suraj.email}) as leader of team "Best".`);
  }
  await prisma.$disconnect();
}

assignTLToTeamBest();
