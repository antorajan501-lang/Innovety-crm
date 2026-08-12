const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');

// Helper to calculate working days count between 2 dates (inclusive)
const calculateTotalDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

// 1. Get Leaves (Role Scoped + Advanced Date & Filter Queries)
const getLeaves = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const {
      status,
      leaveType,
      department,
      search,
      singleDate,
      fromDate,
      toDate,
      page,
      limit
    } = req.query;

    let baseWhere = {};

    // 1. Role Scoping
    if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
      baseWhere = {};
    } else if (userRole === 'TEAM_LEADER') {
      const ledTeams = await prisma.team.findMany({
        where: { leaderId: userId },
        select: { id: true }
      });
      const teamIds = ledTeams.map(t => t.id);

      const teamMemberships = await prisma.teamMember.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true }
      });
      const memberUserIds = teamMemberships.map(m => m.userId);

      baseWhere = {
        OR: [
          { userId: userId },
          { submittedTeamLeaderId: userId },
          { userId: { in: memberUserIds } }
        ]
      };
    } else {
      baseWhere = { userId };
    }

    const andConditions = [];

    // 2. Status Filter with Strict Scoping
    if (status && status !== 'ALL') {
      const normStatus = status.toUpperCase();
      if (normStatus === 'PENDING') {
        if (userRole === 'TEAM_LEADER') {
          andConditions.push({ status: 'PENDING_TL_APPROVAL' });
        } else if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
          andConditions.push({ status: 'PENDING_ADMIN_APPROVAL' });
        } else {
          andConditions.push({
            status: { in: ['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'] }
          });
        }
      } else {
        andConditions.push({ status: normStatus });
      }
    }

    // 3. Leave Type Filter
    if (leaveType && leaveType !== 'ALL') {
      const normType = leaveType.toUpperCase();
      andConditions.push({
        OR: [
          { leaveType: normType },
          { type: normType }
        ]
      });
    }

    // 4. Date Overlap Filter
    let filterStart = null;
    let filterEnd = null;

    if (singleDate) {
      filterStart = new Date(`${singleDate}T00:00:00.000Z`);
      filterEnd = new Date(`${singleDate}T23:59:59.999Z`);
    } else {
      if (fromDate) {
        filterStart = new Date(`${fromDate}T00:00:00.000Z`);
      }
      if (toDate) {
        filterEnd = new Date(`${toDate}T23:59:59.999Z`);
      }
    }

    if (filterEnd && !isNaN(filterEnd.getTime())) {
      andConditions.push({ startDate: { lte: filterEnd } });
    }
    if (filterStart && !isNaN(filterStart.getTime())) {
      andConditions.push({ endDate: { gte: filterStart } });
    }

    // 5. Department & Employee Search Filter
    const userWhere = {};
    if (department && department !== 'ALL') {
      userWhere.department = { equals: department, mode: 'insensitive' };
    }

    if (search && search.trim()) {
      const q = search.trim();
      userWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { employeeId: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (Object.keys(userWhere).length > 0) {
      andConditions.push({ user: userWhere });
    }

    const finalWhere = andConditions.length > 0
      ? { AND: [baseWhere, ...andConditions] }
      : baseWhere;

    // Optional Pagination
    const pageNum = parseInt(page) || 0;
    const limitNum = parseInt(limit) || 0;

    let leaves = [];
    let totalCount = 0;

    if (pageNum > 0 && limitNum > 0) {
      totalCount = await prisma.leaveRequest.count({ where: finalWhere });
      leaves = await prisma.leaveRequest.findMany({
        where: finalWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true, employeeId: true, role: true, department: true, profilePic: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      });

      return res.json({
        leaves,
        total: totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum)
      });
    }

    leaves = await prisma.leaveRequest.findMany({
      where: finalWhere,
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true, role: true, department: true, profilePic: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ message: 'Failed to retrieve leave requests.' });
  }
};

// 2. Get Dynamic Leave Balances (Global Leave Policy UserLeaveBalance)
const getLeaveBalances = async (req, res) => {
  try {
    const targetUserId = req.query.userId || req.user.id;
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        role: true
      }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const activeLeaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' }
    });

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
      include: { leaveType: true },
      orderBy: { leaveType: { displayOrder: 'asc' } }
    });

    const pendingRequestsCount = await prisma.leaveRequest.count({
      where: {
        userId: targetUserId,
        status: { in: ['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'] }
      }
    });

    const approvedRequestsCount = await prisma.leaveRequest.count({
      where: {
        userId: targetUserId,
        status: 'APPROVED'
      }
    });

    res.json({
      userId: targetUser.id,
      userName: targetUser.name,
      balances,
      pendingRequestsCount,
      approvedRequestsCount
    });
  } catch (error) {
    console.error('Get leave balances error:', error);
    res.status(500).json({ message: 'Failed to retrieve leave balances.' });
  }
};

