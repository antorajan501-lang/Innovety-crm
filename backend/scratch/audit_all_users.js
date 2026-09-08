const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function auditAllUsers() {
  console.log('=== AUDITING ALL USERS IN CRM DATABASE ===\n');

  const users = await prisma.user.findMany({
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          companyCode: true,
          status: true
        }
      }
    }
  });

  console.log(`Total users in system: ${users.length}\n`);

  for (const u of users) {
    console.log(`- User ID: ${u.id}`);
    console.log(`  Name: ${u.name}`);
    console.log(`  Email: ${u.email}`);
    console.log(`  EmployeeId: ${u.employeeId}`);
    console.log(`  Role: ${u.role} | Status: ${u.status}`);
    console.log(`  Organization: ${u.organization?.name || 'None'} (Code: ${u.organization?.companyCode || 'None'}, Status: ${u.organization?.status || 'None'})`);
    console.log(`  Password Hash: ${u.password ? 'Present (bcrpyt)' : 'MISSING'}`);

    // Test common password patterns if present
    const testPasswords = [
      'password123',
      'Password123!',
      'admin123',
      u.organization?.companyCode ? `${u.organization.companyCode}@2026` : null
    ].filter(Boolean);

    let matchedPw = null;
    for (const pw of testPasswords) {
      if (u.password && await bcrypt.compare(pw, u.password)) {
        matchedPw = pw;
        break;
      }
    }

    console.log(`  Password Match Check: ${matchedPw ? `✅ Matches "${matchedPw}"` : '⚠️ Unknown / Custom password'}`);
    console.log('--------------------------------------------------');
  }

  process.exit(0);
}

auditAllUsers().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
