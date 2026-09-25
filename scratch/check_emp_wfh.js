const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function main() {
  const orgId = 'cmteaqlih0000sj52wckjbgci';
  const emp = await prisma.user.findFirst({ where: { organizationId: orgId, role: 'EMPLOYEE' } });
  const t = jwt.sign({ id: emp.id, role: emp.role, organizationId: emp.organizationId }, JWT_SECRET, { expiresIn: '1h' });
  const r = await axios.get(`${API_BASE}/leaves/balances`, { headers: { Authorization: `Bearer ${t}` } });
  console.log('Employee WFH balance:');
  console.log(r.data.leaveTypes.find(x => x.code === 'WFH'));

  const tl = await prisma.user.findFirst({ where: { organizationId: orgId, role: 'TEAM_LEADER' } });
  const tlt = jwt.sign({ id: tl.id, role: tl.role, organizationId: tl.organizationId }, JWT_SECRET, { expiresIn: '1h' });
  const tlr = await axios.get(`${API_BASE}/leaves/balances`, { headers: { Authorization: `Bearer ${tlt}` } });
  console.log('Team Leader WFH balance:');
  console.log(tlr.data.leaveTypes.find(x => x.code === 'WFH'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
