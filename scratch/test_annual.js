const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function testAnnual() {
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  console.log('--- Switching Company Policy to ANNUAL ---');
  await axios.put(`${API_BASE}/leave-policy`, {
    organizationId: orgId,
    allocationType: 'ANNUAL',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  }, { headers: { Authorization: `Bearer ${adminToken}` } });

  const tlUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'TEAM_LEADER' }
  });
  const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  const balRes = await axios.get(`${API_BASE}/leaves/balances`, {
    headers: { Authorization: `Bearer ${tlToken}` }
  });

  console.log('\n--- Team Leader Balances in ANNUAL Mode ---');
  console.log('allocationMode:', balRes.data.allocationMode);
  balRes.data.leaveTypes?.forEach(t => {
    console.log(`  - ${t.code} (${t.name}): available=${t.available}, allocated=${t.allocated}, annualDays=${t.annualDays}`);
  });
}

testAnnual().catch(console.error).finally(() => prisma.$disconnect());
