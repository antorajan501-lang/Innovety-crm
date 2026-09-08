const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function fixSuperAdminPassword() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  await prisma.user.update({
    where: { email: 'superadmin@enterprise-crm.com' },
    data: { password: hashedPassword }
  });
  console.log('✅ Updated superadmin@enterprise-crm.com password to "password123".');
  process.exit(0);
}

fixSuperAdminPassword();
