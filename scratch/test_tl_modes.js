const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function testModes() {
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const tlUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'TEAM_LEADER' }
  });
  const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  console.log('Testing TL Balances under current settings:');
  const res = await axios.get(`${API_BASE}/leaves/balances`, {
    headers: { Authorization: `Bearer ${tlToken}` }
  });

  console.log('Mode:', res.data.allocationMode);
  console.log('leaveTypes:');
  res.data.leaveTypes.forEach(t => {
    console.log(`- ${t.name} (${t.code}): allocated=${t.allocated}, available=${t.available}, monthlyCredit=${t.monthlyCredit}`);
  });
}

testModes().catch(console.error).finally(() => prisma.$disconnect());
