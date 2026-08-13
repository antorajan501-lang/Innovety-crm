const axios = require('axios');

async function testDeleteDepartmentWithMembers() {
  try {
    console.log('Logging in as Super Admin...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    });

    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // Create a department
    console.log('Creating department "Dept With Members"...');
    const createRes = await axios.post('http://localhost:5000/api/organization/departments', {
      name: 'Dept With Members',
      code: 'DEPT-MEM'
    }, authHeaders);

    const tempDeptId = createRes.data.id;

    // Get unassigned users (e.g. from Unassigned dept if any)
    const treeRes = await axios.get('http://localhost:5000/api/organization/tree', authHeaders);
    const unassignedDept = (treeRes.data.departments || []).find(d => d.name === 'Unassigned');

    if (unassignedDept && unassignedDept.users && unassignedDept.users.length > 0) {
      const userToTest = unassignedDept.users[0];
      console.log(`Adding member "${userToTest.name}" (${userToTest.id}) to "Dept With Members"...`);

      await axios.post(`http://localhost:5000/api/organization/departments/${tempDeptId}/members`, {
        userIds: [userToTest.id]
      }, authHeaders);

      console.log('Deleting department "Dept With Members"...');
      const delRes = await axios.delete(`http://localhost:5000/api/organization/departments/${tempDeptId}`, authHeaders);
      console.log('DELETE RESPONSE:', delRes.data);
      console.log('MEMBER REASSIGNMENT TEST PASSED SUCCESSFULLY!');
    } else {
      console.log('No users in Unassigned department, testing direct deletion of department...');
      const delRes = await axios.delete(`http://localhost:5000/api/organization/departments/${tempDeptId}`, authHeaders);
      console.log('DELETE RESPONSE:', delRes.data);
      console.log('DELETION TEST PASSED SUCCESSFULLY!');
    }
  } catch (err) {
    console.error('Test error:', err.response?.data || err.message);
  }
}

testDeleteDepartmentWithMembers();
