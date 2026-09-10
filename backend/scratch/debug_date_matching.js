const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testRosterConsistencyFix() {
  const jeffersonEmail = 'jeffersonsamuel003@gmail.com';
  const loginJefferson = await axios.post(`${BASE_URL}/auth/login`, { userId: jeffersonEmail, password: 'password123' });
  const headers = { Authorization: `Bearer ${loginJefferson.data.token}` };
  const logsRes = await axios.get(`${BASE_URL}/attendance/logs`, { headers });

  const todayStr = new Date().toLocaleDateString('en-CA');
  console.log('todayStr:', todayStr);

  logsRes.data.forEach(log => {
    const logDateStr = new Date(log.date).toLocaleDateString('en-CA');
    if (log.userId === loginJefferson.data.user.id) {
      console.log(`Log ID: ${log.id} | log.date: ${log.date} | logDateStr: ${logDateStr} | clockIn: ${log.clockIn} | status: ${log.status} | matchesToday: ${logDateStr === todayStr}`);
    }
  });
}

testRosterConsistencyFix();
