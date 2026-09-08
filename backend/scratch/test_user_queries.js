const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function testUserCredentials() {
  console.log('=== TESTING USER LOGIN QUERY RESOLUTION ===\n');

  const users = await prisma.user.findMany({
    include: { organization: true }
  });

  for (const u of users) {
    // 1. Exact Email Query Test
    const foundByEmail = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: u.email, mode: 'insensitive' } },
          { employeeId: { equals: u.email, mode: 'insensitive' } },
          { id: { equals: u.email } }
        ]
      },
      include: { organization: true }
    });

    if (foundByEmail && foundByEmail.id === u.id) {
      console.log(`✅ Exact match for ${u.email} -> Resolved User ID ${u.id} (${u.name}, Org: ${u.organization?.name})`);
    } else {
      console.error(`❌ MISMATCH for ${u.email} -> Resolved wrong user: ${foundByEmail?.email}`);
    }
  }

  process.exit(0);
}

testUserCredentials();
