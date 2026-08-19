const prisma = require('../src/utils/db');

async function checkAll() {
  const all = await prisma.systemSettings.findMany();
  console.log('All SystemSettings records count:', all.length);
  console.log(JSON.stringify(all, null, 2));
  await prisma.$disconnect();
}

checkAll();
