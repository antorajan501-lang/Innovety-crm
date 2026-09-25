const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function testWfh6() {
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  const wfh = await prisma.leaveType.findFirst({ where: { code: 'WFH' } });
  console.log('Current WFH:', wfh.name, 'monthlyCreditDays:', wfh.monthlyCreditDays);

  // Update WFH monthlyCreditDays to 6
  console.log('\n--- Updating WFH monthlyCreditDays to 6 ---');
  await axios.put(`${API_BASE}/leave-policy/types/${wfh.id}`, {
    ...wfh,
    monthlyCreditDays: 6.0,
    organizationId: orgId
  }, { headers: { Authorization: `Bearer ${adminToken}` } });

  // Now check Team Leader balances without restarting server
  const tlUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'TEAM_LEADER' }
  });
  const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  const balRes = await axios.get(`${API_BASE}/leaves/balances`, {
    headers: { Authorization: `Bearer ${tlToken}` }
  });

  console.log('\n--- Team Leader Balances after WFH changed to 6 ---');
  balRes.data.leaveTypes?.forEach(t => {
    console.log(`  - ${t.code} (${t.name}): available=${t.available}, allocated=${t.allocated}, monthlyCredit=${t.monthlyCredit}`);
  });

  const wfhBal = balRes.data.leaveTypes?.find(t => t.code === 'WFH');
  console.log(`\nWFH Available: ${wfhBal?.available} (Expected: 6)`);
  if (wfhBal?.available === 6) {
    console.log('✓ PASS: WFH became 6 immediately without restarting server!');
  } else {
    console.log('✗ FAIL: WFH did not become 6!');
  }
}

testWfh6().catch(console.error).finally(() => prisma.$disconnect());
