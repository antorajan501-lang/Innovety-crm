const axios = require('axios');

async function testLogin() {
  console.log('Testing login for john@gmail.com / R001@2026...');
  try {
    const res = await axios.post('http://127.0.0.1:5000/api/auth/login', {
      email: 'john@gmail.com',
      password: 'R001@2026'
    });
    console.log('✅ LOGIN SUCCESSFUL!');
    console.log('User:', {
      id: res.data.user.id,
      name: res.data.user.name,
      email: res.data.user.email,
      role: res.data.user.role,
      organizationId: res.data.user.organizationId,
      organizationName: res.data.user.organization?.name
    });
  } catch (err) {
    console.error('❌ LOGIN FAILED:', err.response?.data || err.message);
  }
}

testLogin();
