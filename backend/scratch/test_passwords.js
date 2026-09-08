const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

async function testPasswordMatches() {
  const users = await prisma.user.findMany({
    include: { organization: true }
  });

  console.log('=== TESTING USER PASSWORDS ===\n');

  for (const u of users) {
    const candidates = [];
    if (u.dob) {
      const d = u.dob.toISOString().split('T')[0].split('-');
      candidates.push(`${d[2]}${d[1]}${d[0]}`); // DDMMYYYY
      candidates.push(`${d[0]}${d[1]}${d[2]}`); // YYYYMMDD
    }
    candidates.push('password123');
    candidates.push('Password123!');
    candidates.push('Admin123!');
    candidates.push('SuperAdmin123!');
    if (u.organization?.companyCode) {
      candidates.push(`${u.organization.companyCode}@2026`);
    }
    candidates.push(u.employeeId);
    candidates.push(u.email);

    let matchFound = null;
    for (const c of candidates) {
      if (u.password && await bcrypt.compare(c, u.password)) {
        matchFound = c;
        break;
      }
    }

    console.log(`User: ${u.email} (${u.name}, ${u.role}) -> Password match: ${matchFound ? `✅ "${matchFound}"` : '❌ NONE MATCHED'}`);
  }

  process.exit(0);
}

testPasswordMatches();
