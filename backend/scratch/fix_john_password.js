const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function main() {
  console.log('=== FIXING PASSWORD FOR john@gmail.com ===\n');

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: 'john@gmail.com', mode: 'insensitive' }
    },
    include: {
      organization: true
    }
  });

  if (!user) {
    console.error('User john@gmail.com not found!');
    process.exit(1);
  }

  console.log('User details:', {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    orgId: user.organizationId,
    orgName: user.organization?.name,
    companyCode: user.organization?.companyCode
  });

  const expectedPassword = user.organization?.companyCode ? `${user.organization.companyCode}@2026` : 'R001@2026';
  console.log(`Setting password for ${user.email} to "${expectedPassword}"...`);

  const hashedPassword = await bcrypt.hash(expectedPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  });

  console.log(`✅ Successfully updated password for ${user.email} to "${expectedPassword}".`);

  // Verify match
  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
  const isMatch = await bcrypt.compare(expectedPassword, updatedUser.password);
  console.log(`Verification check: ${isMatch ? '✅ SUCCESS' : '❌ FAILED'}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
