const prisma = require('../src/utils/db');
const { applyLeave } = require('../src/controllers/leaveController');

async function debugApplyLeaveDirectly() {
  console.log('=== DIRECT APPLY LEAVE EXECUTION WITH FULL ERROR TRACE ===\n');

  const user = await prisma.user.findFirst({
    where: { email: 'employee@gmail.com' }
  });

  console.log('Target User:', user.id, user.name, user.email, user.role, user.organizationId);

  const req = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    },
    body: {
      leaveType: 'CASUAL',
      startDate: '2026-09-20',
      endDate: '2026-09-21',
      isHalfDay: false,
      reason: 'Testing leave request forensic analysis',
      contactPhone: '9876543210',
      letterContent: 'Testing leave request forensic analysis'
    }
  };

  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log(`[RESPONSE ${this.statusCode || 200}]`, data);
      return this;
    }
  };

  try {
    await applyLeave(req, res);
  } catch (err) {
    console.error('CRASH IN CONTROLLER EXECUTION:', err);
  }

  await prisma.$disconnect();
}

debugApplyLeaveDirectly();
