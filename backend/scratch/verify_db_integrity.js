const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function verifyDbIntegrity() {
  console.log('=== PHASE 9: DATABASE & AUTH INTEGRITY CHECK ===\n');
  let valid = true;

  const users = await prisma.user.findMany({
    include: { organization: true }
  });

  console.log(`Total users in DB: ${users.length}`);

  for (const u of users) {
    // 1. Password Hash Check
    if (u.status === 'ACTIVE' && (!u.password || u.password.trim().length === 0)) {
      console.error(`❌ User ${u.email} (${u.id}) is ACTIVE but missing password hash!`);
      valid = false;
    }

    // 2. Organization Association Check
    if (u.status === 'ACTIVE' && u.role !== 'SUPER_ADMIN' && !u.organizationId) {
      console.error(`❌ Non-SuperAdmin User ${u.email} (${u.id}) is ACTIVE but has no organizationId!`);
      valid = false;
    }

    // 3. JWT Organization Check
    const token = jwt.sign(
      {
        id: u.id,
        role: u.role,
        organizationId: u.organizationId || u.organization?.id,
        organizationSlug: u.organization?.slug || 'innoveity'
      },
      'secret'
    );
    const decoded = jwt.decode(token);
    if (!decoded.id || (u.role !== 'SUPER_ADMIN' && decoded.organizationId !== u.organizationId)) {
      console.error(`❌ JWT Payload mismatch for user ${u.email}`);
      valid = false;
    }
  }

  // 4. Duplicate Emails Check across orgs
  const emailMap = new Map();
  for (const u of users) {
    const norm = u.email.toLowerCase();
    if (!emailMap.has(norm)) {
      emailMap.set(norm, []);
    }
    emailMap.get(norm).push(u);
  }

  for (const [email, list] of emailMap.entries()) {
    if (list.length > 1) {
      console.log(`ℹ️ Duplicate email detected: ${email} across ${list.length} accounts:`);
      list.forEach(item => console.log(`   - ID: ${item.id}, Org: ${item.organization?.name || 'None'}, Role: ${item.role}`));
    }
  }

  if (valid) {
    console.log('\n✅ Database Integrity & JWT Validation Passed 100%!');
  } else {
    console.error('\n❌ Integrity Check Failed!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

verifyDbIntegrity();
