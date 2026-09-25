const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { getCompanyLeavePolicy, filterLeaveTypesForCompany } = require('../backend/src/utils/companyLeavePolicyStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function main() {
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { settings: true }
  });

  console.log(`================================================================`);
  console.log(`COMPANY AUDIT: ${org?.name} (${orgId})`);
  console.log(`================================================================`);

  console.log('\n--- 1. OrganizationSettings in DB ---');
  console.log('leavePolicy in DB:', JSON.stringify(org?.settings?.leavePolicy, null, 2));

  console.log('\n--- 2. companyLeavePolicyStore (Base Company Policy) ---');
  const companyPolicy = getCompanyLeavePolicy(orgId);
  console.log(JSON.stringify(companyPolicy, null, 2));

  console.log('\n--- 3. companyLeavePolicyStore (TEAM_LEADER Policy) ---');
  const tlPolicy = getCompanyLeavePolicy(orgId, 'TEAM_LEADER');
  console.log(JSON.stringify(tlPolicy, null, 2));

  console.log('\n--- 4. All Leave Types in DB ---');
  const allLeaveTypes = await prisma.leaveType.findMany();
  allLeaveTypes.forEach(lt => {
    console.log(`- ${lt.name} (${lt.code}) | id: ${lt.id} | isActive: ${lt.isActive} | isSystem: ${lt.isSystem} | annual: ${lt.annualDays} | monthly: ${lt.monthlyCreditDays}`);
  });

  console.log('\n--- 5. Company Assigned Leave Types ---');
  const companyTypes = filterLeaveTypesForCompany(allLeaveTypes, orgId);
  companyTypes.forEach(lt => {
    console.log(`- ${lt.name} (${lt.code}) | id: ${lt.id} | isActive: ${lt.isActive} | annual: ${lt.annualDays} | monthly: ${lt.monthlyCreditDays}`);
  });

  console.log('\n--- 6. Users in Innoveity Tech ---');
  const users = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, role: true, email: true }
  });
  users.forEach(u => console.log(`- ${u.name} | Role: ${u.role} | Email: ${u.email} | ID: ${u.id}`));

  const tlUser = users.find(u => u.role === 'TEAM_LEADER') || users.find(u => u.email.includes('paulrenine'));
  const empUser = users.find(u => u.role === 'EMPLOYEE');

  console.log('\n--- 7. Team Leader User DB Leave Balances ---');
  if (tlUser) {
    console.log(`Team Leader: ${tlUser.name} (${tlUser.email})`);
    const tlBals = await prisma.userLeaveBalance.findMany({
      where: { userId: tlUser.id },
      include: { leaveType: true }
    });
    tlBals.forEach(b => {
      console.log(`- ${b.leaveType.name} (${b.leaveType.code}): allocated=${b.allocated}, used=${b.used}, pending=${b.pending}, available=${b.available}`);
    });
  }

  // 8. Super Admin Configuration via API
  console.log('\n--- 8. Super Admin API Check (/api/leave-policy) ---');
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (superAdmin) {
    const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
    try {
      // General / Company Policy
      const adminGeneralRes = await axios.get(`${API_BASE}/leave-policy`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { organizationId: orgId }
      });
      console.log('Super Admin General Policy for Org:');
      console.log('  allocationType:', adminGeneralRes.data.policy?.allocationType);
      console.log('  leaveTypes:', adminGeneralRes.data.leaveTypes?.map(lt => `${lt.name} (${lt.code}): annual=${lt.annualDays}, monthly=${lt.monthlyCreditDays}`));

      // Team Leader Policy
      const adminTLRes = await axios.get(`${API_BASE}/leave-policy`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: { organizationId: orgId, role: 'TEAM_LEADER' }
      });
      console.log('Super Admin TEAM_LEADER Policy for Org:');
      console.log('  allocationType:', adminTLRes.data.policy?.allocationType);
      console.log('  role:', adminTLRes.data.policy?.role);
      console.log('  leaveTypes:', adminTLRes.data.leaveTypes?.map(lt => `${lt.name} (${lt.code}): annual=${lt.annualDays}, monthly=${lt.monthlyCreditDays}`));
    } catch (e) {
      console.error('Super Admin API error:', e.message);
    }
  }

  // 9. Team Leader API Response (/api/leaves/balances)
  console.log('\n--- 9. Team Leader API Response (/api/leaves/balances) ---');
  if (tlUser) {
    const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
    try {
      const tlRes = await axios.get(`${API_BASE}/leaves/balances`, {
        headers: { Authorization: `Bearer ${tlToken}` }
      });
      console.log('Status:', tlRes.status);
      console.log('allocationMode:', tlRes.data.allocationMode);
      console.log('userRole:', tlRes.data.userRole);
      console.log('casualRemaining:', tlRes.data.casualRemaining);
      console.log('sickRemaining:', tlRes.data.sickRemaining);
      console.log('emergencyRemaining:', tlRes.data.emergencyRemaining);
      console.log('wfhRemaining:', tlRes.data.wfhRemaining);
      console.log('wfhEnabled:', tlRes.data.wfhEnabled);
      console.log('pendingRequests:', tlRes.data.pendingRequests);
      console.log('approvedRequests:', tlRes.data.approvedRequests);
      console.log('leaveTypes in response:');
      console.log(JSON.stringify(tlRes.data.leaveTypes, null, 2));
    } catch (e) {
      console.error('Team Leader API error:', e.message);
    }
  }

  // 10. Employee API Response (/api/leaves/balances)
  if (empUser) {
    console.log('\n--- 10. Employee API Response (/api/leaves/balances) ---');
    const empToken = jwt.sign({ id: empUser.id, role: empUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });
    try {
      const empRes = await axios.get(`${API_BASE}/leaves/balances`, {
        headers: { Authorization: `Bearer ${empToken}` }
      });
      console.log('Status:', empRes.status);
      console.log('allocationMode:', empRes.data.allocationMode);
      console.log('userRole:', empRes.data.userRole);
      console.log('leaveTypes in response:');
      console.log(JSON.stringify(empRes.data.leaveTypes, null, 2));
    } catch (e) {
      console.error('Employee API error:', e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
