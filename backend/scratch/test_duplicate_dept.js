const axios = require('axios');

async function test() {
  try {
    console.log('Logging in as Super Admin...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    });

    const token = loginRes.data.token;
    console.log('Login successful! Testing duplicate department creation...');

    // First fetch existing departments to get an exact name
    const treeRes = await axios.get('http://localhost:5000/api/organization/tree', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const existingDepts = treeRes.data.departments || [];
    console.log('Existing departments in DB:', existingDepts.map(d => d.name));

    const existingName = existingDepts[0]?.name || 'Engineering';

    try {
      const res = await axios.post('http://localhost:5000/api/organization/departments', {
        name: existingName,
        code: 'TEST-DUP'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('UNEXPECTED SUCCESS:', res.status, res.data);
    } catch (err) {
      console.log('DUPLICATE RESP STATUS:', err.response?.status);
      console.log('DUPLICATE RESP DATA:', JSON.stringify(err.response?.data, null, 2));
    }
  } catch (e) {
    console.error('Test script error:', e.response?.data || e.message);
  }
}

test();
