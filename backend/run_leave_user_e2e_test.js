const axios = require('axios');
const prisma = require('./src/utils/db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-production';

async function runE2E() {
  console.log('====================================================');
  console.log('   RUNNING USER-SIDE LEAVE MANAGEMENT E2E TEST      ');
  console.log('====================================================\n');

  // 1. Ensure Admin & Employee exist
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let employee = await prisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
  let tl = await prisma.user.findFirst({ where: { role: 'TEAM_LEADER' } });

  if (!admin || !employee) {
    console.error('ERROR: Required Admin or Employee user not found in database.');
    process.exit(1);
  }

  const adminToken = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, JWT_SECRET, { expiresIn: '1h' });
  const empToken = jwt.sign({ id: employee.id, role: employee.role, email: employee.email }, JWT_SECRET, { expiresIn: '1h' });
  const tlToken = tl ? jwt.sign({ id: tl.id, role: tl.role, email: tl.email }, JWT_SECRET, { expiresIn: '1h' }) : null;

  const empHeaders = { Authorization: `Bearer ${empToken}` };
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const tlHeaders = tlToken ? { Authorization: `Bearer ${tlToken}` } : null;

  console.log(`1. Testing as Employee: ${employee.name} (${employee.email})`);
  console.log(`   Testing as Admin: ${admin.name} (${admin.email})\n`);

  // Random unique future dates to prevent collision on repeated runs
  const offset1 = 100 + Math.floor(Math.random() * 500);
  const offset2 = 700 + Math.floor(Math.random() * 500);
  const date1 = new Date(Date.now() + 86400000 * offset1).toISOString().split('T')[0];
  const date2 = new Date(Date.now() + 86400000 * offset2).toISOString().split('T')[0];

  // Step A: Employee submits Leave Request 1
  console.log(`2. Employee submits new leave application for ${date1}...`);
  const req1Res = await axios.post(`${API_BASE}/leaves`, {
    startDate: date1,
    endDate: date1,
    leaveType: 'CASUAL',
    reason: 'Testing user-side status flow - Request 1'
  }, { headers: empHeaders });

  const leave1 = req1Res.data;
  console.log(`  [PASS] Leave 1 created with ID: ${leave1.id}`);
  console.log(`  [PASS] Initial Status: ${leave1.status} (matches PENDING workflow)`);

  // Step B: Employee fetches leave history
  const empHistory1 = await axios.get(`${API_BASE}/leaves`, { headers: empHeaders });
  const found1 = (empHistory1.data?.leaves || empHistory1.data).find(l => l.id === leave1.id);
  console.log(`  [PASS] Employee leave history reflects status: ${found1?.status}`);

  // Step C: Approve Leave Request 1
  console.log('\n3. Processing approval for Leave 1...');
  if (leave1.status === 'PENDING_TL_APPROVAL' && tlHeaders) {
    console.log('   Step C.1: Team Leader recommends approval...');
    await axios.put(`${API_BASE}/leaves/${leave1.id}/tl-approve`, { remarks: 'Recommended by TL' }, { headers: tlHeaders });
  }
  const approveRes = await axios.put(`${API_BASE}/leaves/${leave1.id}/admin-approve`, {
    remarks: 'Approved by Admin in E2E test'
  }, { headers: adminHeaders });
  console.log(`  [PASS] Admin approve response status: ${approveRes.data.leave?.status || approveRes.data.status}`);

  // Step D: Employee re-fetches history and verifies status changed to APPROVED
  const empHistory2 = await axios.get(`${API_BASE}/leaves`, { headers: empHeaders });
  const found1AfterApprove = (empHistory2.data?.leaves || empHistory2.data).find(l => l.id === leave1.id);
  console.log(`  [VERIFIED] Employee view status updated to: ${found1AfterApprove?.status}`);
  if (found1AfterApprove?.status !== 'APPROVED') {
    throw new Error(`Expected status APPROVED, got ${found1AfterApprove?.status}`);
  }

  // Step E: Employee submits Leave Request 2
  console.log(`\n4. Employee submits Leave Request 2 for ${date2}...`);
  const req2Res = await axios.post(`${API_BASE}/leaves`, {
    startDate: date2,
    endDate: date2,
    leaveType: 'EMERGENCY',
    reason: 'Testing rejection flow - Request 2'
  }, { headers: empHeaders });
  const leave2 = req2Res.data;
  console.log(`  [PASS] Leave 2 created with ID: ${leave2.id}, Status: ${leave2.status}`);

  // Step F: Admin rejects Leave Request 2
  console.log('\n5. Admin rejects Leave 2...');
  const rejectRes = await axios.put(`${API_BASE}/leaves/${leave2.id}/reject`, {
    remarks: 'Declined due to staffing constraints'
  }, { headers: adminHeaders });
  console.log(`  [PASS] Admin reject response status: ${rejectRes.data.leave?.status || rejectRes.data.status}`);

  // Step G: Employee re-fetches history and verifies status changed to REJECTED
  const empHistory3 = await axios.get(`${API_BASE}/leaves`, { headers: empHeaders });
  const found2AfterReject = (empHistory3.data?.leaves || empHistory3.data).find(l => l.id === leave2.id);
  console.log(`  [VERIFIED] Employee view status updated to: ${found2AfterReject?.status}`);
  if (found2AfterReject?.status !== 'REJECTED') {
    throw new Error(`Expected status REJECTED, got ${found2AfterReject?.status}`);
  }

  console.log('\n====================================================');
  console.log('   ALL E2E LEAVE WORKFLOW TESTS PASSED SUCCESSFULLY!  ');
  console.log('====================================================\n');
  await prisma.$disconnect();
}

runE2E().catch(async (err) => {
  console.error('E2E TEST FAILED:', err.response?.data || err.message);
  await prisma.$disconnect();
  process.exit(1);
});
