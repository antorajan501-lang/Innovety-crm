const prisma = require('./backend/src/utils/db');
const bcrypt = require('bcryptjs');

async function testPass() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['vedha@gmail.com', 'admin@enterprise-crm.com'] } }
  });

  for (const u of users) {
    const isPass123 = await bcrypt.compare('password123', u.password);
    const isAdmin123 = await bcrypt.compare('admin123', u.password);
    console.log(`User ${u.name} (${u.email}): password123=${isPass123}, admin123=${isAdmin123}`);
  }
}

testPass().finally(() => prisma.$disconnect());
