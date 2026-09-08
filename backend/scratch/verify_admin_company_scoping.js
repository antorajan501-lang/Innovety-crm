const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!';

const ORGS = [
  { name: 'All Companies', id: 'all' },
  { name: 'INNOVEITY Workspace', id: 'cmteaqlih0000sj52wckjbgci' },
  { name: 'C2C Global Portal', id: 'cmtgsp8710000bb94ztamcrue' },
  { name: 'Reni', id: 'cmtil10ie0001sg5eo2jfx4ew' }
];

async function runAdminScopingVerification() {
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) {
    console.error('No Super Admin found in DB!');
    return;
  }

  const token = jwt.sign(
    { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = { Authorization: `Bearer ${token}` };

  console.log('====================================================');
  console.log('   ADMIN SCOPING VERIFICATION MATRIX TEST REPORT   ');
  console.log('====================================================\n');

  for (const org of ORGS) {
    console.log(`>>> TESTING ADMINS FOR SCOPE: ${org.name} (${org.id})`);
    
    const adminsRes = await axios.get(`${API_BASE}/super-admin/admins?organizationId=${org.id}`, { headers });
    const admins = adminsRes.data;
    console.log(`  Admins Count: ${admins.length}`);
    if (admins.length === 0) {
      console.log(`    -> Verified Empty State ("No administrator accounts found for ${org.name}")`);
    } else {
      admins.forEach((a, i) => {
        console.log(`    Admin ${i + 1}: ${a.name} (${a.email}) [Role: ${a.role}] -> Company: ${a.organization?.name || 'Global/Platform'}`);
      });
    }
    console.log('----------------------------------------------------\n');
  }
}

runAdminScopingVerification().catch(err => {
  console.error('Admin Scoping Verification Error:', err.response?.data || err.message);
}).finally(() => prisma.$disconnect());
