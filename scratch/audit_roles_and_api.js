const axios = require('../backend/node_modules/axios');
const prisma = require('../backend/src/utils/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function run() {
  try {
    const orgs = await prisma.organization.findMany({
      include: { settings: true }
    });
    console.log('=== All Organizations ===');
    for (const o of orgs) {
      console.log(`- ${o.name} (${o.id})`);
      if (o.settings?.leavePolicy) {
        console.log('  Settings leavePolicy:', JSON.stringify(o.settings.leavePolicy));
      }
    }

    // Find the org where Suraj or Paul or Divya belongs
    const suraj = await prisma.user.findFirst({
      where: { email: { contains: 'suraj' } }
    }) || await prisma.user.findFirst({
      where: { role: 'TEAM_LEADER' }
    });

    const targetOrgId = suraj?.organizationId;
    const targetOrg = orgs.find(o => o.id === targetOrgId);
    console.log('\nTarget Org for analysis:', targetOrg?.name, targetOrg?.id);

    const users = await prisma.user.findMany({
      where: { organizationId: targetOrgId },
      select: { id: true, name: true, role: true, email: true, organizationId: true }
    });

    console.log('\n=== Users in Target Org ===');
    for (const u of users) {
      console.log(`- ${u.name} | Role: ${u.role} | ID: ${u.id}`);
    }

    const employee = users.find(u => u.role === 'EMPLOYEE');
    const intern = users.find(u => u.role === 'INTERN');
    const teamLeader = users.find(u => u.role === 'TEAM_LEADER');

    console.log('\n=== Testing API GET /api/leaves/balances for each role in Target Org ===');

    if (employee) {
      const token = jwt.sign({ id: employee.id, role: employee.role, organizationId: employee.organizationId }, JWT_SECRET, { expiresIn: '1h' });
      const res = await axios.get(`${API_BASE}/leaves/balances`, { headers: { Authorization: `Bearer ${token}` } });
      console.log('\n--- Employee Response (' + employee.name + ' - ' + employee.role + ') ---');
      console.log('Status:', res.status);
      console.log('allocationMode:', res.data?.allocationMode);
      console.log('casualRemaining:', res.data?.casualRemaining);
      console.log('sickRemaining:', res.data?.sickRemaining);
      console.log('emergencyRemaining:', res.data?.emergencyRemaining);
      console.log('wfhRemaining:', res.data?.wfhRemaining);
      console.log('wfhEnabled:', res.data?.wfhEnabled);
      console.log('leaveTypes:', res.data?.leaveTypes?.map(t => ({ code: t.code, annualDays: t.annualDays, monthlyCreditDays: t.monthlyCreditDays, allocated: t.allocated, used: t.used, available: t.available })));
    }

    if (intern) {
      const token = jwt.sign({ id: intern.id, role: intern.role, organizationId: intern.organizationId }, JWT_SECRET, { expiresIn: '1h' });
      const res = await axios.get(`${API_BASE}/leaves/balances`, { headers: { Authorization: `Bearer ${token}` } });
      console.log('\n--- Intern Response (' + intern.name + ' - ' + intern.role + ') ---');
      console.log('Status:', res.status);
      console.log('allocationMode:', res.data?.allocationMode);
      console.log('casualRemaining:', res.data?.casualRemaining);
      console.log('sickRemaining:', res.data?.sickRemaining);
      console.log('emergencyRemaining:', res.data?.emergencyRemaining);
      console.log('wfhRemaining:', res.data?.wfhRemaining);
      console.log('wfhEnabled:', res.data?.wfhEnabled);
      console.log('leaveTypes:', res.data?.leaveTypes?.map(t => ({ code: t.code, annualDays: t.annualDays, monthlyCreditDays: t.monthlyCreditDays, allocated: t.allocated, used: t.used, available: t.available })));
    }

    if (teamLeader) {
      const token = jwt.sign({ id: teamLeader.id, role: teamLeader.role, organizationId: teamLeader.organizationId }, JWT_SECRET, { expiresIn: '1h' });
      const res = await axios.get(`${API_BASE}/leaves/balances`, { headers: { Authorization: `Bearer ${token}` } });
      console.log('\n--- Team Leader Response (' + teamLeader.name + ' - ' + teamLeader.role + ') ---');
      console.log('Status:', res.status);
      console.log('allocationMode:', res.data?.allocationMode);
      console.log('casualRemaining:', res.data?.casualRemaining);
      console.log('sickRemaining:', res.data?.sickRemaining);
      console.log('emergencyRemaining:', res.data?.emergencyRemaining);
      console.log('wfhRemaining:', res.data?.wfhRemaining);
      console.log('wfhEnabled:', res.data?.wfhEnabled);
      console.log('leaveTypes:', res.data?.leaveTypes?.map(t => ({ code: t.code, annualDays: t.annualDays, monthlyCreditDays: t.monthlyCreditDays, allocated: t.allocated, used: t.used, available: t.available })));
      console.log('policy in response:', res.data?.policy);
    }

  } catch (err) {
    console.error(err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
