const axios = require('axios');

// Default target URL is live production domain; can also accept custom base URL parameter
const BASE_URL = process.argv[2] || 'https://crm.innoveity.tech';

async function runProductionEndpointVerification() {
  console.log('====================================================');
  console.log(`PRODUCTION ENDPOINT VERIFICATION: ${BASE_URL}`);
  console.log('====================================================\n');

  const endpoints = [
    {
      name: 'GET /api/health',
      method: 'GET',
      url: `${BASE_URL}/api/health`
    },
    {
      name: 'GET /health',
      method: 'GET',
      url: `${BASE_URL}/health`
    },
    {
      name: 'GET /api/platform/settings',
      method: 'GET',
      url: `${BASE_URL}/api/platform/settings`
    },
    {
      name: 'GET /api/organizations',
      method: 'GET',
      url: `${BASE_URL}/api/organizations`
    },
    {
      name: 'POST /api/auth/login (Invalid Credentials Check)',
      method: 'POST',
      url: `${BASE_URL}/api/auth/login`,
      data: { email: 'verification_probe@innoveity.tech', password: 'invalid_password_probe' }
    }
  ];

  for (const ep of endpoints) {
    const startTime = Date.now();
    try {
      const res = await axios({
        method: ep.method,
        url: ep.url,
        data: ep.data,
        headers: {
          'Origin': 'https://crm.innoveity.tech',
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Allow all status codes to inspect responses
      });
      const responseTime = Date.now() - startTime;

      console.log(`Endpoint: ${ep.name}`);
      console.log(`  - Target URL: ${ep.url}`);
      console.log(`  - HTTP Status: ${res.status} ${res.statusText || ''}`);
      console.log(`  - Response Time: ${responseTime}ms`);
      console.log(`  - Response Body: ${JSON.stringify(res.data, null, 2)}\n`);
    } catch (err) {
      const responseTime = Date.now() - startTime;
      console.error(`Endpoint: ${ep.name}`);
      console.error(`  - Target URL: ${ep.url}`);
      console.error(`  - ERROR: ${err.message}`);
      console.error(`  - Response Time: ${responseTime}ms\n`);
    }
  }

  console.log('====================================================');
  console.log('VERIFICATION COMPLETE');
  console.log('====================================================');
}

runProductionEndpointVerification();
