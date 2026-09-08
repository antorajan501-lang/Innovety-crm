const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function main() {
  console.log('=== CHECKING USER: john@gmail.com ===\n');

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: 'john@gmail.com', mode: 'insensitive' }
    },
    include: {
      organization: true
    }
  });

  if (!user) {
    console.log('❌ User john@gmail.com does NOT exist in database.');
    console.log('\n--- Listing all users in database ---');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        organization: { select: { id: true, name: true } }
      }
    });
    console.log(JSON.stringify(allUsers, null, 2));
    process.exit(0);
  }

  console.log('Found User:', {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    organization: user.organization?.name,
    passwordHash: user.password
  });

  // Test password 'R001@2026' or 'password123'
  const passwordsToTest = ['R001@2026', 'password123', 'Password123!', 'admin123'];
  for (const pw of passwordsToTest) {
    const isMatch = await bcrypt.compare(pw, user.password);
    console.log(`Bcrypt compare for "${pw}": ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
