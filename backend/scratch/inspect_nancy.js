const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function inspectNancy() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: 'nancythomasselva@gmail.com', mode: 'insensitive' } },
    include: { organization: true }
  });

  console.log('Nancy User Record:', JSON.stringify(user, null, 2));

  // Test bcrypt passwords
  const testPws = ['password123', 'Password123!', 'Admin123!', '01012004', 'INN001@2026', 'EM-1001'];
  for (const pw of testPws) {
    if (user && user.password) {
      const match = await bcrypt.compare(pw, user.password);
      console.log(`Password "${pw}": ${match ? 'MATCH ✅' : 'NO MATCH ❌'}`);
    }
  }

  process.exit(0);
}

inspectNancy();
