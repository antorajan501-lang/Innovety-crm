const axios = require('../backend/node_modules/axios');
const prisma = require('../backend/src/utils/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function run() {
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const token = jwt.sign({ id: superAdmin.id, role: superAdmin.role }, JWT_SECRET, { expiresIn: '1h' });
  const orgId = 'cmteaqlih0000sj52wckjbgci';

  for (const role of ['ALL', 'EMPLOYEE', 'INTERN', 'TEAM_LEADER']) {
    const params = { organizationId: orgId };
    if (role !== 'ALL') params.role = role;
    const res = await axios.get(`${API_BASE}/leave-policy`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    console.log(`\n=== GET /api/leave-policy for role=${role} ===`);
    console.log('Policy:', res.data.policy);
    console.log('Leave Types:', res.data.leaveTypes?.map(lt => ({
      code: lt.code,
      name: lt.name,
      annualDays: lt.annualDays,
      monthlyCreditDays: lt.monthlyCreditDays
    })));
  }
}

run().finally(() => prisma.$disconnect());
