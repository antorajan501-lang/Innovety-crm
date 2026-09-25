const prisma = require('../backend/src/utils/db');

async function run() {
  const settings = await prisma.organizationSettings.findMany();
  for (const s of settings) {
    if (s.leavePolicy) {
      console.log('Org:', s.organizationId);
      console.log(JSON.stringify(s.leavePolicy, null, 2));
    }
  }
}

run().finally(() => prisma.$disconnect());
