const prisma = require('../utils/db');
const { createDefaultShift } = require('./shiftService');

/**
 * Service to manage employee lifecycle: Onboarding & Offboarding
 */

const DEFAULT_ONBOARDING_CHECKLIST = [
  { id: 'profile', title: 'Employee Profile Created', completed: true, required: true },
  { id: 'shift', title: 'Default Company Shift Assigned', completed: true, required: true },
  { id: 'leave', title: 'Annual Leave Balances Provisioned', completed: true, required: true },
  { id: 'payroll', title: 'Payroll Profile Initialized', completed: true, required: true },
  { id: 'documents', title: 'Statutory Documents (ID / PAN) Verified', completed: false, required: true },
  { id: 'assets', title: 'IT Hardware & Workstation Setup', completed: false, required: false },
  { id: 'orientation', title: 'Welcome Induction & Company NDA Signed', completed: false, required: false }
];

/**
 * Executes or verifies onboarding for an employee
 */
const onboardEmployee = async ({
  userId,
  employeeData,
  organizationId,
  actorId
}) => {
  if (!organizationId) {
    throw new Error('Organization ID is required for employee onboarding.');
  }

  let user = null;

  if (userId) {
    user = await prisma.user.findFirst({
      where: { id: userId, organizationId }
    });
    if (!user) {
      throw new Error('Employee not found in this organization.');
    }
  } else if (employeeData) {
    // Generate or format employee
    const email = employeeData.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error(`User with email "${email}" already exists.`);
    }

    let employeeId = employeeData.employeeId;
    if (!employeeId) {
      let candidate = `EMP-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
      while (await prisma.user.findUnique({ where: { employeeId: candidate } })) {
        candidate = `EMP-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
      }
      employeeId = candidate;
    }

    user = await prisma.user.create({
      data: {
        name: employeeData.name.trim(),
        email,
        employeeId,
        password: employeeData.password || '$2b$10$dummyhashedpasswordplaceholdersalt',
        role: employeeData.role || 'EMPLOYEE',
        department: employeeData.department || 'General',
        branchId: employeeData.branchId || null,
        organizationId,
        status: 'ACTIVE',
        joiningDate: employeeData.joiningDate ? new Date(employeeData.joiningDate) : new Date()
      }
    });
  } else {
    throw new Error('Either userId or employeeData must be provided for onboarding.');
  }

  // 1. Ensure Default Shift assignment
  const defaultShift = await createDefaultShift(organizationId);
  const existingShiftMember = await prisma.shiftMember.findFirst({
    where: { userId: user.id }
  });

  if (!existingShiftMember) {
    await prisma.shiftMember.create({
      data: {
        shiftId: defaultShift.id,
        userId: user.id
      }
    });
  }

  // 2. Ensure Leave Balances Provisioned
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

  if (leaveTypes.length > 0) {
    for (const lt of leaveTypes) {
      const existingBal = await prisma.userLeaveBalance.findFirst({
        where: {
          userId: user.id,
          leaveTypeId: lt.id
        }
      });

      if (!existingBal) {
        await prisma.userLeaveBalance.create({
          data: {
            userId: user.id,
            leaveTypeId: lt.id,
            allocated: lt.annualDays || 12.0,
            available: lt.annualDays || 12.0,
            used: 0.0,
            pending: 0.0,
            carryForward: 0.0,
            expired: 0.0
          }
        });
      }
    }
  }

  // 3. Ensure Payroll Profile / Salary Structure initialized
  const existingSalary = await prisma.salaryStructure.findFirst({
    where: { userId: user.id }
  });

  if (!existingSalary) {
    const basic = employeeData?.baseSalary ? parseFloat(employeeData.baseSalary) : 25000;
    const hra = basic * 0.4;
    const gross = basic + hra;
    const net = gross - 200;

    await prisma.salaryStructure.create({
      data: {
        userId: user.id,
        organizationId,
        basicSalary: basic,
        hra,
        grossSalary: gross,
        netSalary: net,
        effectiveFrom: new Date()
      }
    });
  }

  // 4. Update customData with Welcome Checklist
  const customData = user.customData && typeof user.customData === 'object' ? user.customData : {};
  customData.onboardingChecklist = DEFAULT_ONBOARDING_CHECKLIST;
  customData.onboardedAt = new Date().toISOString();
  customData.onboardedById = actorId || null;

  await prisma.user.update({
    where: { id: user.id },
    data: { customData }
  });

  // 5. Log Audit Event
  await prisma.organizationAuditLog.create({
    data: {
      organizationId,
      action: 'ONBOARDING_COMPLETED',
      category: 'WORKFORCE',
      entityType: 'User',
      entityId: user.id,
      performedById: actorId || null,
      targetUserId: user.id,
      details: {
        employeeName: user.name,
        employeeId: user.employeeId,
        defaultShiftName: defaultShift.name
      }
    }
  });

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      employeeId: user.employeeId,
      email: user.email,
      department: user.department,
      status: user.status
    },
    defaultShiftAssigned: defaultShift.name,
    checklist: DEFAULT_ONBOARDING_CHECKLIST
  };
};

