const axios = require('axios');
const prisma = require('./src/utils/db');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-production';

async function runTest() {
  console.log('====================================================');
  console.log('   RUNNING ADMIN DASHBOARD LEAVE SYNC E2E TEST       ');
  console.log('====================================================\n');

  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let employee = await prisma.user.findFirst({ where: { role: 'EMPLOYEE' } });
  let tl = await prisma.user.findFirst({ where: { role: 'TEAM_LEADER' } });

  if (!admin || !employee) {
    console.error('ERROR: Required Admin or Employee user not found.');
    process.exit(1);
  }

  const adminToken = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, JWT_SECRET, { expiresIn: '1h' });
  const empToken = jwt.sign({ id: employee.id, role: employee.role, email: employee.email }, JWT_SECRET, { expiresIn: '1h' });
  const tlToken = tl ? jwt.sign({ id: tl.id, role: tl.role, email: tl.email }, JWT_SECRET, { expiresIn: '1h' }) : null;

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const empHeaders = { Authorization: `Bearer ${empToken}` };
  const tlHeaders = tlToken ? { Authorization: `Bearer ${tlToken}` } : null;

  // Step 1: Initial Pending Count as Admin
  console.log('1. Fetching current pending leaves from backend as Admin...');
  const res1 = await axios.get(`${API_BASE}/leaves`, { headers: adminHeaders });
  const allLeaves1 = Array.isArray(res1.data) ? res1.data : (res1.data?.leaves || []);
  const initialPendingCount = allLeaves1.filter(l => {
    const isSelf = l.userId === admin.id || l.user?.id === admin.id;
    if (isSelf) return false;
    return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
  }).length;

  console.log(`  [PASS] Actionable Pending Count for Admin: ${initialPendingCount}`);

  // Step 2: Employee submits new leave
  const offset = 1000 + Math.floor(Math.random() * 500);
  const date1 = new Date(Date.now() + 86400000 * offset).toISOString().split('T')[0];
  console.log(`\n2. Submitting new leave for Employee on ${date1}...`);
  const createRes = await axios.post(`${API_BASE}/leaves`, {
    startDate: date1,
    endDate: date1,
    leaveType: 'CASUAL',
    reason: 'Testing Admin Dashboard Leave Sync'
  }, { headers: empHeaders });

  const newLeave = createRes.data;
  console.log(`  [PASS] Created leave ID: ${newLeave.id}, Status: ${newLeave.status}`);

  // Step 3: Admin re-fetches leaves and checks count increased by 1
  const res2 = await axios.get(`${API_BASE}/leaves`, { headers: adminHeaders });
  const allLeaves2 = Array.isArray(res2.data) ? res2.data : (res2.data?.leaves || []);
  const updatedPendingCount = allLeaves2.filter(l => {
    const isSelf = l.userId === admin.id || l.user?.id === admin.id;
    if (isSelf) return false;
    return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
  }).length;

  console.log(`  [VERIFIED] Admin Dashboard Pending Count after submission: ${updatedPendingCount} (was ${initialPendingCount})`);
  if (updatedPendingCount !== initialPendingCount + 1) {
    throw new Error(`Expected pending count to be ${initialPendingCount + 1}, got ${updatedPendingCount}`);
  }

  // Step 4: Admin approves the request
  console.log('\n3. Processing Admin approval...');
  if (newLeave.status === 'PENDING_TL_APPROVAL' && tlHeaders) {
    await axios.put(`${API_BASE}/leaves/${newLeave.id}/tl-approve`, { remarks: 'Recommended by TL' }, { headers: tlHeaders });
  }
  await axios.put(`${API_BASE}/leaves/${newLeave.id}/admin-approve`, { remarks: 'Approved by Admin' }, { headers: adminHeaders });

  // Step 5: Admin re-fetches leaves and checks count decreased back
  const res3 = await axios.get(`${API_BASE}/leaves`, { headers: adminHeaders });
  const allLeaves3 = Array.isArray(res3.data) ? res3.data : (res3.data?.leaves || []);
  const finalPendingCount = allLeaves3.filter(l => {
    const isSelf = l.userId === admin.id || l.user?.id === admin.id;
    if (isSelf) return false;
    return ['PENDING_ADMIN_APPROVAL', 'PENDING_TL_APPROVAL', 'PENDING'].includes(l.status);
  }).length;

  console.log(`  [VERIFIED] Admin Dashboard Pending Count after approval: ${finalPendingCount} (decreased by 1)`);
  if (finalPendingCount !== initialPendingCount) {
    throw new Error(`Expected pending count to revert to ${initialPendingCount}, got ${finalPendingCount}`);
  }

  console.log('\n====================================================');
  console.log('   ADMIN DASHBOARD LEAVE SYNC TEST SUCCESSFUL!       ');
  console.log('====================================================\n');
  await prisma.$disconnect();
}

runTest().catch(async (err) => {
  console.error('TEST FAILED:', err.response?.data || err.message);
  await prisma.$disconnect();
  process.exit(1);
});
