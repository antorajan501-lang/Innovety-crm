const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testRosterConsistency() {
  console.log('=== TESTING TEAM ROSTER ATTENDANCE CONSISTENCY ===\n');

  // Raghul (INTERN in INNOVEITY)
  const raghulEmail = 'prasathragul75@gmail.com';
  // Team Leader (INNOVEITY)
  const tlEmail = 'somusuraj72@gmail.com';
  // Other Intern (INNOVEITY)
  const antoEmail = 'antorajan501@gmail.com';

  const loginRaghul = await axios.post(`${BASE_URL}/auth/login`, { userId: raghulEmail, password: 'password123' });
  const raghulToken = loginRaghul.data.token;
  const raghulId = loginRaghul.data.user.id;
  console.log(`Raghul User ID: ${raghulId}`);

  const loginTL = await axios.post(`${BASE_URL}/auth/login`, { userId: tlEmail, password: 'password123' });
  const tlToken = loginTL.data.token;

  const loginAnto = await axios.post(`${BASE_URL}/auth/login`, { userId: antoEmail, password: 'password123' });
  const antoToken = loginAnto.data.token;

  // 1. Clock in Raghul (if not clocked in)
  try {
    const clockInRes = await axios.post(`${BASE_URL}/attendance/clock-in`, {
      workLocation: 'OFFICE',
      latitude: 12.971598,
      longitude: 77.594562
    }, { headers: { Authorization: `Bearer ${raghulToken}` } });
    console.log('✓ Clocked in Raghul:', clockInRes.data.message || 'Success');
  } catch (err) {
    console.log('Clock in info:', err.response?.data?.message || err.message);
  }

  // 2. Fetch logs as Raghul
  const raghulLogs = await axios.get(`${BASE_URL}/attendance/logs`, { headers: { Authorization: `Bearer ${raghulToken}` } });
  // 3. Fetch logs as TL
  const tlLogs = await axios.get(`${BASE_URL}/attendance/logs`, { headers: { Authorization: `Bearer ${tlToken}` } });
  // 4. Fetch logs as Anto
  const antoLogs = await axios.get(`${BASE_URL}/attendance/logs`, { headers: { Authorization: `Bearer ${antoToken}` } });

  const todayStr = new Date().toLocaleDateString('en-CA');
  console.log(`Today Date String (en-CA): ${todayStr}`);

  const findRaghulTodayLog = (logs, viewerName) => {
    const userLogs = logs.data.filter(l => l.userId === raghulId);
    console.log(`\n[Viewer: ${viewerName}] Total logs for Raghul: ${userLogs.length}`);
    userLogs.forEach(l => {
      const lDateStr = new Date(l.date).toLocaleDateString('en-CA');
      const isToday = lDateStr === todayStr;
      console.log(`  - Log ID: ${l.id} | date raw: ${l.date} | date parsed: ${lDateStr} | isToday: ${isToday} | clockIn: ${l.clockIn} | status: ${l.status}`);
    });
  };

  findRaghulTodayLog(raghulLogs, 'Raghul');
  findRaghulTodayLog(tlLogs, 'Team Leader');
  findRaghulTodayLog(antoLogs, 'Anto (Intern)');
}

testRosterConsistency();
