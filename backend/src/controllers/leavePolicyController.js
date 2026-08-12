const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');

// Helper to auto-generate leave code (e.g. "Marriage Leave" -> "ML")
const generateLeaveCode = (name) => {
  if (!name) return 'LV';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
};

// 1. Get Global Leave Policy & All Leave Types
const getGlobalLeavePolicy = async (req, res) => {
  try {
    let policy = await prisma.leavePolicy.findFirst({
      where: { isGlobal: true }
    });

    if (!policy) {
      policy = await prisma.leavePolicy.create({
        data: {
          isGlobal: true,
          allocationType: 'ANNUAL',
          carryForwardEnabled: true,
          maxCarryForwardDays: 5.0,
          halfDayAllowed: true,
          workingDaysOnly: true,
          autoApproval: false
        }
      });
    }

    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    res.json({
      policy,
      leaveTypes
    });
  } catch (error) {
    console.error('Get leave policy error:', error);
    res.status(500).json({ message: 'Failed to fetch global leave policy.' });
  }
};

// 2. Update Global Leave Policy Settings
const updateGlobalLeavePolicy = async (req, res) => {
  try {
    const {
      allocationType,
      carryForwardEnabled,
      maxCarryForwardDays,
      halfDayAllowed,
      workingDaysOnly,
      autoApproval
    } = req.body;

    let policy = await prisma.leavePolicy.findFirst({
      where: { isGlobal: true }
    });

    if (!policy) {
      policy = await prisma.leavePolicy.create({
        data: {
          isGlobal: true,
          allocationType: allocationType || 'ANNUAL',
          carryForwardEnabled: carryForwardEnabled !== undefined ? carryForwardEnabled : true,
          maxCarryForwardDays: parseFloat(maxCarryForwardDays) || 5.0,
          halfDayAllowed: halfDayAllowed !== undefined ? halfDayAllowed : true,
          workingDaysOnly: workingDaysOnly !== undefined ? workingDaysOnly : true,
          autoApproval: autoApproval !== undefined ? autoApproval : false
        }
      });
    } else {
      policy = await prisma.leavePolicy.update({
        where: { id: policy.id },
        data: {
          allocationType: allocationType || policy.allocationType,
          carryForwardEnabled: carryForwardEnabled !== undefined ? carryForwardEnabled : policy.carryForwardEnabled,
          maxCarryForwardDays: maxCarryForwardDays !== undefined ? parseFloat(maxCarryForwardDays) : policy.maxCarryForwardDays,
          halfDayAllowed: halfDayAllowed !== undefined ? halfDayAllowed : policy.halfDayAllowed,
          workingDaysOnly: workingDaysOnly !== undefined ? workingDaysOnly : policy.workingDaysOnly,
          autoApproval: autoApproval !== undefined ? autoApproval : policy.autoApproval
        }
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_POLICY_UPDATED',
      details: `Updated global leave policy settings: Allocation=${policy.allocationType}, CarryForward=${policy.carryForwardEnabled}`
    });

    res.json({
      message: 'Global leave policy updated successfully.',
      policy
    });
  } catch (error) {
    console.error('Update leave policy error:', error);
    res.status(500).json({ message: 'Failed to update global leave policy.' });
  }
};

// 3. Create Custom Leave Type
const createLeaveType = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      color,
      icon,
      displayOrder,
      isPaid,
      annualDays,
      monthlyCreditDays,
      allowCarryForward,
      requireDoc,
      allowHalfDay
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Leave Type Name is required.' });
    }

    const finalCode = (code && code.trim()) ? code.trim().toUpperCase() : generateLeaveCode(name);

    // Check duplicate name or code
    const existing = await prisma.leaveType.findFirst({
      where: {
        OR: [{ name: name.trim() }, { code: finalCode }]
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'A leave type with this name or code already exists.' });
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name: name.trim(),
        code: finalCode,
        description: description || null,
        color: color || '#3B82F6',
        icon: icon || 'Calendar',
        displayOrder: displayOrder ? parseInt(displayOrder, 10) : 0,
        isPaid: isPaid !== undefined ? isPaid : true,
        annualDays: annualDays !== undefined ? parseFloat(annualDays) : 12.0,
        monthlyCreditDays: monthlyCreditDays !== undefined ? parseFloat(monthlyCreditDays) : 1.0,
        allowCarryForward: allowCarryForward !== undefined ? allowCarryForward : false,
        requireDoc: requireDoc !== undefined ? requireDoc : false,
        allowHalfDay: allowHalfDay !== undefined ? allowHalfDay : true,
        isSystem: false,
        isActive: true
      }
    });

    // Initialize UserLeaveBalance for all existing users
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    for (const u of allUsers) {
      await prisma.userLeaveBalance.upsert({
        where: {
          userId_leaveTypeId: {
            userId: u.id,
            leaveTypeId: leaveType.id
          }
        },
        update: {},
        create: {
          userId: u.id,
          leaveTypeId: leaveType.id,
          allocated: leaveType.annualDays,
          used: 0,
          pending: 0,
          available: leaveType.annualDays,
          carryForward: 0,
          expired: 0,
          lastCreditedAt: new Date()
        }
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_CREATED',
      details: `Created leave type ${leaveType.name} (${leaveType.code}) with annual allowance ${leaveType.annualDays} days.`
    });

    res.status(201).json({
      message: `Leave type ${leaveType.name} created successfully.`,
      leaveType
    });
  } catch (error) {
    console.error('Create leave type error:', error);
    res.status(500).json({ message: error.message || 'Failed to create leave type.' });
  }
};

