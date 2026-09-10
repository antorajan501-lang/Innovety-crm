const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function debugLogs() {
  const loginJefferson = await axios.post(`${BASE_URL}/auth/login`, { userId: 'jeffersonsamuel003@gmail.com', password: 'password123' });
  const headers = { Authorization: `Bearer ${loginJefferson.data.token}` };
  const logsRes = await axios.get(`${BASE_URL}/attendance/logs`, { headers });

  const todayStr = new Date().toLocaleDateString('en-CA');
  console.log('todayStr (en-CA):', todayStr);

  const jeffLogs = logsRes.data.filter(l => l.userId === loginJefferson.data.user.id);
  console.log(`Found ${jeffLogs.length} logs for Jefferson:`);
  jeffLogs.forEach(l => {
    const parsed = new Date(l.date).toLocaleDateString('en-CA');
    console.log(`- ID: ${l.id} | raw date: ${l.date} | parsed date (en-CA): ${parsed} | status: ${l.status} | clockIn: ${l.clockIn}`);
  });
}

debugLogs();
