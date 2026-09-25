const prisma = require('../backend/src/utils/db');
const fs = require('fs');
const path = require('path');
const { recalculateCompanyUserBalances } = require('../backend/src/controllers/leavePolicyController');

async function run() {
  const jsonPath = path.join(__dirname, '../backend/src/data/company_leave_policies.json');
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(raw);
    for (const orgId in data.policies || {}) {
      const pol = data.policies[orgId];
      if (pol.roles) {
        for (const role in pol.roles) {
          if (pol.roles[role].allowances) {
            delete pol.roles[role].allowances.EMERGENCY;
            delete pol.roles[role].allowances.EL;
          }
        }
      }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Cleaned company_leave_policies.json');
  }

  const allSettings = await prisma.organizationSettings.findMany();
  for (const s of allSettings) {
    if (s.leavePolicy && typeof s.leavePolicy === 'object') {
      const pol = s.leavePolicy;
      let changed = false;
      if (pol.roles) {
        for (const role in pol.roles) {
          if (pol.roles[role].allowances) {
            if (pol.roles[role].allowances.EMERGENCY || pol.roles[role].allowances.EL) {
              delete pol.roles[role].allowances.EMERGENCY;
              delete pol.roles[role].allowances.EL;
              changed = true;
            }
          }
        }
      }
      if (changed) {
        await prisma.organizationSettings.update({
          where: { id: s.id },
          data: { leavePolicy: pol }
        });
        console.log(`Updated organizationSettings for orgId: ${s.organizationId}`);
      }
      if (s.organizationId) {
        await recalculateCompanyUserBalances(s.organizationId);
      }
    }
  }
  console.log('Cleanup completed successfully!');
}

run().catch(console.error).finally(() => prisma.$disconnect());