// 4. Update Leave Type
const updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      description,
      color,
      icon,
      displayOrder,
      isPaid,
      annualDays,
      monthlyCreditDays,
      allowCarryForward,
      requireDoc,
      allowHalfDay
    } = req.body;

    const existingLT = await prisma.leaveType.findUnique({ where: { id } });
    if (!existingLT) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingLT.name,
        code: code ? code.trim().toUpperCase() : existingLT.code,
        description: description !== undefined ? description : existingLT.description,
        color: color || existingLT.color,
        icon: icon || existingLT.icon,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder, 10) : existingLT.displayOrder,
        isPaid: isPaid !== undefined ? isPaid : existingLT.isPaid,
        annualDays: annualDays !== undefined ? parseFloat(annualDays) : existingLT.annualDays,
        monthlyCreditDays: monthlyCreditDays !== undefined ? parseFloat(monthlyCreditDays) : existingLT.monthlyCreditDays,
        allowCarryForward: allowCarryForward !== undefined ? allowCarryForward : existingLT.allowCarryForward,
        requireDoc: requireDoc !== undefined ? requireDoc : existingLT.requireDoc,
        allowHalfDay: allowHalfDay !== undefined ? allowHalfDay : existingLT.allowHalfDay
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_EDITED',
      details: `Updated leave type ${updated.name} (${updated.code}) settings.`
    });

    res.json({
      message: `Leave type ${updated.name} updated successfully.`,
      leaveType: updated
    });
  } catch (error) {
    console.error('Update leave type error:', error);
    res.status(500).json({ message: 'Failed to update leave type.' });
  }
};

// 5. Toggle Leave Type Active Status
const toggleLeaveTypeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const lt = await prisma.leaveType.findUnique({ where: { id } });

    if (!lt) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    const updated = await prisma.leaveType.update({
      where: { id },
      data: { isActive: !lt.isActive }
    });

    await logActivity({
      userId: req.user.id,
      action: updated.isActive ? 'LEAVE_TYPE_ENABLED' : 'LEAVE_TYPE_DISABLED',
      details: `${updated.isActive ? 'Enabled' : 'Disabled'} leave type ${updated.name}.`
    });

    res.json({
      message: `Leave type ${updated.name} is now ${updated.isActive ? 'Active' : 'Disabled'}.`,
      leaveType: updated
    });
  } catch (error) {
    console.error('Toggle leave type status error:', error);
    res.status(500).json({ message: 'Failed to toggle leave type status.' });
  }
};

// 6. Delete Leave Type (Custom types only, isSystem protected)
const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const lt = await prisma.leaveType.findUnique({ where: { id } });

    if (!lt) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    if (lt.isSystem) {
      return res.status(400).json({ message: 'System default leave types cannot be deleted. You can disable them instead.' });
    }

    await prisma.leaveType.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_DELETED',
      details: `Deleted custom leave type ${lt.name} (${lt.code}).`
    });

    res.json({ message: `Leave type ${lt.name} deleted successfully.` });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({ message: 'Failed to delete leave type.' });
  }
};

