const prisma = require('../utils/db');
const { getEffectiveOrgId } = require('../utils/organizationScope');
const { logActivity } = require('../utils/activityLogger');
const { broadcastLeavePolicyUpdate } = require('../socket');
const {
  getCompanyLeavePolicy,
  setCompanyLeavePolicy,
  addLeaveTypeToCompany,
  removeLeaveTypeFromCompany,
  filterLeaveTypesForCompany,
  getCompanyLeaveTypeIds
} = require('../utils/companyLeavePolicyStore');

// Helper to auto-generate leave code (e.g. "Marriage Leave" -> "ML")
const generateLeaveCode = (name) => {
  if (!name) return 'LV';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
};

/**
 * Recalculate User Leave Balances for all active users in an organization
 * based on the authoritative Leave Policy and Leave Types.
 * Preserves already used/pending leave days.
 */
const recalculateCompanyUserBalances = async (organizationId) => {
  try {
    let policy = null;
    if (organizationId) {
      const orgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId }
      });
      policy = orgSettings?.leavePolicy || getCompanyLeavePolicy(organizationId);
    }
    if (!policy) {
      policy = await prisma.leavePolicy.findFirst({ where: { isGlobal: true } });
    }

    const allocationMode = policy?.allocationType || 'ANNUAL';

    const allLeaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });

    const companyLeaveTypes = filterLeaveTypesForCompany(allLeaveTypes, organizationId);

    const userWhere = organizationId ? { organizationId } : {};
    const companyUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true }
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (const u of companyUsers) {
      const userApprovedLeaves = await prisma.leaveRequest.findMany({
        where: { userId: u.id, status: 'APPROVED' }
      });

      for (const lt of companyLeaveTypes) {
        let usedThisYear = 0;
        let usedThisMonth = 0;

        for (const l of userApprovedLeaves) {
          const lType = (l.leaveType || l.type || '').toUpperCase();
          if (lType === lt.code.toUpperCase() || lType === lt.name.toUpperCase()) {
            const start = new Date(l.startDate);
            const days = l.totalDays !== undefined ? parseFloat(l.totalDays) : 1.0;
            if (start.getFullYear() === currentYear) {
              usedThisYear += days;
              if (start.getMonth() === currentMonth) {
                usedThisMonth += days;
              }
            }
          }
        }

        const existing = await prisma.userLeaveBalance.findUnique({
          where: {
            userId_leaveTypeId: {
              userId: u.id,
              leaveTypeId: lt.id
            }
          }
        });

        const carryForward = existing?.carryForward || 0;
        const annualDays = lt.annualDays !== undefined ? parseFloat(lt.annualDays) : 12.0;
        const monthlyCreditDays = lt.monthlyCreditDays !== undefined ? parseFloat(lt.monthlyCreditDays) : 1.0;

        let allocated = 0;
        let used = 0;
        let available = 0;

        if (allocationMode === 'MONTHLY') {
          allocated = monthlyCreditDays;
          used = usedThisMonth;
          available = Math.max(0, monthlyCreditDays + carryForward - usedThisMonth);
        } else {
          allocated = annualDays;
          used = usedThisYear;
          available = Math.max(0, annualDays + carryForward - usedThisYear);
        }

        await prisma.userLeaveBalance.upsert({
          where: {
            userId_leaveTypeId: {
              userId: u.id,
              leaveTypeId: lt.id
            }
          },
          update: {
            allocated,
            used,
            available,
            lastCreditedAt: new Date()
          },
          create: {
            userId: u.id,
            leaveTypeId: lt.id,
            allocated,
            used,
            pending: 0,
            available,
            carryForward: 0,
            expired: 0,
            lastCreditedAt: new Date()
          }
        });
      }
    }
  } catch (err) {
    console.error('Error recalculating company user balances:', err);
  }
};

/**
 * Auto-heal & backfill system default leave types across organizations.
 * Ensures WFH, CL, and SL exist and are marked as system leave types (isSystem: true).
 * Ensures EL and LOP are marked as non-system leave types (isSystem: false).
 */