// 3. Apply Leave (Snapshot Team ID & Leader ID, Multi-level Routing)
const applyLeave = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    // Rule 1: Admin and Super Admin CANNOT apply for leave
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Administrators and Super Admins cannot apply for leave.' });
    }

    const { startDate, endDate, leaveType, type: altType, reason, letterContent, contactPhone } = req.body;

    if (!startDate || !endDate || (!reason && !letterContent)) {
      return res.status(400).json({ message: 'Start date, end date, and reason/letter content are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end date format.' });
    }

    if (start > end) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date.' });
    }

    const totalDays = calculateTotalDays(start, end);
    if (totalDays <= 0) {
      return res.status(400).json({ message: 'Invalid leave duration.' });
    }

    const rawType = leaveType || altType || 'CASUAL';
    const normalizedType = String(rawType).toUpperCase();
    const ALLOWED_TYPES = ['CASUAL', 'SICK', 'EMERGENCY', 'WFH'];

    if (!ALLOWED_TYPES.includes(normalizedType)) {
      return res.status(400).json({ message: 'Invalid leave type. Allowed: CASUAL, SICK, EMERGENCY, WFH.' });
    }

    // Check available Leave Quota Balance against APPROVED leaves only (WFH exempt)
    if (normalizedType !== 'WFH') {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          casualLeaveQuota: true,
          sickLeaveQuota: true,
          emergencyLeaveQuota: true
        }
      });

      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId,
          status: 'APPROVED'
        }
      });

      let approvedDaysForType = 0;
      approvedLeaves.forEach(l => {
        const lType = (l.leaveType || l.type || 'CASUAL').toUpperCase();
        if (lType === normalizedType) {
          approvedDaysForType += (l.totalDays || 1);
        }
      });

      let totalQuota = 12;
      if (normalizedType === 'CASUAL') totalQuota = userRecord?.casualLeaveQuota || 12;
      else if (normalizedType === 'SICK') totalQuota = userRecord?.sickLeaveQuota || 12;
      else if (normalizedType === 'EMERGENCY') totalQuota = userRecord?.emergencyLeaveQuota || 6;

      const remainingQuota = Math.max(0, totalQuota - approvedDaysForType);

      if (totalDays > remainingQuota) {
        return res.status(400).json({
          message: `Requested leave duration (${totalDays} day(s)) exceeds your available ${normalizedType} leave balance (${remainingQuota} day(s) remaining).`
        });
      }
    }

    // Prevent Overlapping Active Leave/WFH Requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'APPROVED'] },
        AND: [
          { startDate: { lte: end } },
          { endDate: { gte: start } }
        ]
      }
    });

    if (overlapping) {
      return res.status(400).json({
        message: 'You already have an active leave or WFH request overlapping with the selected date range.'
      });
    }

    // Snapshot Team ID & Team Leader ID at creation time
    const teamMember = await prisma.teamMember.findFirst({
      where: { userId },
      include: {
        team: {
          select: { id: true, leaderId: true }
        }
      }
    });

    const submittedTeamId = teamMember?.team?.id || null;
    const submittedTeamLeaderId = teamMember?.team?.leaderId || null;

    const hasTeamLeader = submittedTeamLeaderId && submittedTeamLeaderId !== userId;
    let initialStatus = 'PENDING_ADMIN_APPROVAL';
    let tlApprovalStatus = 'NOT_REQUIRED';

    if ((userRole === 'INTERN' || userRole === 'EMPLOYEE') && hasTeamLeader) {
      initialStatus = 'PENDING_TL_APPROVAL';
      tlApprovalStatus = 'PENDING';
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId,
        startDate: start,
        endDate: end,
        totalDays,
        leaveType: normalizedType,
        type: normalizedType === 'WFH' ? 'WFH' : 'LEAVE',
        reason: reason || 'Leave Application',
        letterContent: letterContent || reason,
        contactPhone: contactPhone || null,
        submittedTeamId,
        submittedTeamLeaderId,
        status: initialStatus,
        tlApprovalStatus,
        adminApprovalStatus: 'PENDING'
      }
    });

    await logActivity({
      userId,
      action: 'LEAVE_SUBMIT',
      details: `Applied for ${normalizedType} (${totalDays} days) from ${startDate} to ${endDate}`
    });

    // 7-Stage Notification System Trigger (Step 1 & 2)
    // 1. Notify Applicant
    await createNotification({
      userId,
      title: 'Leave Request Submitted',
      message: 'Leave request submitted successfully.',
      type: 'LEAVE_SUBMITTED_SELF'
    });

    // 2. Notify Approvers based on hierarchy
    if (initialStatus === 'PENDING_TL_APPROVAL' && submittedTeamLeaderId) {
      await createNotification({
        userId: submittedTeamLeaderId,
        title: 'New Leave Request Pending Approval',
        message: `New leave request requires your approval (${req.user.name} - ${normalizedType}, ${totalDays} days).`,
        type: 'LEAVE_SUBMITTED_TL'
      });
    } else {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          title: 'Leave Request Awaiting Final Approval',
          message: `Leave request awaiting final approval (${req.user.name} - ${normalizedType}, ${totalDays} days).`,
          type: 'LEAVE_SUBMITTED_ADMIN'
        });
      }
    }

    res.status(201).json(leave);
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Failed to apply for leave.' });
  }
};

