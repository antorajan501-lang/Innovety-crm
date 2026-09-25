const prisma = require('../backend/src/utils/db');
const fs = require('fs');
const path = require('path');

async function inspectPolicyStore() {
  const orgSettings = await prisma.organizationSettings.findMany();
  console.log('--- OrganizationSettings.leavePolicy in DB ---');
  orgSettings.forEach(os => {
    console.log(`Org: ${os.organizationId}`);
    console.log(JSON.stringify(os.leavePolicy, null, 2));
  });

  const jsonPath = path.join(__dirname, '../backend/src/data/company_leave_policies.json');
  if (fs.existsSync(jsonPath)) {
    console.log('\n--- company_leave_policies.json ---');
    console.log(fs.readFileSync(jsonPath, 'utf8'));
  }
  await prisma.$disconnect();
}

inspectPolicyStore().catch(console.error);
