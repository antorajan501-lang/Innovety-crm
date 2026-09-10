const path = require('path');
const bcrypt = require(path.resolve(__dirname, '../backend/node_modules/bcrypt'));
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function run() {
  const hashedPassword = await bcrypt.hash('Password123!', 10);
  const emails = [
    'admin@enterprise-crm.com',
    'superadmin@enterprise-crm.com',
    'franklin@mcc.edu.in',
    'somusuraj72@gmail.com',
    'jeffersonsamuel003@gmail.com',
    'antorajan501@gmail.com',
    'nancythomasselva@gmail.com',
    'praveen.natarajan.in@gmail.com'
  ];

  for (const email of emails) {
    await prisma.user.updateMany({
      where: { email },
      data: { password: hashedPassword }
    });
  }
  console.log('Updated passwords for all test users.');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