// 4. Team Leader Approval (Step 1)
const approveLeaveTL = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole !== 'TEAM_LEADER' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only Team Leaders or Admins can perform initial review.' });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (leave.status !== 'PENDING_TL_APPROVAL') {
      return res.status(400).json({ message: 'This request is not pending Team Leader review.' });
    }

    // Permission check: Must be assigned Team Leader at submission time or current team leader
    if (userRole === 'TEAM_LEADER') {
      if (leave.userId === userId) {
        return res.status(403).json({ message: 'Team Leaders cannot approve their own leave request.' });
      }
      if (leave.user.role === 'TEAM_LEADER') {
        return res.status(403).json({ message: 'Team Leaders cannot approve another Team Leader’s leave.' });
      }
      if (leave.submittedTeamLeaderId && leave.submittedTeamLeaderId !== userId) {
        return res.status(403).json({ message: 'You can only approve leave requests for your assigned team members.' });
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        tlApprovalStatus: 'APPROVED',
        tlApprovedById: userId,
        tlApprovedAt: new Date(),
        tlRemarks: remarks || 'Approved by Team Leader',
        status: 'PENDING_ADMIN_APPROVAL'
      }
    });

    // 7-Stage Notification System Trigger (Step 3 & 4)
    // 3. Notify Employee
    await createNotification({
      userId: leave.userId,
      title: 'Leave Request Approved by Team Leader',
      message: 'Approved by Team Leader. Waiting for Admin approval.',
      type: 'LEAVE_TL_APPROVED'
    });

    // 4. Notify Admins
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        title: 'Leave Request Awaiting Final Approval',
        message: `Leave request for ${leave.user.name} approved by TL and awaiting final approval.`,
        type: 'LEAVE_FORWARDED_ADMIN'
      });
    }

    await logActivity({
      userId,
      action: 'LEAVE_TL_APPROVE',
      details: `Team Leader approved leave for ${leave.user.name}. Remarks: "${remarks || 'None'}"`
    });

    res.json(updated);
  } catch (error) {
    console.error('TL approve leave error:', error);
    res.status(500).json({ message: 'Failed to approve leave request.' });
  }
};

