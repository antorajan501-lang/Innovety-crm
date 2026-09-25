const prisma = require('../utils/db');
const { getEffectiveOrgId } = require('../utils/organizationScope');
const { logActivity } = require('../utils/activityLogger');
const { broadcastLeavePolicyUpdate } = require('../socket');
const {
  getCompanyLeavePolicy,
  setCompanyLeavePolicy,
  addLeaveTypeToCompany,
  removeLeaveTypeFromCompany,
  cleanupCompanyLeavePolicyReferences,
  filterLeaveTypesForCompany,
  getCompanyLeaveTypeIds,
  getAllAssignedLeaveTypeIds,
  normalizeRole
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

    const defaultAllocationMode = policy?.allocationType || 'ANNUAL';

    const allLeaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });

    const companyLeaveTypes = filterLeaveTypesForCompany(allLeaveTypes, organizationId);

    const userWhere = organizationId ? { organizationId } : {};
    const companyUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, role: true }
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    for (const u of companyUsers) {
      const userRole = normalizeRole(u.role);
      let userPolicy = null;
      if (organizationId) {
        if (orgSettings?.leavePolicy?.roles?.[userRole]) {
          userPolicy = {
            ...policy,
            ...orgSettings.leavePolicy.roles[userRole],
            allowances: {
              ...(policy?.allowances || {}),
              ...(orgSettings.leavePolicy.roles[userRole].allowances || {})
            }
          };
        } else {
          userPolicy = getCompanyLeavePolicy(organizationId, userRole);
        }
      }
      if (!userPolicy) userPolicy = policy;

      // Crucial: The company's active allocationType always determines the allocation mode for all company users
      const userAllocationMode = defaultAllocationMode || policy?.allocationType || 'ANNUAL';
      const roleAllowances = userPolicy?.allowances || {};

      const userApprovedLeaves = await prisma.leaveRequest.findMany({
        where: { userId: u.id, status: 'APPROVED' }
      });

      const userPendingLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId: u.id,
          status: { in: ['PENDING', 'PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'] }
        }
      });

      for (const lt of companyLeaveTypes) {
        if (!lt.isActive) continue;

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

        let pendingThisYear = 0;
        let pendingThisMonth = 0;

        for (const l of userPendingLeaves) {
          const lType = (l.leaveType || l.type || '').toUpperCase();
          if (lType === lt.code.toUpperCase() || lType === lt.name.toUpperCase()) {
            const start = new Date(l.startDate);
            const days = l.totalDays !== undefined ? parseFloat(l.totalDays) : 1.0;
            if (start.getFullYear() === currentYear) {
              pendingThisYear += days;
              if (start.getMonth() === currentMonth) {
                pendingThisMonth += days;
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

        const roleAllowance = roleAllowances[lt.code] || roleAllowances[lt.id] || roleAllowances[lt.name];
        const carryForward = existing?.carryForward || 0;
        const annualDays = (roleAllowance?.annualDays !== undefined && roleAllowance?.annualDays !== null)
          ? parseFloat(roleAllowance.annualDays)
          : (lt.annualDays !== undefined ? parseFloat(lt.annualDays) : 12.0);
        let monthlyCreditDays = (roleAllowance?.monthlyCreditDays !== undefined && roleAllowance?.monthlyCreditDays !== null)
          ? parseFloat(roleAllowance.monthlyCreditDays)
          : (lt.monthlyCreditDays !== undefined ? parseFloat(lt.monthlyCreditDays) : 1.0);

        if (userAllocationMode === 'MONTHLY' && roleAllowance) {
          if (roleAllowance.monthlyCreditDays !== undefined && roleAllowance.monthlyCreditDays !== null) {
            monthlyCreditDays = parseFloat(roleAllowance.monthlyCreditDays);
          } else if (roleAllowance.annualDays !== undefined && roleAllowance.annualDays !== null) {
            monthlyCreditDays = parseFloat(roleAllowance.annualDays);
          }
        }

        let allocated = 0;
        let used = 0;
        let pending = 0;
        let available = 0;

        if (userAllocationMode === 'MONTHLY') {
          allocated = monthlyCreditDays;
          used = usedThisMonth;
          pending = pendingThisMonth;
          available = Math.max(0, monthlyCreditDays + carryForward - usedThisMonth - pendingThisMonth);
        } else {
          allocated = annualDays;
          used = usedThisYear;
          pending = pendingThisYear;
          available = Math.max(0, annualDays + carryForward - usedThisYear - pendingThisYear);
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
            pending,
            available,
            lastCreditedAt: new Date()
          },
          create: {
            userId: u.id,
            leaveTypeId: lt.id,
            allocated,
            used,
            pending,
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
 * Only ensures CL and SL exist if database has no leave types at all.
 * Does not re-create deleted leave types.
 */
const ensureSystemLeaveTypesSeeded = async (organizationId = null) => {
  try {
    const totalTypes = await prisma.leaveType.count();
    if (totalTypes === 0) {
      await prisma.leaveType.createMany({
        data: [
          {
            name: 'Casual Leave',
            code: 'CL',
            description: 'Paid casual leave for personal obligations',
            color: '#10B981',
            icon: 'Calendar',
            displayOrder: 1,
            isPaid: true,
            annualDays: 12.0,
            monthlyCreditDays: 1.0,
            allowCarryForward: true,
            isSystem: true,
            isActive: true
          },
          {
            name: 'Sick Leave',
            code: 'SL',
            description: 'Paid medical and sick leave',
            color: '#EF4444',
            icon: 'Heart',
            displayOrder: 2,
            isPaid: true,
            annualDays: 10.0,
            monthlyCreditDays: 1.0,
            allowCarryForward: false,
            isSystem: true,
            isActive: true
          }
        ]
      });
    }

    await prisma.leaveType.updateMany({
      where: { code: { in: ['CL', 'SL'] } },
      data: { isSystem: true }
    });
  } catch (err) {
    console.error('Error in ensureSystemLeaveTypesSeeded:', err);
  }
};

// 1. Get Leave Policy & Leave Types per Company Scope
const getGlobalLeavePolicy = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const role = req.query.role || null;

    await ensureSystemLeaveTypesSeeded(organizationId);

    let policy;
    if (organizationId) {
      const orgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId }
      });
      const normRole = normalizeRole(role);
      policy = getCompanyLeavePolicy(organizationId, normRole);
      if (orgSettings?.leavePolicy) {
        if (normRole && orgSettings.leavePolicy.roles && (orgSettings.leavePolicy.roles[normRole] || orgSettings.leavePolicy.roles[role])) {
          policy = { ...policy, ...(orgSettings.leavePolicy.roles[normRole] || orgSettings.leavePolicy.roles[role]) };
        } else if (!role) {
          policy = { ...policy, ...orgSettings.leavePolicy };
        }
      }
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
    const roleAllowances = role ? (policy?.allowances || {}) : {};
    const formattedLeaveTypes = leaveTypes.map((lt) => {
      const roleAllowance = role ? (roleAllowances[lt.code] || roleAllowances[lt.id] || roleAllowances[lt.name]) : null;
      const annualDays = roleAllowance?.annualDays !== undefined && roleAllowance?.annualDays !== null
        ? parseFloat(roleAllowance.annualDays)
        : lt.annualDays;
      const monthlyCreditDays = roleAllowance?.monthlyCreditDays !== undefined && roleAllowance?.monthlyCreditDays !== null
        ? parseFloat(roleAllowance.monthlyCreditDays)
        : lt.monthlyCreditDays;

      return {
        ...lt,
        annualDays,
        monthlyCreditDays,
        monthlyCredit: monthlyCreditDays
      };
    });

    res.json({
      policy,
      leaveTypes: formattedLeaveTypes
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
      autoApproval,
      role,
      allowances
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

    if (role) {
      policyData.role = role;
      if (allowances && typeof allowances === 'object') {
        policyData.allowances = allowances;
      }
    }

    if (orgId) {
      const currentOrgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId: orgId }
      });

      let updatedOrgLeavePolicy = currentOrgSettings?.leavePolicy || {};
      if (typeof updatedOrgLeavePolicy !== 'object' || updatedOrgLeavePolicy === null) {
        updatedOrgLeavePolicy = {};
      }

      if (role) {
        if (!updatedOrgLeavePolicy.roles) updatedOrgLeavePolicy.roles = {};
        updatedOrgLeavePolicy.roles[role] = policyData;
        setCompanyLeavePolicy(orgId, policyData, role);
      } else {
        // Fetch all active company leave types
        const allActiveTypes = await prisma.leaveType.findMany({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' }
        });
        const companyTypes = filterLeaveTypesForCompany(allActiveTypes, orgId);
        const companyAllowances = {};
        for (const lt of companyTypes) {
          companyAllowances[lt.code] = {
            annualDays: (allowances && allowances[lt.code]?.annualDays !== undefined)
              ? parseFloat(allowances[lt.code].annualDays)
              : (parseFloat(lt.annualDays) || 0),
            monthlyCreditDays: (allowances && allowances[lt.code]?.monthlyCreditDays !== undefined)
              ? parseFloat(allowances[lt.code].monthlyCreditDays)
              : (parseFloat(lt.monthlyCreditDays) || 0)
          };
        }

        updatedOrgLeavePolicy = {
          ...updatedOrgLeavePolicy,
          ...policyData,
          allowances: companyAllowances
        };

        // Guarantee Team Leader uses latest company leave policy allowances
        if (!updatedOrgLeavePolicy.roles) updatedOrgLeavePolicy.roles = {};
        updatedOrgLeavePolicy.roles.TEAM_LEADER = {
          role: 'TEAM_LEADER',
          allocationType: policyData.allocationType,
          carryForwardEnabled: policyData.carryForwardEnabled,
          maxCarryForwardDays: policyData.maxCarryForwardDays,
          halfDayAllowed: policyData.halfDayAllowed,
          workingDaysOnly: policyData.workingDaysOnly,
          autoApproval: policyData.autoApproval,
          updatedAt: new Date().toISOString(),
          allowances: { ...companyAllowances }
        };
        setCompanyLeavePolicy(orgId, updatedOrgLeavePolicy.roles.TEAM_LEADER, 'TEAM_LEADER');

        // Also update any other configured roles in updatedOrgLeavePolicy.roles
        for (const rKey of Object.keys(updatedOrgLeavePolicy.roles)) {
          if (rKey === 'TEAM_LEADER') continue;
          updatedOrgLeavePolicy.roles[rKey] = {
            ...updatedOrgLeavePolicy.roles[rKey],
            allocationType: policyData.allocationType,
            carryForwardEnabled: policyData.carryForwardEnabled,
            maxCarryForwardDays: policyData.maxCarryForwardDays,
            halfDayAllowed: policyData.halfDayAllowed,
            workingDaysOnly: policyData.workingDaysOnly,
            autoApproval: policyData.autoApproval,
            updatedAt: new Date().toISOString(),
            allowances: {
              ...(updatedOrgLeavePolicy.roles[rKey]?.allowances || {}),
              ...companyAllowances
            }
          };
          setCompanyLeavePolicy(orgId, updatedOrgLeavePolicy.roles[rKey], rKey);
        }

        setCompanyLeavePolicy(orgId, { ...policyData, allowances: companyAllowances });
      }

      await prisma.organizationSettings.upsert({
        where: { organizationId: orgId },
        update: { leavePolicy: updatedOrgLeavePolicy },
        create: { organizationId: orgId, leavePolicy: updatedOrgLeavePolicy }
      });

      await recalculateCompanyUserBalances(orgId);

      const updatedPolicy = policyData;

      await logActivity({
        userId: req.user.id,
        action: 'LEAVE_POLICY_UPDATED',
        details: `Updated leave policy settings for organization "${orgId}"${role ? ` (Role: ${role})` : ''}: Allocation=${updatedPolicy.allocationType}`
      });

      broadcastLeavePolicyUpdate(orgId, { organizationId: orgId, role, policy: updatedPolicy });

      return res.json({
        message: `${role ? `${role.replace('_', ' ')} ` : ''}Leave policy updated successfully.`,
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

    if (annualDays !== undefined && parseFloat(annualDays) < 0) {
      return res.status(400).json({ message: 'Annual leave allowance cannot be negative.' });
    }
    if (monthlyCreditDays !== undefined && parseFloat(monthlyCreditDays) < 0) {
      return res.status(400).json({ message: 'Monthly credit days cannot be negative.' });
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
      const currentOrgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId }
      });
      let orgLeavePolicy = currentOrgSettings?.leavePolicy || {};
      if (typeof orgLeavePolicy !== 'object' || orgLeavePolicy === null) {
        orgLeavePolicy = {};
      }
      if (!orgLeavePolicy.allowances) orgLeavePolicy.allowances = {};
      orgLeavePolicy.allowances[finalCode] = {
        annualDays: parseFloat(leaveType.annualDays) || 0,
        monthlyCreditDays: parseFloat(leaveType.monthlyCreditDays) || 0
      };

      if (!orgLeavePolicy.roles) orgLeavePolicy.roles = {};
      if (!orgLeavePolicy.roles.TEAM_LEADER) {
        orgLeavePolicy.roles.TEAM_LEADER = { role: 'TEAM_LEADER', allowances: {} };
      }
      if (!orgLeavePolicy.roles.TEAM_LEADER.allowances) {
        orgLeavePolicy.roles.TEAM_LEADER.allowances = {};
      }
      orgLeavePolicy.roles.TEAM_LEADER.allowances[finalCode] = {
        annualDays: parseFloat(leaveType.annualDays) || 0,
        monthlyCreditDays: parseFloat(leaveType.monthlyCreditDays) || 0
      };
      const tlPol = getCompanyLeavePolicy(organizationId, 'TEAM_LEADER');
      if (!tlPol.allowances) tlPol.allowances = {};
      tlPol.allowances[finalCode] = {
        annualDays: parseFloat(leaveType.annualDays) || 0,
        monthlyCreditDays: parseFloat(leaveType.monthlyCreditDays) || 0
      };
      setCompanyLeavePolicy(organizationId, tlPol, 'TEAM_LEADER');

      const basePol = getCompanyLeavePolicy(organizationId);
      if (!basePol.allowances) basePol.allowances = {};
      basePol.allowances[finalCode] = {
        annualDays: parseFloat(leaveType.annualDays) || 0,
        monthlyCreditDays: parseFloat(leaveType.monthlyCreditDays) || 0
      };
      setCompanyLeavePolicy(organizationId, basePol);

      await prisma.organizationSettings.upsert({
        where: { organizationId },
        update: { leavePolicy: orgLeavePolicy },
        create: { organizationId, leavePolicy: orgLeavePolicy }
      });
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
      monthlyCredit,
      allowCarryForward,
      requireDoc,
      allowHalfDay
    } = req.body;

    const orgId = getEffectiveOrgId(req);

    const existingLT = await prisma.leaveType.findUnique({ where: { id } });
    if (!existingLT) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    const rawAnnual = annualDays !== undefined ? annualDays : undefined;
    const rawMonthly = monthlyCredit !== undefined ? monthlyCredit : monthlyCreditDays;

    if (rawAnnual !== undefined) {
      const numAnnual = Number(rawAnnual);
      if (isNaN(numAnnual) || numAnnual < 0) {
        return res.status(400).json({ message: 'Annual leave allowance must be a non-negative number.' });
      }
    }
    if (rawMonthly !== undefined) {
      const numMonthly = Number(rawMonthly);
      if (isNaN(numMonthly) || numMonthly < 0) {
        return res.status(400).json({ message: 'Monthly credit must be a non-negative number.' });
      }
    }

    const finalAnnualDays = rawAnnual !== undefined ? parseFloat(rawAnnual) : existingLT.annualDays;
    const finalMonthlyCreditDays = rawMonthly !== undefined ? parseFloat(rawMonthly) : existingLT.monthlyCreditDays;

    const updated = await prisma.leaveType.update({
      where: { id },
      data: {
        name: name ? name.trim() : existingLT.name,
        code: existingLT.isSystem ? existingLT.code : (code ? code.trim().toUpperCase() : existingLT.code),
        description: description !== undefined ? description : existingLT.description,
        color: color || existingLT.color,
        icon: icon || existingLT.icon,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder, 10) : existingLT.displayOrder,
        isPaid: isPaid !== undefined ? isPaid : existingLT.isPaid,
        annualDays: finalAnnualDays,
        monthlyCreditDays: finalMonthlyCreditDays,
        allowCarryForward: allowCarryForward !== undefined ? allowCarryForward : existingLT.allowCarryForward,
        requireDoc: requireDoc !== undefined ? requireDoc : existingLT.requireDoc,
        allowHalfDay: allowHalfDay !== undefined ? allowHalfDay : existingLT.allowHalfDay
      }
    });

    const role = req.body.role;
    if (orgId) {
      const targetCode = (code ? code.trim().toUpperCase() : existingLT.code);
      const newAnnual = finalAnnualDays;
      const newMonthly = finalMonthlyCreditDays;

      if (role) {
        const currentPolicy = getCompanyLeavePolicy(orgId, role);
        const allowances = currentPolicy.allowances || {};
        allowances[targetCode] = {
          annualDays: newAnnual,
          monthlyCreditDays: newMonthly
        };
        setCompanyLeavePolicy(orgId, { ...currentPolicy, allowances }, role);

        const currentOrgSettings = await prisma.organizationSettings.findUnique({
          where: { organizationId: orgId }
        });
        let updatedOrgLeavePolicy = currentOrgSettings?.leavePolicy || {};
        if (typeof updatedOrgLeavePolicy !== 'object' || updatedOrgLeavePolicy === null) {
          updatedOrgLeavePolicy = {};
        }
        if (!updatedOrgLeavePolicy.roles) updatedOrgLeavePolicy.roles = {};
        updatedOrgLeavePolicy.roles[role] = {
          ...(updatedOrgLeavePolicy.roles[role] || {}),
          allowances
        };
        await prisma.organizationSettings.upsert({
          where: { organizationId: orgId },
          update: { leavePolicy: updatedOrgLeavePolicy },
          create: { organizationId: orgId, leavePolicy: updatedOrgLeavePolicy }
        });
      } else {
        // Company-wide update: sync across company-level allowances AND any roles configured in company settings & store
        const currentOrgSettings = await prisma.organizationSettings.findUnique({
          where: { organizationId: orgId }
        });
        let orgLeavePolicy = currentOrgSettings?.leavePolicy || {};
        if (typeof orgLeavePolicy !== 'object' || orgLeavePolicy === null) {
          orgLeavePolicy = {};
        }

        // CRUCIAL: Synchronize top-level orgLeavePolicy.allowances so GET /leave-policy returns newly edited values
        if (!orgLeavePolicy.allowances) orgLeavePolicy.allowances = {};
        orgLeavePolicy.allowances[targetCode] = {
          annualDays: newAnnual,
          monthlyCreditDays: newMonthly
        };

        // Also synchronize roles.TEAM_LEADER
        if (!orgLeavePolicy.roles) orgLeavePolicy.roles = {};
        if (!orgLeavePolicy.roles.TEAM_LEADER) {
          orgLeavePolicy.roles.TEAM_LEADER = { role: 'TEAM_LEADER', allowances: {} };
        }
        if (!orgLeavePolicy.roles.TEAM_LEADER.allowances) {
          orgLeavePolicy.roles.TEAM_LEADER.allowances = {};
        }
        orgLeavePolicy.roles.TEAM_LEADER.allowances[targetCode] = {
          annualDays: newAnnual,
          monthlyCreditDays: newMonthly
        };
        const tlPol = getCompanyLeavePolicy(orgId, 'TEAM_LEADER');
        if (!tlPol.allowances) tlPol.allowances = {};
        tlPol.allowances[targetCode] = {
          annualDays: newAnnual,
          monthlyCreditDays: newMonthly
        };
        setCompanyLeavePolicy(orgId, tlPol, 'TEAM_LEADER');

        // Also update any other roles in orgLeavePolicy.roles
        for (const rKey of Object.keys(orgLeavePolicy.roles)) {
          if (rKey === 'TEAM_LEADER') continue;
          if (!orgLeavePolicy.roles[rKey].allowances) orgLeavePolicy.roles[rKey].allowances = {};
          orgLeavePolicy.roles[rKey].allowances[targetCode] = {
            annualDays: newAnnual,
            monthlyCreditDays: newMonthly
          };
          const rolePol = getCompanyLeavePolicy(orgId, rKey);
          if (!rolePol.allowances) rolePol.allowances = {};
          rolePol.allowances[targetCode] = {
            annualDays: newAnnual,
            monthlyCreditDays: newMonthly
          };
          setCompanyLeavePolicy(orgId, rolePol, rKey);
        }

        // Also sync base company policy in store
        const basePol = getCompanyLeavePolicy(orgId);
        if (!basePol.allowances) basePol.allowances = {};
        basePol.allowances[targetCode] = {
          annualDays: newAnnual,
          monthlyCreditDays: newMonthly
        };
        setCompanyLeavePolicy(orgId, basePol);

        await prisma.organizationSettings.upsert({
          where: { organizationId: orgId },
          update: { leavePolicy: orgLeavePolicy },
          create: { organizationId: orgId, leavePolicy: orgLeavePolicy }
        });
      }
    }

    await recalculateCompanyUserBalances(orgId);
    broadcastLeavePolicyUpdate(orgId, { organizationId: orgId, role });

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_EDITED',
      details: `Updated leave type ${updated.name} (${updated.code}) settings: Annual=${updated.annualDays}, MonthlyCredit=${updated.monthlyCreditDays}.`
    });

    res.json({
      message: `Leave type ${updated.name} updated successfully.`,
      leaveType: {
        ...updated,
        monthlyCredit: updated.monthlyCreditDays
      }
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

/**
 * Clean up stale configuration references for a leave policy
 * from OrganizationSettings.leavePolicy and companyLeavePolicyStore.
 */
const cleanupStalePolicyReferences = async (lt, orgId = null) => {
  const code = (lt.code || '').toUpperCase();
  const id = lt.id;
  const name = (lt.name || '').trim();

  // 1. Remove stale allowances from OrganizationSettings
  const orgSettingsList = await prisma.organizationSettings.findMany({
    where: orgId ? { organizationId: orgId } : {}
  });

  for (const os of orgSettingsList) {
    if (os.leavePolicy && typeof os.leavePolicy === 'object' && os.leavePolicy.roles) {
      let changed = false;
      const roles = os.leavePolicy.roles;
      for (const roleKey of Object.keys(roles)) {
        if (roles[roleKey]?.allowances) {
          if (roles[roleKey].allowances[code] !== undefined) {
            delete roles[roleKey].allowances[code];
            changed = true;
          }
          if (roles[roleKey].allowances[id] !== undefined) {
            delete roles[roleKey].allowances[id];
            changed = true;
          }
          if (roles[roleKey].allowances[name] !== undefined) {
            delete roles[roleKey].allowances[name];
            changed = true;
          }
        }
      }
      if (changed) {
        await prisma.organizationSettings.update({
          where: { id: os.id },
          data: { leavePolicy: os.leavePolicy }
        });
      }
    }
  }

  // 2. Remove stale entries from companyLeavePolicyStore
  cleanupCompanyLeavePolicyReferences(orgId, [code, id, name]);
  if (orgId) {
    removeLeaveTypeFromCompany(orgId, id);
  }
};

/**
 * Checks whether a leave policy is currently assigned and in active use.
 * Only blocks deletion when actually in use:
 * - Assigned to a role (INTERN, EMPLOYEE, TEAM_LEADER, ADMIN)
 * - An active user is using that policy
 * - Active leave balances (used > 0 || pending > 0) or active requests exist
 */
const checkLeavePolicyAssignment = async (lt, orgId = null) => {
  const code = (lt.code || '').toUpperCase();
  const id = lt.id;
  const name = (lt.name || '').trim();
  const targetRoles = ['INTERN', 'EMPLOYEE', 'TEAM_LEADER', 'ADMIN'];

  // 1. Check role assignments in OrganizationSettings and companyLeavePolicyStore
  const assignedRolesSet = new Set();

  const orgSettingsList = await prisma.organizationSettings.findMany({
    where: orgId ? { organizationId: orgId } : {}
  });

  for (const os of orgSettingsList) {
    if (os.leavePolicy && typeof os.leavePolicy === 'object' && os.leavePolicy.roles) {
      for (const roleKey of targetRoles) {
        const roleCfg = os.leavePolicy.roles[roleKey];
        const allowance = roleCfg?.allowances?.[code] || roleCfg?.allowances?.[id] || roleCfg?.allowances?.[name];
        if (allowance && Number(allowance.annualDays) > 0) {
          const userCount = await prisma.user.count({
            where: {
              role: roleKey,
              status: 'ACTIVE',
              ...(os.organizationId ? { organizationId: os.organizationId } : {})
            }
          });
          if (userCount > 0) {
            assignedRolesSet.add(roleKey);
          }
        }
      }
    }
  }

  if (orgId) {
    for (const roleKey of targetRoles) {
      const policy = getCompanyLeavePolicy(orgId, roleKey);
      const allowance = policy?.allowances?.[code] || policy?.allowances?.[id] || policy?.allowances?.[name];
      if (allowance && Number(allowance.annualDays) > 0) {
        const userCount = await prisma.user.count({
          where: {
            role: roleKey,
            status: 'ACTIVE',
            organizationId: orgId
          }
        });
        if (userCount > 0) {
          assignedRolesSet.add(roleKey);
        }
      }
    }
  }

  // 2. Check active UserLeaveBalance records (only where used > 0 or pending > 0)
  const activeBalances = await prisma.userLeaveBalance.findMany({
    where: {
      leaveTypeId: id,
      user: {
        status: 'ACTIVE',
        role: { in: targetRoles }
      },
      OR: [
        { used: { gt: 0 } },
        { pending: { gt: 0 } }
      ]
    },
    include: {
      user: { select: { id: true, name: true, role: true } }
    }
  });

  // 3. Check active LeaveRequest records
  const activeRequests = await prisma.leaveRequest.findMany({
    where: {
      OR: [
        { leaveType: code },
        { leaveType: name }
      ],
      status: { in: ['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'APPROVED'] },
      user: {
        status: 'ACTIVE',
        role: { in: targetRoles }
      }
    },
    include: {
      user: { select: { id: true, name: true, role: true } }
    }
  });

  for (const b of activeBalances) {
    if (targetRoles.includes(b.user.role)) {
      assignedRolesSet.add(b.user.role);
    }
  }
  for (const r of activeRequests) {
    if (targetRoles.includes(r.user.role)) {
      assignedRolesSet.add(r.user.role);
    }
  }

  const assignedRoles = Array.from(assignedRolesSet);

  // Active users: users with active usage + users in assigned roles
  const activeUserIdSet = new Set([
    ...activeBalances.map(b => b.user.id),
    ...activeRequests.map(r => r.user.id)
  ]);

  if (assignedRoles.length > 0) {
    const usersInAssignedRoles = await prisma.user.findMany({
      where: {
        role: { in: assignedRoles },
        status: 'ACTIVE',
        ...(orgId ? { organizationId: orgId } : {})
      },
      select: { id: true }
    });
    usersInAssignedRoles.forEach(u => activeUserIdSet.add(u.id));
  }

  const activeUsersCount = activeUserIdSet.size;
  const leaveBalancesCount = activeBalances.length;
  const leaveRequestsCount = activeRequests.length;

  const isAssigned = (assignedRoles.length > 0) || (activeUsersCount > 0) || (leaveBalancesCount > 0) || (leaveRequestsCount > 0);

  if (!isAssigned) {
    // Policy is unassigned / has no active usage -> clean up stale configuration references
    await cleanupStalePolicyReferences(lt, orgId);
  }

  return {
    id,
    code,
    assignedRoles,
    activeUsersCount,
    leaveBalancesCount,
    leaveRequestsCount,
    isAssigned
  };
};

const isLeavePolicyAssigned = async (lt, orgId = null) => {
  const result = await checkLeavePolicyAssignment(lt, orgId);
  return { assigned: result.isAssigned };
};

// 6. Delete Leave Type / Policy
const deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = getEffectiveOrgId(req);
    const lt = await prisma.leaveType.findUnique({ where: { id } });

    if (!lt) {
      return res.status(404).json({ success: false, message: 'Leave policy not found.' });
    }

    const code = (lt.code || '').toUpperCase();
    const name = (lt.name || '').trim();

    // 1. Mandatory system policies (Casual Leave / Sick Leave) cannot be deleted
    const isProtected = lt.isSystem || ['CL', 'SL'].includes(code) || name.toLowerCase().includes('casual leave') || name.toLowerCase().includes('sick leave');
    if (isProtected) {
      const displayName = code === 'CL' ? 'Casual Leave' : code === 'SL' ? 'Sick Leave' : name;
      return res.status(400).json({
        success: false,
        message: `${displayName} is a mandatory system policy and cannot be deleted.`
      });
    }

    // 2. Run assignment validation & refresh stale configuration
    const validation = await checkLeavePolicyAssignment(lt, orgId);

    if (validation.isAssigned) {
      return res.status(400).json({
        success: false,
        message: 'This leave policy is currently assigned to users. Reassign or unassign it before deleting.'
      });
    }

    // 4. Clean up any zero-usage / orphaned UserLeaveBalance and LeaveCreditHistory records
    await prisma.userLeaveBalance.deleteMany({
      where: { leaveTypeId: id }
    });
    await prisma.leaveCreditHistory.deleteMany({
      where: { leaveTypeId: id }
    });

    // 5. Remove from company leave policy store
    if (orgId) {
      removeLeaveTypeFromCompany(orgId, id);
    }
    const allAssignedIds = getAllAssignedLeaveTypeIds();
    if (allAssignedIds.has(id)) {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        removeLeaveTypeFromCompany(org.id, id);
      }
    }

    // 6. Ensure stale references removed from all organization settings
    const allOrgSettings = await prisma.organizationSettings.findMany();
    for (const os of allOrgSettings) {
      if (os.leavePolicy && typeof os.leavePolicy === 'object' && os.leavePolicy.roles) {
        let changed = false;
        const roles = os.leavePolicy.roles;
        for (const roleKey of Object.keys(roles)) {
          if (roles[roleKey]?.allowances) {
            delete roles[roleKey].allowances[code];
            delete roles[roleKey].allowances[id];
            delete roles[roleKey].allowances[name];
            changed = true;
          }
        }
        if (changed) {
          await prisma.organizationSettings.update({
            where: { id: os.id },
            data: { leavePolicy: os.leavePolicy }
          });
        }
      }
    }

    // 7. Actual permanent DELETE operation from PostgreSQL database
    await prisma.leaveType.delete({
      where: { id }
    });

    await recalculateCompanyUserBalances(orgId);
    broadcastLeavePolicyUpdate(orgId);

    await logActivity({
      userId: req.user.id,
      action: 'LEAVE_TYPE_DELETED',
      details: `Permanently deleted leave policy ${lt.name} (${lt.code}).`
    });

    return res.json({
      success: true,
      message: `Leave policy "${lt.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('Delete leave type error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete leave policy.' });
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
  recalculateCompanyUserBalances,
  checkLeavePolicyAssignment
};
