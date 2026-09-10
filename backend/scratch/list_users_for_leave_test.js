const prisma = require('../src/utils/db');

async function listUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, organizationId: true, status: true }
  });
  console.log('Total users in DB:', users.length);
  console.table(users);
}

listUsers().then(() => prisma.$disconnect());