// 5. Admin Final Approval (Step 2 - Final Sanction & Attendance Auto-Sync)
const approveLeaveAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Super Admin is strictly read-only and cannot approve leave requests.' });
    }

    if (userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only Administrators can perform final leave sanction.' });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    // Strict Admin Queue: Admin acts ONLY on PENDING_ADMIN_APPROVAL
    if (leave.status !== 'PENDING_ADMIN_APPROVAL') {
      return res.status(400).json({ message: 'Leave request is not pending final Admin approval.' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        adminApprovalStatus: 'APPROVED',
        adminApprovedById: userId,
        adminApprovedAt: new Date(),
        adminRemarks: remarks || 'Sanctioned by Admin',
        status: 'APPROVED'
      }
    });

    // Attendance Integration: Created or updated ONLY after final Admin approval
    const leaveType = (leave.leaveType || leave.type || 'CASUAL').toUpperCase();
    const attendanceStatus = leaveType === 'WFH' ? 'WORK_FROM_HOME' : 'LEAVE';

    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    let curr = new Date(start);

    while (curr <= end) {
      const localDateStr = curr.toLocaleDateString('en-CA');
      const targetDate = new Date(localDateStr + 'T00:00:00.000Z');

      const existing = await prisma.attendance.findUnique({
        where: {
          userId_date: {
            userId: leave.userId,
            date: targetDate
          }
        }
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: attendanceStatus,
            workingHours: attendanceStatus === 'WORK_FROM_HOME' ? 8.0 : 0,
            editedBy: userId
          }
        });
      } else {
        await prisma.attendance.create({
          data: {
            userId: leave.userId,
            date: targetDate,
            clockIn: attendanceStatus === 'LEAVE' ? null : targetDate,
            clockOut: attendanceStatus === 'LEAVE' ? null : targetDate,
            status: attendanceStatus,
            workingHours: attendanceStatus === 'WORK_FROM_HOME' ? 8.0 : 0,
            clockInLocation: attendanceStatus === 'WORK_FROM_HOME' ? 'Work From Home (Approved)' : 'Approved Leave Period'
          }
        });
      }

      curr.setDate(curr.getDate() + 1);
    }

    // 7-Stage Notification System Trigger (Step 5)
    await createNotification({
      userId: leave.userId,
      title: 'Leave Request Approved',
      message: 'Your leave has been approved.',
      type: 'LEAVE_APPROVED'
    });

    await logActivity({
      userId,
      action: 'LEAVE_ADMIN_APPROVE',
      details: `Admin final sanctioned ${leaveType} leave for ${leave.user.name}. Remarks: "${remarks || 'None'}"`
    });

    res.json(updated);
  } catch (error) {
    console.error('Admin approve leave error:', error);
    res.status(500).json({ message: 'Failed to perform final leave sanction.' });
  }
};

// 6. Reject Leave Request
const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Super Admin is strictly read-only and cannot reject leave requests.' });
    }

    if (userRole !== 'ADMIN' && userRole !== 'TEAM_LEADER') {
      return res.status(403).json({ message: 'Insufficient permissions to reject leave.' });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    let updated = null;

    if (leave.status === 'PENDING_TL_APPROVAL') {
      if (userRole !== 'TEAM_LEADER' && userRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Only Team Leaders or Admins can decline at this stage.' });
      }

      updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          tlApprovalStatus: 'REJECTED',
          tlApprovedById: userId,
          tlApprovedAt: new Date(),
          tlRemarks: remarks || 'Declined by Team Leader'
        }
      });

      // 7-Stage Notification System Trigger (Step 7: TL Rejects)
      await createNotification({
        userId: leave.userId,
        title: 'Leave Request Rejected',
        message: 'Your leave has been rejected by your Team Leader.',
        type: 'LEAVE_REJECTED_TL'
      });

      await logActivity({
        userId,
        action: 'LEAVE_REJECT',
        details: `Team Leader declined leave for ${leave.user.name}. Remarks: "${remarks || 'None'}"`
      });
    } else if (leave.status === 'PENDING_ADMIN_APPROVAL') {
      if (userRole !== 'ADMIN') {
        return res.status(403).json({ message: 'Only Administrators can decline at this stage.' });
      }

      updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminApprovalStatus: 'REJECTED',
          adminApprovedById: userId,
          adminApprovedAt: new Date(),
          adminRemarks: remarks || 'Declined by Admin'
        }
      });

      // 7-Stage Notification System Trigger (Step 6: Admin Rejects)
      await createNotification({
        userId: leave.userId,
        title: 'Leave Request Rejected',
        message: 'Your leave has been rejected.',
        type: 'LEAVE_REJECTED_ADMIN'
      });

      await logActivity({
        userId,
        action: 'LEAVE_REJECT',
        details: `Admin declined leave for ${leave.user.name}. Remarks: "${remarks || 'None'}"`
      });
    } else {
      return res.status(400).json({ message: 'Only pending leave requests can be rejected.' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Reject leave error:', error);
    res.status(500).json({ message: 'Failed to reject leave request.' });
  }
};

// 7. Cancel Pending Leave Request (Applicant only - while pending)
const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found.' });
    }

    if (leave.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'You can only cancel your own leave requests.' });
    }

    // Cancellation Allowed ONLY while status is PENDING_TL_APPROVAL or PENDING_ADMIN_APPROVAL
    if (!['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(leave.status)) {
      return res.status(400).json({ message: 'Once approved or finalized, leave requests cannot be cancelled by employees.' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    await logActivity({
      userId,
      action: 'LEAVE_CANCEL',
      details: `Cancelled pending leave request (${leave.leaveType})`
    });

    res.json(updated);
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ message: 'Failed to cancel leave request.' });
  }
};

module.exports = {
  getLeaves,
  getLeaveBalances,
  applyLeave,
  approveLeaveTL,
  approveLeaveAdmin,
  rejectLeave,
  cancelLeave
};