const ensureSystemLeaveTypesSeeded = async (organizationId = null) => {
  try {
    let wfh = await prisma.leaveType.findFirst({ where: { code: 'WFH' } });
    if (!wfh) {
      wfh = await prisma.leaveType.create({
        data: {
          name: 'Work From Home',
          code: 'WFH',
          description: 'Remote work leave',
          color: '#3B82F6',
          icon: 'Home',
          displayOrder: 1,
          isPaid: true,
          annualDays: 24.0,
          monthlyCreditDays: 2.0,
          allowCarryForward: false,
          isSystem: true,
          isActive: true
        }
      });
    } else if (!wfh.isSystem || wfh.annualDays !== 24.0 || wfh.monthlyCreditDays !== 2.0) {
      wfh = await prisma.leaveType.update({
        where: { id: wfh.id },
        data: {
          isSystem: true,
          annualDays: 24.0,
          monthlyCreditDays: 2.0
        }
      });
    }

    await prisma.leaveType.updateMany({
      where: { code: { in: ['CL', 'SL'] } },
      data: { isSystem: true }
    });

    await prisma.leaveType.updateMany({
      where: { code: { in: ['EL', 'LOP'] } },
      data: { isSystem: false }
    });

    if (organizationId) {
      const companyTypeIds = getCompanyLeaveTypeIds(organizationId);
      if (companyTypeIds && !companyTypeIds.includes(wfh.id)) {
        addLeaveTypeToCompany(organizationId, wfh.id);
      }
    } else {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        const companyTypeIds = getCompanyLeaveTypeIds(org.id);
        if (companyTypeIds && !companyTypeIds.includes(wfh.id)) {
          addLeaveTypeToCompany(org.id, wfh.id);
        }
      }
    }
  } catch (err) {
    console.error('Error auto-healing system leave types:', err);
  }
};

// 1. Get Leave Policy & Leave Types per Company Scope
const getGlobalLeavePolicy = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);

    await ensureSystemLeaveTypesSeeded(organizationId);

    let policy;
    if (organizationId) {
      const orgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId }
      });
      policy = orgSettings?.leavePolicy || getCompanyLeavePolicy(organizationId);
    } else {
      policy = await prisma.leavePolicy.findFirst({ where: { isGlobal: true } });
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
    }

    const allLeaveTypes = await prisma.leaveType.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    // Auto-seed system leave types for new company if none registered yet
    if (organizationId) {
      const companyTypeIds = getCompanyLeaveTypeIds(organizationId);
      if (!companyTypeIds) {
        allLeaveTypes.forEach((lt) => addLeaveTypeToCompany(organizationId, lt.id));
      }
    }

    const leaveTypes = filterLeaveTypesForCompany(allLeaveTypes, organizationId);

    res.json({
      policy,
      leaveTypes
    });
  } catch (error) {
    console.error('Get leave policy error:', error);
    res.status(500).json({ message: 'Failed to fetch leave policy settings.' });
  }
};

// 2. Update Leave Policy Settings per Company Scope
const updateGlobalLeavePolicy = async (req, res) => {
  try {
    const {
      organizationId: bodyOrgId,
      allocationType,
      carryForwardEnabled,
      maxCarryForwardDays,
      halfDayAllowed,
      workingDaysOnly,
      autoApproval
    } = req.body;

    const orgId = getEffectiveOrgId(req) || bodyOrgId;

    const policyData = {
      allocationType: allocationType || 'ANNUAL',
      carryForwardEnabled: carryForwardEnabled !== undefined ? carryForwardEnabled : true,
      maxCarryForwardDays: maxCarryForwardDays !== undefined ? parseFloat(maxCarryForwardDays) : 5.0,
      halfDayAllowed: halfDayAllowed !== undefined ? halfDayAllowed : true,
      workingDaysOnly: workingDaysOnly !== undefined ? workingDaysOnly : true,
      autoApproval: autoApproval !== undefined ? autoApproval : false,
      updatedAt: new Date().toISOString()
    };

    if (orgId) {
      await prisma.organizationSettings.upsert({
        where: { organizationId: orgId },
        update: { leavePolicy: policyData },
        create: { organizationId: orgId, leavePolicy: policyData }
      });

      setCompanyLeavePolicy(orgId, policyData);
      await recalculateCompanyUserBalances(orgId);

      const updatedPolicy = policyData;

      await logActivity({
        userId: req.user.id,
        action: 'LEAVE_POLICY_UPDATED',
        details: `Updated leave policy settings for organization "${orgId}": Allocation=${updatedPolicy.allocationType}`
      });

      broadcastLeavePolicyUpdate(orgId, { organizationId: orgId, policy: updatedPolicy });

      return res.json({
        message: 'Company leave policy updated successfully.',
        policy: updatedPolicy
      });
    }

    // Global Fallback (Update all tenant settings & global model)
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

    const orgs = await prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      await prisma.organizationSettings.upsert({
        where: { organizationId: org.id },
        update: { leavePolicy: policyData },
        create: { organizationId: org.id, leavePolicy: policyData }
      });
      setCompanyLeavePolicy(org.id, policyData);
      await recalculateCompanyUserBalances(org.id);
      broadcastLeavePolicyUpdate(org.id, { organizationId: org.id, policy: policyData });
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
    res.status(500).json({ message: 'Failed to update leave policy.' });
  }
};

