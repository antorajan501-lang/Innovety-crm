const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    where: { role: 'INTERN' },
    select: { employeeId: true, name: true, email: true, profilePic: true },
    orderBy: { employeeId: 'asc' }
  });

  console.log('=== EXACT CURRENT DB RECORDS ===');
  for (let u of users) {
    console.log(`${u.employeeId} | ${u.name} | ${u.email} -> "${u.profilePic}"`);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