/**
 * Executes offboarding workflow for departing employee
 * STRICT INVARIANT: Preserves historical attendance, leaves, and payroll records without deletion.
 */
const offboardEmployee = async ({
  userId,
  organizationId,
  actorId,
  checklistNotes,
  finalSettlementNotes
}) => {
  if (!userId || !organizationId) {
    throw new Error('User ID and Organization ID are required for offboarding.');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId }
  });

  if (!user) {
    throw new Error('Employee not found.');
  }

  // 1. Process Asset Return
  const assignedAssets = await prisma.asset.findMany({
    where: { assignedToId: user.id }
  });

  const returnedAssetList = [];
  for (const asset of assignedAssets) {
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        assignedToId: null,
        status: 'AVAILABLE',
        returnDate: new Date(),
        notes: `Returned during employee offboarding on ${new Date().toLocaleDateString()}`
      }
    });

    // Record in asset assignment history
    await prisma.assetAssignment.updateMany({
      where: { assetId: asset.id, userId: user.id, status: 'ACTIVE' },
      data: {
        status: 'RETURNED',
        returnDate: new Date(),
        conditionOnReturn: 'Good',
        remarks: 'Returned upon offboarding'
      }
    });

    returnedAssetList.push({ id: asset.id, name: asset.name, serialNumber: asset.serialNumber });
  }

  // 2. Disable login & Archive profile
  const customData = user.customData && typeof user.customData === 'object' ? user.customData : {};
  customData.offboardedAt = new Date().toISOString();
  customData.offboardedById = actorId || null;
  customData.offboardingNotes = checklistNotes || null;
  customData.finalSettlementNotes = finalSettlementNotes || null;
  customData.returnedAssets = returnedAssetList;

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      status: 'ARCHIVED',
      customData
    }
  });

  // 3. Log Audit Event
  await prisma.organizationAuditLog.create({
    data: {
      organizationId,
      action: 'OFFBOARDING_COMPLETED',
      category: 'WORKFORCE',
      entityType: 'User',
      entityId: user.id,
      performedById: actorId || null,
      targetUserId: user.id,
      details: {
        employeeName: user.name,
        employeeId: user.employeeId,
        returnedAssetsCount: returnedAssetList.length,
        notes: checklistNotes
      }
    }
  });

  return {
    success: true,
    message: `Employee ${user.name} (${user.employeeId}) has been offboarded and archived. Historical records preserved.`,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      employeeId: updatedUser.employeeId,
      status: updatedUser.status
    },
    returnedAssets: returnedAssetList
  };
};

/**
 * Returns lifecycle details for an employee
 */
const getLifecycleStatus = async (userId, organizationId) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    include: {
      branch: true,
      shiftAssignment: {
        include: { shift: true }
      },
      assignedAssets: true,
      userLeaveBalances: {
        include: { leaveType: true }
      },
      salaryStructure: true
    }
  });

  if (!user) {
    throw new Error('Employee not found.');
  }

  const customData = user.customData && typeof user.customData === 'object' ? user.customData : {};
  const checklist = customData.onboardingChecklist || DEFAULT_ONBOARDING_CHECKLIST;

  return {
    userId: user.id,
    name: user.name,
    employeeId: user.employeeId,
    email: user.email,
    department: user.department,
    branch: user.branch?.name || 'Headquarters',
    status: user.status,
    joiningDate: user.joiningDate,
    shift: user.shiftAssignment?.shift?.name || 'Company Default Shift',
    assignedAssets: user.assignedAssets,
    leaveBalances: user.userLeaveBalances,
    hasSalaryStructure: !!user.salaryStructure,
    checklist,
    onboardedAt: customData.onboardedAt || null,
    offboardedAt: customData.offboardedAt || null
  };
};

/**
 * Returns summary roster of employees by lifecycle stage
 */
const getLifecycleRoster = async (organizationId) => {
  const where = organizationId ? { organizationId } : {};

  const [activeEmployees, archivedEmployees, totalEmployees] = await Promise.all([
    prisma.user.findMany({
      where: { ...where, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        employeeId: true,
        department: true,
        joiningDate: true,
        role: true,
        status: true
      },
      orderBy: { joiningDate: 'desc' },
      take: 20
    }),
    prisma.user.findMany({
      where: { ...where, status: 'ARCHIVED' },
      select: {
        id: true,
        name: true,
        employeeId: true,
        department: true,
        joiningDate: true,
        role: true,
        status: true,
        customData: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    }),
    prisma.user.count({ where })
  ]);

  return {
    totalEmployees,
    activeCount: activeEmployees.length,
    archivedCount: archivedEmployees.length,
    recentOnboarded: activeEmployees,
    recentOffboarded: archivedEmployees
  };
};

module.exports = {
  onboardEmployee,
  offboardEmployee,
  getLifecycleStatus,
  getLifecycleRoster
};