// 3. Create Custom Leave Type
const createLeaveType = async (req, res) => {
  try {
    const {
      organizationId: bodyOrgId,
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

    const organizationId = getEffectiveOrgId(req) || bodyOrgId;

    if (!name) {
      return res.status(400).json({ message: 'Leave Type Name is required.' });
    }

    const cleanName = name.trim();
    const finalCode = (code && code.trim()) ? code.trim().toUpperCase() : generateLeaveCode(cleanName);

    // Per-company duplicate check
    const allTypes = await prisma.leaveType.findMany();
    const companyTypes = filterLeaveTypesForCompany(allTypes, organizationId);

    const duplicate = companyTypes.find(
      (lt) => lt.name.toLowerCase() === cleanName.toLowerCase() || lt.code.toUpperCase() === finalCode
    );

    if (duplicate) {
      return res.status(400).json({ message: 'A leave type with this name or code already exists for this company.' });
    }

    // Format unique master values if same name/code exists globally in another company
    const globalMatch = allTypes.find((lt) => lt.name.toLowerCase() === cleanName.toLowerCase() || lt.code.toUpperCase() === finalCode);
    let masterCode = finalCode;
    let masterName = cleanName;
    if (globalMatch && organizationId) {
      masterCode = `${finalCode}-${organizationId.slice(-4).toUpperCase()}`;
      masterName = `${cleanName} (${organizationId.slice(-4).toUpperCase()})`;
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name: globalMatch ? masterName : cleanName,
        code: globalMatch ? masterCode : finalCode,
        description: description || null,
        color: color || '#3B82F6',
        icon: icon || 'Calendar',
        displayOrder: displayOrder ? parseInt(displayOrder, 10) : companyTypes.length + 1,
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

    if (organizationId) {
      addLeaveTypeToCompany(organizationId, leaveType.id);
    }

    await recalculateCompanyUserBalances(organizationId);
    broadcastLeavePolicyUpdate(organizationId);

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_CREATED',
      details: `Created leave type ${cleanName} (${finalCode}) with annual allowance ${leaveType.annualDays} days.`
    });

    res.status(201).json({
      message: `Leave type ${cleanName} created successfully.`,
      leaveType: {
        ...leaveType,
        name: cleanName,
        code: finalCode
      }
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

    const orgId = getEffectiveOrgId(req);

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

    await recalculateCompanyUserBalances(orgId);
    broadcastLeavePolicyUpdate(orgId);

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
    const orgId = getEffectiveOrgId(req);
    const lt = await prisma.leaveType.findUnique({ where: { id } });

    if (!lt) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    const updated = await prisma.leaveType.update({
      where: { id },
      data: { isActive: !lt.isActive }
    });

    await recalculateCompanyUserBalances(orgId);
    broadcastLeavePolicyUpdate(orgId);

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

// 6. Delete Leave Type (Custom & non-core types allowed, protected core types WFH, CL, SL rejected)
const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = getEffectiveOrgId(req);
    const lt = await prisma.leaveType.findUnique({ where: { id } });

    if (!lt) {
      return res.status(404).json({ success: false, message: 'Leave type not found.' });
    }

    const isProtectedCode = ['WFH', 'CL', 'SL'].includes((lt.code || '').toUpperCase());
    if (isProtectedCode) {
      return res.status(403).json({
        success: false,
        message: 'System leave types cannot be deleted.'
      });
    }

    if (orgId) {
      removeLeaveTypeFromCompany(orgId, id);
    }

    // Clean up UserLeaveBalance records for this deleted leave type
    await prisma.userLeaveBalance.deleteMany({
      where: { leaveTypeId: id }
    }).catch(() => {});

    // Try deleting master record; if referenced in LeaveRequests, disable it globally
    try {
      await prisma.leaveType.delete({ where: { id } });
    } catch (e) {
      await prisma.leaveType.update({
        where: { id },
        data: { isActive: false }
      }).catch(() => {});
    }

    await recalculateCompanyUserBalances(orgId);
    broadcastLeavePolicyUpdate(orgId);

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_DELETED',
      details: `Deleted leave type ${lt.name} (${lt.code}).`
    });

    res.json({ success: true, message: `Leave type ${lt.name} deleted successfully.` });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete leave type.' });
  }
};

