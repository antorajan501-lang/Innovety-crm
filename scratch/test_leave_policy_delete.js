const path = require('path');
const axios = require(path.resolve(__dirname, '../backend/node_modules/axios'));
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('=== TEST: Comprehensive Leave Policy Deletion & Assignment Validation ===\n');

  // 1. Super Admin Login
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    userId: 'superadmin@enterprise-crm.com',
    password: 'Password123!'
  });
  const token = loginRes.data.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('✓ 1. Super Admin authenticated successfully.');

  // 2. Fetch all leave policies
  const initialRes = await axios.get(`${API_BASE}/leave-policy`, { headers });
  const allTypes = initialRes.data.leaveTypes || [];
  console.log(`✓ 2. Found ${allTypes.length} active leave policies:`, allTypes.map(t => `${t.name} (${t.code})`).join(', '));

  // 3. Test attempting to delete CL (Casual Leave) -> must return specific mandatory message
  const clPolicy = allTypes.find(t => t.code === 'CL');
  if (clPolicy) {
    console.log(`\n--- Step 3: Attempting to delete Casual Leave (${clPolicy.id}) ---`);
    try {
      await axios.delete(`${API_BASE}/leave-policy/types/${clPolicy.id}`, { headers });
      throw new Error('FAIL: Expected Casual Leave deletion to be rejected!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✓ Successfully rejected CL deletion with: "${err.response.data.message}"`);
        if (err.response.data.message !== 'Casual Leave is a mandatory system policy and cannot be deleted.') {
          throw new Error(`Unexpected message for CL: ${err.response.data.message}`);
        }
      } else {
        throw err;
      }
    }
  }

  // 4. Test attempting to delete SL (Sick Leave) -> must return specific mandatory message
  const slPolicy = allTypes.find(t => t.code === 'SL');
  if (slPolicy) {
    console.log(`\n--- Step 4: Attempting to delete Sick Leave (${slPolicy.id}) ---`);
    try {
      await axios.delete(`${API_BASE}/leave-policy/types/${slPolicy.id}`, { headers });
      throw new Error('FAIL: Expected Sick Leave deletion to be rejected!');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`✓ Successfully rejected SL deletion with: "${err.response.data.message}"`);
        if (err.response.data.message !== 'Sick Leave is a mandatory system policy and cannot be deleted.') {
          throw new Error(`Unexpected message for SL: ${err.response.data.message}`);
        }
      } else {
        throw err;
      }
    }
  }

  // 5. Test deleting an UNASSIGNED policy (create a fresh one to test end-to-end unassigned deletion)
  console.log('\n--- Step 5: Creating a temporary unassigned policy "Floating Holiday" (FH) ---');
  const createRes = await axios.post(`${API_BASE}/leave-policy/types`, {
    name: 'Floating Holiday',
    code: 'FH_' + Date.now().toString().slice(-4),
    description: 'Temporary floating holiday for unassigned delete test',
    color: '#8b5cf6',
    icon: 'Palmtree'
  }, { headers });

  const tempPolicy = createRes.data.leaveType;
  console.log(`✓ Created test policy: "${tempPolicy.name}" (${tempPolicy.code}, ID: ${tempPolicy.id})`);

  // Delete unassigned policy
  console.log(`\n--- Step 6: Deleting unassigned policy "${tempPolicy.name}" ---`);
  const delRes = await axios.delete(`${API_BASE}/leave-policy/types/${tempPolicy.id}`, { headers });
  console.log(`✓ Delete API response (HTTP ${delRes.status}):`, delRes.data);

  // Verify it is permanently removed from DB
  const inDb = await prisma.leaveType.findUnique({ where: { id: tempPolicy.id } });
  if (inDb) {
    throw new Error(`FAIL: LeaveType ${tempPolicy.id} still exists in PostgreSQL database!`);
  }
  console.log('✓ Verified: Policy record is permanently deleted from PostgreSQL database.');

  // Verify it is not present in GET /leave-policy
  const verifyRes = await axios.get(`${API_BASE}/leave-policy`, { headers });
  const stillInList = (verifyRes.data.leaveTypes || []).some(t => t.id === tempPolicy.id);
  if (stillInList) {
    throw new Error('FAIL: Deleted policy still appears in GET /leave-policy list!');
  }
  console.log('✓ Verified: Policy does not appear in GET /leave-policy list.');

  // 6. Test ASSIGNED policy validation:
  // Create another policy, assign it to TEAM_LEADER with annualDays: 5, and verify delete is blocked
  console.log('\n--- Step 7: Testing assigned policy rejection ---');
  const assignedCode = 'ASSIGN_' + Date.now().toString().slice(-4);
  const createAssignedRes = await axios.post(`${API_BASE}/leave-policy/types`, {
    name: 'Assigned Test Policy',
    code: assignedCode,
    description: 'Assigned policy test',
    color: '#ec4899',
    icon: 'Award'
  }, { headers });
  const assignedTestPolicy = createAssignedRes.data.leaveType;

  // Now assign this policy to TEAM_LEADER in OrganizationSettings
  const currentConfigRes = await axios.get(`${API_BASE}/leave-policy`, { headers });
  const currentRoles = currentConfigRes.data.roles || {};
  const updatedRoles = {
    ...currentRoles,
    TEAM_LEADER: {
      ...currentRoles.TEAM_LEADER,
      allowances: {
        ...(currentRoles.TEAM_LEADER?.allowances || {}),
        [assignedCode]: { annualDays: 5, maxConsecutive: 2, carryForward: 0 }
      }
    }
  };

  await axios.put(`${API_BASE}/leave-policy`, {
    roles: updatedRoles,
    general: currentConfigRes.data.general || {}
  }, { headers });
  console.log(`✓ Assigned policy "${assignedCode}" to TEAM_LEADER with 5 annual days.`);

  // Now attempt to delete it -> MUST fail with "This leave policy is currently assigned to users. Reassign or unassign it before deleting."
  try {
    await axios.delete(`${API_BASE}/leave-policy/types/${assignedTestPolicy.id}`, { headers });
    throw new Error('FAIL: Expected delete of assigned policy to be rejected!');
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`✓ Successfully rejected assigned policy deletion with: "${err.response.data.message}"`);
      if (err.response.data.message !== 'This leave policy is currently assigned to users. Reassign or unassign it before deleting.') {
        throw new Error(`Unexpected message: ${err.response.data.message}`);
      }
    } else {
      throw err;
    }
  }

  // Now unassign it from TEAM_LEADER
  delete updatedRoles.TEAM_LEADER.allowances[assignedCode];
  await axios.put(`${API_BASE}/leave-policy`, {
    roles: updatedRoles,
    general: currentConfigRes.data.general || {}
  }, { headers });
  console.log(`✓ Unassigned policy "${assignedCode}" from TEAM_LEADER.`);

  // Now delete it again -> MUST succeed!
  const unassignedDelRes = await axios.delete(`${API_BASE}/leave-policy/types/${assignedTestPolicy.id}`, { headers });
  console.log(`✓ Successfully deleted now-unassigned policy: HTTP ${unassignedDelRes.status}`, unassignedDelRes.data);

  console.log('\n=============================================================');
  console.log('🎉 ALL ASSIGNMENT VALIDATION & DELETION TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================');
}

runTest()
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err.response?.data || err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
