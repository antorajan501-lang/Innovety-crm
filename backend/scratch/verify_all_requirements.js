const axios = require('axios');

async function runValidation() {
  try {
    console.log('--- STARTING COMPREHENSIVE VALIDATION ---');
    console.log('1. Logging in as Super Admin...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    });

    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Get Organization Tree and unassigned users
    console.log('\n2. Fetching Organization Tree...');
    const treeRes = await axios.get('http://localhost:5000/api/organization/tree', authHeaders);
    const unassigned = treeRes.data.unassignedUsers || [];
    console.log(`Unassigned users count: ${unassigned.length}`);
    console.log('Sample unassigned users:', unassigned.slice(0, 3).map(u => `${u.name} (id: ${u.id})`));

    // 3. Create a temporary department
    console.log('\n3. Creating temporary department "Temp Validation Dept"...');
    const createDeptRes = await axios.post('http://localhost:5000/api/organization/departments', {
      name: 'Temp Validation Dept',
      code: 'TEMP-VAL-01'
    }, authHeaders);

    const tempDeptId = createDeptRes.data.id;
    console.log(`Created department ID: ${tempDeptId}`);

    // 4. Assign 3 unassigned users to "Temp Validation Dept"
    const userIdsToAssign = unassigned.slice(0, 3).map(u => u.id);
    console.log(`\n4. Assigning ${userIdsToAssign.length} users to "Temp Validation Dept"...`);
    
    const addRes = await axios.post(`http://localhost:5000/api/organization/departments/${tempDeptId}/members`, {
      userIds: userIdsToAssign
    }, authHeaders);

    console.log('ASSIGNMENT SUCCESSFUL:', addRes.data.message);

    // 5. Delete department with members
    console.log('\n5. Deleting department "Temp Validation Dept" (which has 3 members)...');
    const delRes = await axios.delete(`http://localhost:5000/api/organization/departments/${tempDeptId}`, authHeaders);
    console.log('DELETE SUCCESSFUL:', delRes.data.message);

    // 6. Verify tree data and department list
    console.log('\n6. Verifying Organization Tree after deletion...');
    const treeAfter = await axios.get('http://localhost:5000/api/organization/tree', authHeaders);
    const deptsAfter = treeAfter.data.departments || [];
    
    const unassignedDeptRow = deptsAfter.find(d => d.name === 'Unassigned' || d.code === 'DEP-UNASSIGNED');
    const tempDeptRow = deptsAfter.find(d => d.name === 'Temp Validation Dept');

    console.log('Visible Departments Count:', deptsAfter.length);
    console.log('Visible Department Names:', deptsAfter.map(d => d.name));
    console.log('Is "Unassigned" department row visible in tree:', !!unassignedDeptRow);
    console.log('Is "Temp Validation Dept" visible in tree:', !!tempDeptRow);

    if (!unassignedDeptRow && !tempDeptRow) {
      console.log('\n=============================================');
      console.log('🎉 ALL VALIDATIONS PASSED 100% PERFECTLY!');
      console.log('=============================================');
    } else {
      console.error('Validation failed!');
    }
  } catch (err) {
    console.error('\n❌ VALIDATION ERROR:', err.response?.data || err.message);
  }
}

runValidation();