// 7. Get User Leave Balances (All users or specific user)
const getUserLeaveBalances = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, role: true, organizationId: true }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const orgId = req.query.organizationId || targetUser.organizationId;

    let policy = null;
    if (orgId) {
      const orgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId: orgId }
      });
      policy = orgSettings?.leavePolicy || getCompanyLeavePolicy(orgId);
    }
    if (!policy) {
      policy = await prisma.leavePolicy.findFirst({ where: { isGlobal: true } });
    }

    const allocationMode = policy?.allocationType || 'ANNUAL';

    const allLeaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });

    const companyLeaveTypes = filterLeaveTypesForCompany(allLeaveTypes, orgId);

    for (const lt of companyLeaveTypes) {
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
      where: {
        userId: targetUserId,
        leaveType: { isActive: true }
      },
      include: { leaveType: true },
      orderBy: { leaveType: { displayOrder: 'asc' } }
    });

    const formattedTypes = balances.map((b) => {
      const lt = b.leaveType;
      const annualDays = lt.annualDays !== undefined ? parseFloat(lt.annualDays) : 12.0;
      const monthlyCreditDays = lt.monthlyCreditDays !== undefined ? parseFloat(lt.monthlyCreditDays) : 1.0;

      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        shortCode: lt.code,
        color: lt.color || '#3B82F6',
        icon: lt.icon || 'Calendar',
        annualDays,
        monthlyCreditDays,
        allocated: b.allocated,
        used: b.used,
        available: b.available,
        monthlyCredit: monthlyCreditDays,
        allowHalfDay: lt.allowHalfDay,
        allowCarryForward: lt.allowCarryForward
      };
    });

    const pendingRequestsCount = await prisma.leaveRequest.count({
      where: {
        userId: targetUserId,
        status: { in: ['PENDING', 'PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'] }
      }
    });

    const approvedRequestsCount = await prisma.leaveRequest.count({
      where: {
        userId: targetUserId,
        status: 'APPROVED'
      }
    });

    res.json({
      organizationId: orgId,
      allocationMode,
      policy,
      leaveTypes: formattedTypes,
      balances,
      pendingRequestsCount,
      approvedRequestsCount
    });
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
      include: { leaveType: true, user: { select: { name: true, employeeId: true, organizationId: true } } }
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

    if (balance.user?.organizationId) {
      broadcastLeavePolicyUpdate(balance.user.organizationId);
    }

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

// 9. Execute Annual Reset (Company-scoped)
const executeAnnualReset = async (req, res) => {
  try {
    const { organizationId } = req.body;
    const orgId = organizationId || req.query.organizationId;

    const policy = orgId ? getCompanyLeavePolicy(orgId) : await prisma.leavePolicy.findFirst({ where: { isGlobal: true } });
    const maxCF = policy?.maxCarryForwardDays || 5.0;

    const balanceWhere = orgId ? { user: { organizationId: orgId } } : {};

    const allBalances = await prisma.userLeaveBalance.findMany({
      where: balanceWhere,
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

    if (orgId) {
      broadcastLeavePolicyUpdate(orgId);
    }

    await logActivity({
      userId: req.user.id,
      action: 'ANNUAL_LEAVE_RESET',
      details: `Executed annual leave balance reset across ${resetCount} balance records${orgId ? ` for company "${orgId}"` : ''}.`
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
  executeAnnualReset,
  recalculateCompanyUserBalances
};
