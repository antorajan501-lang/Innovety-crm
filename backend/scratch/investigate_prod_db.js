const axios = require('axios');

const PROD_BASE = 'https://crm.innoveity.tech/api';

async function probePublicData() {
  console.log('=== FORENSIC PROBE: PRODUCTION DATABASE DATA ===\n');

  const getEndpoints = [
    '/organizations',
    '/users',
    '/teams',
    '/projects',
    '/subscription-plans'
  ];

  for (const path of getEndpoints) {
    try {
      const res = await axios.get(`${PROD_BASE}${path}`, { timeout: 10000 });
      console.log(`[GET ${path}] Status: ${res.status}`);
      console.log(`  Data: ${JSON.stringify(res.data).slice(0, 200)}`);
    } catch (err) {
      console.log(`[GET ${path}] Status: ${err.response?.status || 'NO_RESPONSE'}`);
      if (err.response) {
        console.log(`  Body: ${JSON.stringify(err.response.data).slice(0, 200)}`);
      } else {
        console.log(`  Message: ${err.message}`);
      }
    }
  }
}

probePublicData();
