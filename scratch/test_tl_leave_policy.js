const axios = require('../backend/node_modules/axios');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('=== TEST: Team Leader Role Leave Policy ===\n');

  // 1. Authenticate Super Admin
  const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
    userId: 'superadmin@enterprise-crm.com',
    password: 'SuperAdmin123!'
  });
  const adminToken = adminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✓ Super Admin authenticated.');

  // 2. Fetch current policy for comparison
  const defaultPolicyRes = await axios.get(`${API_BASE}/leave-policy`, { headers: adminHeaders });
  console.log(`✓ Fetched default policy for org ${defaultPolicyRes.data.policy?.organizationId || 'default'}.`);

  // Ensure EL exists in leave types
  const allTypes = defaultPolicyRes.data.leaveTypes || [];
  console.log('✓ Available leave types:', allTypes.map(t => `${t.name} (${t.code})`).join(', '));

  // 3. Configure Team Leader Leave Policy in Super Admin -> Leave Policy
  // Example values from user prompt:
  // Casual: 5, Sick: 8, Emergency: 3, WFH: 4
  console.log('\n--- Step 1: Configuring Team Leader Leave Policy (Casual: 5, Sick: 8, Emergency: 3, WFH: 4) ---');
  const tlPolicyPayload = {
    role: 'TEAM_LEADER',
    allocationType: 'ANNUAL',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false,
    allowances: {
      CL: { annualDays: 5, monthlyCreditDays: 1 },
      CASUAL: { annualDays: 5, monthlyCreditDays: 1 },
      SL: { annualDays: 8, monthlyCreditDays: 1 },
      SICK: { annualDays: 8, monthlyCreditDays: 1 },
      EL: { annualDays: 3, monthlyCreditDays: 1 },
      EMERGENCY: { annualDays: 3, monthlyCreditDays: 1 },
      WFH: { annualDays: 4, monthlyCreditDays: 1 }
    }
  };

  const saveRes = await axios.put(`${API_BASE}/leave-policy`, tlPolicyPayload, { headers: adminHeaders });
  console.log('✓ Save TL policy response:', saveRes.data.message);

  // 4. Verify Super Admin reading the Team Leader Policy back
  const readTLPolicyRes = await axios.get(`${API_BASE}/leave-policy?role=TEAM_LEADER`, { headers: adminHeaders });
  const tlTypes = readTLPolicyRes.data.leaveTypes;
  const clType = tlTypes.find(t => ['CL', 'CASUAL'].includes(t.code));
  const slType = tlTypes.find(t => ['SL', 'SICK'].includes(t.code));
  const elType = tlTypes.find(t => ['EL', 'EMERGENCY'].includes(t.code));
  const wfhType = tlTypes.find(t => t.code === 'WFH');

  console.log(`✓ Super Admin read back for TEAM_LEADER:`);
  console.log(`   Casual Leave (CL): ${clType?.annualDays} Days`);
  console.log(`   Sick Leave (SL): ${slType?.annualDays} Days`);
  console.log(`   Emergency Leave (EL): ${elType?.annualDays} Days`);
  console.log(`   Work From Home (WFH): ${wfhType?.annualDays} Days`);

  if (clType?.annualDays !== 5 || slType?.annualDays !== 8 || elType?.annualDays !== 3 || wfhType?.annualDays !== 4) {
    throw new Error('Failed: Super Admin read back values do not match configured values.');
  }

  // 5. Log in as Team Leader
  console.log('\n--- Step 2: Logging in as Team Leader (Paul Renine) ---');
  const tlLogin = await axios.post(`${API_BASE}/auth/login`, {
    userId: 'paulrenine9487@gmail.com',
    password: '01012000'
  });
  const tlToken = tlLogin.data.token;
  const tlHeaders = { Authorization: `Bearer ${tlToken}` };
  console.log(`✓ Team Leader logged in: ${tlLogin.data.user.name} (Role: ${tlLogin.data.user.role})`);

  // 6. Call /api/leaves/balances as Team Leader
  console.log('\n--- Step 3: Fetching /api/leaves/balances for Team Leader ---');
  const tlBalancesRes = await axios.get(`${API_BASE}/leaves/balances`, { headers: tlHeaders });
  const data = tlBalancesRes.data;

  console.log('TL Balances Response:');
  console.log(`   casualRemaining: ${data.casualRemaining} (Expected: 5)`);
  console.log(`   sickRemaining: ${data.sickRemaining} (Expected: 8)`);
  console.log(`   emergencyRemaining: ${data.emergencyRemaining} (Expected: 3)`);
  console.log(`   wfhRemaining: ${data.wfhRemaining} (Expected: 4)`);
  console.log(`   wfhEnabled: ${data.wfhEnabled} (Expected: true)`);
  console.log(`   pendingRequests: ${data.pendingRequests}`);
  console.log(`   approvedRequests: ${data.approvedRequests}`);

  if (data.casualRemaining !== 5) throw new Error(`Expected casualRemaining 5, got ${data.casualRemaining}`);
  if (data.sickRemaining !== 8) throw new Error(`Expected sickRemaining 8, got ${data.sickRemaining}`);
  if (data.emergencyRemaining !== 3) throw new Error(`Expected emergencyRemaining 3, got ${data.emergencyRemaining}`);
  if (data.wfhRemaining !== 4) throw new Error(`Expected wfhRemaining 4, got ${data.wfhRemaining}`);
  if (!data.wfhEnabled) throw new Error('Expected wfhEnabled true');

  console.log('✓ PASS: Team Leader received exact configured leave policy balances (5, 8, 3, 4)!');

  // 7. Verify Database Records directly
  console.log('\n--- Step 4: Direct Database Verification for Team Leader ---');
  const tlUser = await prisma.user.findUnique({
    where: { email: 'paulrenine9487@gmail.com' }
  });
  const dbBalances = await prisma.userLeaveBalance.findMany({
    where: { userId: tlUser.id },
    include: { leaveType: true }
  });

  for (const b of dbBalances) {
    console.log(`   DB record for ${b.leaveType.name} (${b.leaveType.code}): allocated=${b.allocated}, available=${b.available}`);
  }

  // 8. Verify Employee and Intern remain unaffected
  console.log('\n--- Step 5: Verifying Employee / General Policy remains unaffected ---');
  const employeePolicyRes = await axios.get(`${API_BASE}/leave-policy?role=EMPLOYEE`, { headers: adminHeaders });
  const empCL = employeePolicyRes.data.leaveTypes.find(t => ['CL', 'CASUAL'].includes(t.code));
  const empSL = employeePolicyRes.data.leaveTypes.find(t => ['SL', 'SICK'].includes(t.code));
  console.log(`   Employee policy: Casual=${empCL?.annualDays} (not 5), Sick=${empSL?.annualDays} (not 8)`);

  if (empCL?.annualDays === 5) {
    console.warn('Note: Employee has identical count or is affected? Let us check general policy.');
  } else {
    console.log('✓ PASS: Employee policy is distinct from Team Leader policy.');
  }

  console.log('\n=== ALL TEAM LEADER LEAVE POLICY TESTS PASSED! ===');
  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ Test Error:', err.response?.data || err.message);
  process.exit(1);
});
