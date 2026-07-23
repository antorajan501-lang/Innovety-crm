const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Cleaning up database... Deleting all Intern, Team Leader, and Employee accounts...');
  
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        not: 'ADMIN'
      }
    }
  });

  console.log(`Deleted ${deletedUsers.count} non-admin user records.`);

  const remainingUsers = await prisma.user.findMany({
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      role: true
    }
  });

  console.log('=== REMAINING ADMIN USERS ===');
  for (let u of remainingUsers) {
    console.log(`${u.employeeId} | ${u.name} | ${u.email} | ${u.role}`);
  }

  await prisma.$disconnect();
}

cleanup().catch(console.error);
