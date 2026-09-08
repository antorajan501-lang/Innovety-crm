const prisma = require('../src/utils/db');

async function checkAllAdmins() {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'SUPER_ADMIN'] }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organization: { select: { id: true, name: true, companyCode: true } }
    }
  });

  console.log('=== ALL ADMIN USERS IN SYSTEM ===\n');
  console.log(JSON.stringify(admins, null, 2));
  process.exit(0);
}

checkAllAdmins();
