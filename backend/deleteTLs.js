const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.deleteMany({ where: { role: 'TEAM_LEADER' } })
  .then(r => {
    console.log('Deleted ' + r.count + ' TEAM_LEADER(s).');
    return prisma.user.findMany({ select: { employeeId: true, name: true, role: true } });
  })
  .then(users => {
    console.log('Remaining users:');
    users.forEach(u => console.log('  ' + u.employeeId + ' | ' + u.name + ' | ' + u.role));
  })
  .catch(e => console.error(e.message))
  .finally(() => prisma.$disconnect());
