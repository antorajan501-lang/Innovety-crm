const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { getCompanyLeavePolicy, filterLeaveTypesForCompany, normalizeRole } = require('../backend/src/utils/companyLeavePolicyStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function trace() {
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { settings: true }
  });

  const tlUser = await prisma.user.findFirst({
    where: { organizationId: orgId, name: { contains: 'Suraj' } }
  }) || await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'TEAM_LEADER' }
  });

  const empUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'EMPLOYEE' }
  });

  console.log('=== LAYER 1: SUPER ADMIN LEAVE POLICY CONFIGURATION ===');
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
  
  const superAdminGeneral = await axios.get(`${API_BASE}/leave-policy`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    params: { organizationId: orgId }
  });
  console.log('Super Admin General Policy Mode:', superAdminGeneral.data.policy?.allocationType);
  console.log('Super Admin General Types:');
  superAdminGeneral.data.leaveTypes?.forEach(t => {
    console.log(`  - [${t.code}] ${t.name}: annual=${t.annualDays}, monthly=${t.monthlyCreditDays}`);
  });

  const superAdminTL = await axios.get(`${API_BASE}/leave-policy`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    params: { organizationId: orgId, role: 'TEAM_LEADER' }
  });
  console.log('Super Admin TL Policy Mode:', superAdminTL.data.policy?.allocationType);
  console.log('Super Admin TL Types:');
  superAdminTL.data.leaveTypes?.forEach(t => {
    console.log(`  - [${t.code}] ${t.name}: annual=${t.annualDays}, monthly=${t.monthlyCreditDays}`);
  });

  console.log('\n=== LAYER 2: OrganizationSettings.leavePolicy IN DB ===');
  console.log('DB Org Settings leavePolicy:', JSON.stringify(org?.settings?.leavePolicy, null, 2));

  console.log('\n=== LAYER 3: ROLE ALLOWANCES RESOLUTION ===');
  const tlPolicyFromStore = getCompanyLeavePolicy(orgId, normalizeRole(tlUser.role));
  console.log('Resolved Policy for TL (Store):', JSON.stringify(tlPolicyFromStore, null, 2));
  const empPolicyFromStore = getCompanyLeavePolicy(orgId, normalizeRole(empUser.role));
  console.log('Resolved Policy for Emp (Store):', JSON.stringify(empPolicyFromStore, null, 2));

  console.log('\n=== LAYER 4: UserLeaveBalance IN DB ===');
  const tlBals = await prisma.userLeaveBalance.findMany({
    where: { userId: tlUser.id },
    include: { leaveType: true }
  });
  console.log(`Team Leader (${tlUser.name}, ID: ${tlUser.id}, Role: ${tlUser.role}):`);
  tlBals.forEach(b => {
    console.log(`  - [${b.leaveType.code}] ${b.leaveType.name}: allocated=${b.allocated}, available=${b.available}`);
  });

  const empBals = await prisma.userLeaveBalance.findMany({
    where: { userId: empUser.id },
    include: { leaveType: true }
  });
  console.log(`Employee (${empUser.name}, ID: ${empUser.id}, Role: ${empUser.role}):`);
  empBals.forEach(b => {
    console.log(`  - [${b.leaveType.code}] ${b.leaveType.name}: allocated=${b.allocated}, available=${b.available}`);
  });

  console.log('\n=== LAYER 5: API RESPONSE /api/leaves/balances ===');
  const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
  const tlApiRes = await axios.get(`${API_BASE}/leaves/balances`, {
    headers: { Authorization: `Bearer ${tlToken}` }
  });
  console.log(`Team Leader API Response (Status: ${tlApiRes.status}, Mode: ${tlApiRes.data.allocationMode}):`);
  tlApiRes.data.leaveTypes?.forEach(t => {
    console.log(`  - [${t.code}] ${t.name}: allocated=${t.allocated}, available=${t.available}, monthlyCredit=${t.monthlyCredit}`);
  });

  const empToken = jwt.sign({ id: empUser.id, role: empUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
  const empApiRes = await axios.get(`${API_BASE}/leaves/balances`, {
    headers: { Authorization: `Bearer ${empToken}` }
  });
  console.log(`Employee API Response (Status: ${empApiRes.status}, Mode: ${empApiRes.data.allocationMode}):`);
  empApiRes.data.leaveTypes?.forEach(t => {
    console.log(`  - [${t.code}] ${t.name}: allocated=${t.allocated}, available=${t.available}, monthlyCredit=${t.monthlyCredit}`);
  });
}

trace().catch(console.error).finally(() => prisma.$disconnect());
