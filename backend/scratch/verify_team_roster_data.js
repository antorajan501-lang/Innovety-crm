const axios = require('axios');
const prisma = require('../src/utils/db');

const BASE_URL = 'http://localhost:5000/api';

async function verifyTeamRoster() {
  console.log('================================================================');
  console.log('     TEAM ROSTER & STATUS — DATA & SECURITY VERIFICATION        ');
  console.log('================================================================\n');

  const testUsers = [
    { email: 'jeffersonsamuel003@gmail.com', role: 'EMPLOYEE', org: 'INNOVEITY' },
    { email: 'somusuraj72@gmail.com', role: 'TEAM_LEADER', org: 'INNOVEITY' },
    { email: 'preethi@gmail.com', role: 'INTERN', org: 'C2C' }
  ];

  for (const u of testUsers) {
    console.log(`--- Testing ${u.role}: ${u.email} (${u.org}) ---`);
    try {
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        userId: u.email,
        password: 'password123'
      });
      const token = loginRes.data.token;
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Teams
      const teamsRes = await axios.get(`${BASE_URL}/teams`, { headers });
      console.log(`✓ /teams returned ${teamsRes.data.length} team(s)`);
      if (teamsRes.data.length > 0) {
        teamsRes.data.forEach(t => {
          console.log(`  Team: "${t.name}" | Leader: ${t.leader?.name || 'None'} | Members: ${t.members?.length || 0}`);
          t.members?.forEach(m => {
            console.log(`    - Member: ${m.user?.name} (${m.user?.role || 'MEMBER'})`);
          });
        });
      }

      // 2. Fetch Attendance Logs
      const attRes = await axios.get(`${BASE_URL}/attendance/logs`, { headers });
      console.log(`✓ /attendance/logs returned ${attRes.data.length} log(s)`);

      // 3. Fetch Tasks
      const tasksRes = await axios.get(`${BASE_URL}/tasks`, { headers });
      console.log(`✓ /tasks returned ${tasksRes.data.length} task(s)`);

      console.log(`✅ ${u.role} (${u.org}) passed all API checks.\n`);
    } catch (err) {
      console.error(`❌ Error testing ${u.email}:`, err.response?.data || err.message);
    }
  }

  await prisma.$disconnect();
}

verifyTeamRoster();
