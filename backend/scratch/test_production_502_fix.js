const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000';

async function runProductionDiagnostic() {
  console.log('====================================================');
  console.log('PRODUCTION 502 BAD GATEWAY DIAGNOSTIC VERIFICATION');
  console.log('====================================================\n');

  const tests = [
    { name: 'GET /health', method: 'GET', url: `${BASE_URL}/health` },
    { name: 'GET /api/health', method: 'GET', url: `${BASE_URL}/api/health` },
    { name: 'GET /api/platform/settings', method: 'GET', url: `${BASE_URL}/api/platform/settings` },
    { name: 'GET /api/organizations (unauthenticated)', method: 'GET', url: `${BASE_URL}/api/organizations` },
    {
      name: 'POST /api/auth/login (Super Admin)',
      method: 'POST',
      url: `${BASE_URL}/api/auth/login`,
      data: { email: 'superadmin@enterprise-crm.com', password: 'password123' }
    },
    {
      name: 'POST /api/auth/login (C2C Admin)',
      method: 'POST',
      url: `${BASE_URL}/api/auth/login`,
      data: { email: 'vedha@gmail.com', password: 'password123' }
    },
    {
      name: 'POST /api/auth/login (Invalid Password)',
      method: 'POST',
      url: `${BASE_URL}/api/auth/login`,
      data: { email: 'vedha@gmail.com', password: 'wrongpassword' }
    }
  ];

  for (const t of tests) {
    try {
      const startTime = Date.now();
      const res = await axios({
        method: t.method,
        url: t.url,
        data: t.data,
        headers: { Origin: 'https://crm.innoveity.tech' },
        validateStatus: () => true // Don't throw on non-200 status codes
      });
      const duration = Date.now() - startTime;
      console.log(`[${t.name}] Status: ${res.status} | Response Time: ${duration}ms`);
      if (res.status === 200) {
        if (Array.isArray(res.data)) {
          console.log(`  Data Summary: Array of ${res.data.length} items`);
        } else if (res.data && typeof res.data === 'object') {
          const keys = Object.keys(res.data).slice(0, 5);
          console.log(`  Data Summary: Object with keys [${keys.join(', ')}]`);
        }
      } else {
        console.log(`  Response Body:`, res.data);
      }
    } catch (err) {
      console.error(`[${t.name}] FAILED WITH ERROR:`, err.message);
    }
    console.log('---');
  }

  console.log('\n====================================================');
  console.log('DIAGNOSTIC TEST SUITE COMPLETED');
  console.log('====================================================');
}

runProductionDiagnostic();