// 7. Get User Leave Balances (All users or specific user)
const getUserLeaveBalances = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;

    // Ensure all active LeaveTypes have a balance row for this user
    const activeLeaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
    for (const lt of activeLeaveTypes) {
      await prisma.userLeaveBalance.upsert({
        where: {
          userId_leaveTypeId: {
            userId: targetUserId,
            leaveTypeId: lt.id
          }
        },
        update: {},
        create: {
          userId: targetUserId,
          leaveTypeId: lt.id,
          allocated: lt.annualDays,
          used: 0,
          pending: 0,
          available: lt.annualDays,
          carryForward: 0,
          expired: 0,
          lastCreditedAt: new Date()
        }
      });
    }

    const balances = await prisma.userLeaveBalance.findMany({
      where: { userId: targetUserId },
      include: {
        leaveType: true
      },
      orderBy: { leaveType: { displayOrder: 'asc' } }
    });

    res.json(balances);
  } catch (error) {
    console.error('Get user leave balances error:', error);
    res.status(500).json({ message: 'Failed to fetch user leave balances.' });
  }
};

// 8. Manual Balance Adjustment (HR / Admin)
const adjustUserLeaveBalance = async (req, res) => {
  try {
    const { userId, leaveTypeId, adjustmentDays, reason } = req.body;

    if (!userId || !leaveTypeId || adjustmentDays === undefined || !reason) {
      return res.status(400).json({ message: 'User, Leave Type, Adjustment Days (+/-), and Reason are required.' });
    }

    const days = parseFloat(adjustmentDays);
    const balance = await prisma.userLeaveBalance.findUnique({
      where: {
        userId_leaveTypeId: { userId, leaveTypeId }
      },
      include: { leaveType: true, user: select => ({ name: true, employeeId: true }) }
    });

    if (!balance) {
      return res.status(404).json({ message: 'User leave balance record not found.' });
    }

    const newAllocated = Math.max(0, balance.allocated + days);
    const newAvailable = Math.max(0, balance.available + days);

    const updated = await prisma.userLeaveBalance.update({
      where: { id: balance.id },
      data: {
        allocated: newAllocated,
        available: newAvailable
      },
      include: { leaveType: true }
    });

    await logActivity({
      userId: req.user.id,
      action: 'MANUAL_BALANCE_ADJUSTED',
      details: `Adjusted leave balance for ${balance.user?.name || userId} (${balance.leaveType.name}): ${days > 0 ? '+' : ''}${days} days. Reason: ${reason}`
    });

    res.json({
      message: `Successfully adjusted balance by ${days > 0 ? '+' : ''}${days} days.`,
      balance: updated
    });
  } catch (error) {
    console.error('Adjust user leave balance error:', error);
    res.status(500).json({ message: 'Failed to adjust user leave balance.' });
  }
};

// 9. Execute Annual Reset
const executeAnnualReset = async (req, res) => {
  try {
    const policy = await prisma.leavePolicy.findFirst({ where: { isGlobal: true } });
    const maxCF = policy?.maxCarryForwardDays || 5.0;

    const allBalances = await prisma.userLeaveBalance.findMany({
      include: { leaveType: true }
    });

    let resetCount = 0;
    for (const b of allBalances) {
      let cfDays = 0;
      let expiredDays = 0;

      if (policy?.carryForwardEnabled && b.leaveType.allowCarryForward) {
        cfDays = Math.min(b.available, maxCF);
        expiredDays = Math.max(0, b.available - cfDays);
      } else {
        expiredDays = b.available;
      }

      const newAllocated = b.leaveType.annualDays + cfDays;

      await prisma.userLeaveBalance.update({
        where: { id: b.id },
        data: {
          allocated: newAllocated,
          used: 0,
          pending: 0,
          available: newAllocated,
          carryForward: cfDays,
          expired: expiredDays,
          lastCreditedAt: new Date()
        }
      });
      resetCount++;
    }

    await logActivity({
      userId: req.user.id,
      action: 'ANNUAL_LEAVE_RESET',
      details: `Executed annual leave balance reset across ${resetCount} balance records.`
    });

    res.json({
      message: `Annual leave reset executed successfully for ${resetCount} records.`
    });
  } catch (error) {
    console.error('Annual leave reset error:', error);
    res.status(500).json({ message: 'Failed to execute annual leave reset.' });
  }
};

module.exports = {
  getGlobalLeavePolicy,
  updateGlobalLeavePolicy,
  createLeaveType,
  updateLeaveType,
  toggleLeaveTypeStatus,
  deleteLeaveType,
  getUserLeaveBalances,
  adjustUserLeaveBalance,
  executeAnnualReset
};
