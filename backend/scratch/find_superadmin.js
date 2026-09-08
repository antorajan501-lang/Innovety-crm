const prisma = require('../src/utils/db');

async function findSuperAdmin() {
  const users = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, name: true, email: true, role: true }
  });

  console.log('Super Admins:', users);
  process.exit(0);
}

findSuperAdmin();
