const axios = require('axios');

async function verify() {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    });

    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    const treeRes = await axios.get('http://localhost:5000/api/organization/tree', authHeaders);
    const depts = treeRes.data.departments || [];
    const unassignedInTree = depts.find(d => d.name === 'Unassigned' || d.code === 'DEP-UNASSIGNED');
    const tempDeptInTree = depts.find(d => d.name === 'Dept To Delete');

    console.log('--- Organization Tree Test Results ---');
    console.log('Total visible departments returned by API:', depts.length);
    console.log('Visible department names:', depts.map(d => d.name));
    console.log('Unassigned in tree departments:', !!unassignedInTree);
    console.log('Temp dept "Dept To Delete" in tree departments:', !!tempDeptInTree);
    console.log('Unassigned users count:', treeRes.data.unassignedUsers?.length || 0);

    const deptsRes = await axios.get('http://localhost:5000/api/organization/departments', authHeaders);
    const deptsList = deptsRes.data || [];
    const unassignedInList = deptsList.find(d => d.name === 'Unassigned' || d.code === 'DEP-UNASSIGNED');

    console.log('--- Departments List API Test Results ---');
    console.log('Total visible departments in list API:', deptsList.length);
    console.log('Unassigned in list API:', !!unassignedInList);

    if (!unassignedInTree && !unassignedInList && !tempDeptInTree) {
      console.log('ALL VERIFICATIONS PASSED 100% SUCCESSFUL!');
    } else {
      console.log('VERIFICATION FAILED!');
    }
  } catch (err) {
    console.error('Verification error:', err.response?.data || err.message);
  }
}

verify();
