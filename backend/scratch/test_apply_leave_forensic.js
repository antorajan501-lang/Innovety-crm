const axios = require('axios');
const prisma = require('../src/utils/db');
const bcrypt = require('bcrypt');

const BASE_URL = 'http://localhost:5000/api';

async function testApplyLeaveForensics() {
  console.log('=== TEST APPLY LEAVE FORENSIC INVESTIGATION ===\n');

  // Set predictable passwords for test accounts
  const passHash = await bcrypt.hash('Password123!', 10);
  await prisma.user.updateMany({
    where: { email: { in: ['employee@gmail.com', 'antorajan501@gmail.com', 'somusuraj72@gmail.com'] } },
    data: { password: passHash }
  });

  const testUsers = [
    { email: 'employee@gmail.com', role: 'EMPLOYEE' },
    { email: 'antorajan501@gmail.com', role: 'INTERN' },
    { email: 'somusuraj72@gmail.com', role: 'TEAM_LEADER' }
  ];

  for (const u of testUsers) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`Testing Role: ${u.role} (${u.email})`);
    console.log(`---------------------------------------------------------`);
    try {
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: u.email,
        password: 'Password123!'
      });

      const token = loginRes.data.token;
      const userObj = loginRes.data.user;
      console.log(`✓ Login Success. User ID: ${userObj.id}, Org ID: ${userObj.organizationId}`);

      const payload = {
        leaveType: 'CASUAL',
        startDate: '2026-09-20',
        endDate: '2026-09-21',
        isHalfDay: false,
        reason: 'Testing leave request forensic analysis',
        contactPhone: '9876543210',
        letterContent: 'Testing leave request forensic analysis'
      };

      console.log('Request Payload:', payload);

      const leaveRes = await axios.post(`${BASE_URL}/leaves`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log(`✅ Leave Creation SUCCESS! HTTP ${leaveRes.status}`);
      console.log('Response Body:', leaveRes.data);
    } catch (err) {
      console.error(`❌ ERROR for ${u.role}: HTTP ${err.response?.status}`);
      console.error('Response Data:', err.response?.data);
      if (err.response?.data?.error) {
        console.error('Error Stack/Detail:', err.response.data.error);
      }
    }
  }

  await prisma.$disconnect();
}

testApplyLeaveForensics();
