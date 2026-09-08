const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'enterprise_internship_crm_super_secret_jwt_key_123!';

const ORGS = [
  { name: 'INNOVEITY Workspace', id: 'cmteaqlih0000sj52wckjbgci' },
  { name: 'C2C Global Portal', id: 'cmtgsp8710000bb94ztamcrue' },
  { name: 'Reni', id: 'cmtil10ie0001sg5eo2jfx4ew' }
];

async function runVerification() {
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
  console.log('   COMPANY SCOPING VERIFICATION MATRIX TEST REPORT   ');
  console.log('====================================================\n');

  for (const org of ORGS) {
    console.log(`>>> TESTING ORGANIZATION: ${org.name} (${org.id})`);
    
    // 1. Test /super-admin/stats?organizationId=...
    const statsRes = await axios.get(`${API_BASE}/super-admin/stats?organizationId=${org.id}`, { headers });
    const stats = statsRes.data.stats;
    console.log('  [Stats Overview]');
    console.log(`    Total Users: ${stats.totalUsers}`);
    console.log(`    Workforce Role Breakdown:`);
    console.log(`      - Employees: ${stats.totalEmployees}`);
    console.log(`      - Interns: ${stats.totalInterns}`);
    console.log(`      - Team Leaders: ${stats.totalTeamLeaders}`);
    console.log(`      - Administrators: ${stats.totalAdmins}`);
    console.log(`    Total Teams: ${stats.totalTeams}`);
    console.log(`    Active Projects: ${stats.activeProjects}`);

    // 2. Test /super-admin/teams?organizationId=...
    const teamsRes = await axios.get(`${API_BASE}/super-admin/teams?organizationId=${org.id}`, { headers });
    const teams = teamsRes.data;
    console.log(`\n  [Teams Directory] Count: ${teams.length}`);
    if (teams.length === 0) {
      console.log(`    -> Clean Empty State Verified ("No teams found for ${org.name}")`);
    } else {
      teams.forEach((t, i) => {
        console.log(`    Team ${i + 1}: "${t.name}" (Code: ${t.code})`);
        console.log(`      Leader: ${t.leader ? t.leader.name : 'Unassigned'}`);
        console.log(`      Member Count: ${t.memberCount}`);
        console.log(`      Active Project Count: ${t.activeProjectCount}`);
      });
    }
    console.log('----------------------------------------------------\n');
  }
}

runVerification().catch(err => {
  console.error('Verification Error:', err.response?.data || err.message);
}).finally(() => prisma.$disconnect());
