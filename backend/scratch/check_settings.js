const prisma = require('../src/utils/db');

async function check() {
  const s = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
  console.log('=== GLOBAL SystemSettings ===');
  console.log(JSON.stringify(s, null, 2));
  await prisma.$disconnect();
}

check();
