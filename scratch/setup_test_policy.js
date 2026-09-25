const prisma = require('../backend/src/utils/db');
const axios = require('../backend/node_modules/axios');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { addLeaveTypeToCompany } = require('../backend/src/utils/companyLeavePolicyStore');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_BASE = 'http://localhost:5000/api';

async function setup() {
  const orgId = 'cmteaqlih0000sj52wckjbgci'; // Innoveity Tech
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const adminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Ensure EL (Emergency Leave) exists
  let elType = await prisma.leaveType.findFirst({
    where: { code: 'EL' }
  });

  if (!elType) {
    elType = await prisma.leaveType.create({
      data: {
        name: 'Emergency Leave',
        code: 'EL',
        description: 'Leave for unforeseen emergencies',
        color: '#F59E0B',
        icon: 'AlertCircle',
        displayOrder: 3,
        isPaid: true,
        annualDays: 6.0,
        monthlyCreditDays: 0.5,
        allowCarryForward: false,
        requireDoc: false,
        allowHalfDay: true,
        isSystem: false,
        isActive: true
      }
    });
    console.log('✓ Created Emergency Leave (EL):', elType.id);
  } else {
    console.log('✓ Found Emergency Leave (EL):', elType.id);
  }

  addLeaveTypeToCompany(orgId, elType.id);
  console.log('✓ Assigned EL to organization', orgId);

  // 2. Set Organization Base Policy to MONTHLY
  console.log('\n--- Setting Company Base Policy to MONTHLY ---');
  await axios.put(`${API_BASE}/leave-policy`, {
    organizationId: orgId,
    allocationType: 'MONTHLY',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  }, { headers: { Authorization: `Bearer ${adminToken}` } });

  // 3. Configure Team Leader Policy: CL=5, SL=8, EL=0, WFH=3
  console.log('\n--- Configuring Team Leader Role Policy ---');
  const tlPayload = {
    organizationId: orgId,
    role: 'TEAM_LEADER',
    allocationType: 'MONTHLY',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false,
    allowances: {
      CL: { annualDays: 5, monthlyCreditDays: 5 },
      SL: { annualDays: 8, monthlyCreditDays: 8 },
      EL: { annualDays: 0, monthlyCreditDays: 0 },
      WFH: { annualDays: 36, monthlyCreditDays: 3 }
    }
  };

  const tlRes = await axios.put(`${API_BASE}/leave-policy`, tlPayload, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log('Save TL Policy Response:', tlRes.data.message);

  // 4. Test Team Leader API response
  console.log('\n--- Fetching Team Leader /api/leaves/balances ---');
  const tlUser = await prisma.user.findFirst({
    where: { organizationId: orgId, role: 'TEAM_LEADER' }
  });
  const tlToken = jwt.sign({ id: tlUser.id, role: tlUser.role, organizationId: orgId }, JWT_SECRET, { expiresIn: '1h' });

  const balRes = await axios.get(`${API_BASE}/leaves/balances`, {
    headers: { Authorization: `Bearer ${tlToken}` }
  });

  console.log('TL Balances Response Status:', balRes.status);
  console.log('allocationMode:', balRes.data.allocationMode);
  console.log('leaveTypes:');
  balRes.data.leaveTypes?.forEach(t => {
    console.log(`  - ${t.code} (${t.name}): available=${t.available}, allocated=${t.allocated}, monthlyCredit=${t.monthlyCredit}`);
  });
}

setup().catch(console.error).finally(() => prisma.$disconnect());
