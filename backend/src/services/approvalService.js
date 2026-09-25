const prisma = require('../utils/db');
const { createShiftNotification } = require('./notificationService');
const scheduleService = require('./scheduleService');
const shiftService = require('./shiftService');

/**
 * Submit a shift approval request (Swap, Temporary Override, Weekend Override, Holiday Work)
 */
const requestApproval = async ({
  organizationId,
  requesterId,
  requestType,
  reason,
  details = {}
}) => {
  if (!organizationId || !requesterId || !requestType) {
    throw new Error('Missing required approval fields.');
  }

  // Multi-tenant check
  const requester = await prisma.user.findFirst({
    where: { id: requesterId, organizationId },
    select: { id: true, name: true, role: true, organizationId: true }
  });
  if (!requester) {
    throw new Error('Requester not found in this organization.');
  }

  // Check organization automation setting
  const setting = await prisma.shiftAutomationSetting.findUnique({
    where: { organizationId }
  });

  // Check if auto-approval is enabled for this type
  const isSwap = requestType === 'SHIFT_SWAP';
  const isOverride = requestType === 'TEMPORARY_OVERRIDE';
  const isWeekend = requestType === 'WEEKEND_OVERRIDE';
  const isHoliday = requestType === 'HOLIDAY_WORK';

  let requireApproval = true;
  if (isOverride && setting && setting.overrideApprovalRequired === false) {
    requireApproval = false;
  }
  if (isSwap && setting && setting.swapApprovalRequired === false) {
    requireApproval = false;
  }

  // Find requester's team leader
  const userTeam = await prisma.team.findFirst({
    where: {
      organizationId,
      members: { some: { userId: requesterId } }
    },
    include: { leader: { select: { id: true, name: true, role: true } } }
  });

  const teamLeaderId = userTeam?.leader?.id && userTeam.leader.id !== requesterId ? userTeam.leader.id : null;

  // Auto-approve if settings permit
  if (!requireApproval) {
    const approval = await prisma.shiftApproval.create({
      data: {
        organizationId,
        requesterId,
        requestType,
        status: 'APPROVED',
        reason,
        details,
        adminNote: 'Auto-approved per company automation settings'
      }
    });

    // Execute schedule immediately
    await executeApprovedSchedule(approval, requesterId);
    return approval;
  }

  // Determine initial status:
  // If requester is EMPLOYEE and has a Team Leader -> PENDING_TL_APPROVAL
  // If requester is TL, ADMIN, or has no TL -> PENDING_ADMIN_APPROVAL
  const initialStatus = (requester.role === 'EMPLOYEE' || requester.role === 'INTERN') && teamLeaderId
    ? 'PENDING_TL_APPROVAL'
    : 'PENDING_ADMIN_APPROVAL';

  const approval = await prisma.shiftApproval.create({
    data: {
      organizationId,
      requesterId,
      requestType,
      status: initialStatus,
      reason,
      details
    },
    include: {
      requester: { select: { id: true, name: true, email: true, employeeId: true } }
    }
  });

  // Notify TL or Admin
  if (initialStatus === 'PENDING_TL_APPROVAL' && teamLeaderId) {
    await createShiftNotification({
      organizationId,
      userId: teamLeaderId,
      type: 'SHIFT_CHANGED',
      title: 'New Shift Request Pending Review',
      message: `${requester.name} requested a ${requestType.replace('_', ' ').toLowerCase()}: "${reason || 'No reason provided'}". Action required.`,
      metadata: { approvalId: approval.id, requestType }
    });
  } else {
    // Notify Org Admins
    const admins = await prisma.user.findMany({
      where: { organizationId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true }
    });
    for (const adm of admins) {
      await createShiftNotification({
        organizationId,
        userId: adm.id,
        type: 'SHIFT_CHANGED',
        title: 'Shift Request Pending Admin Approval',
        message: `${requester.name} submitted a ${requestType.replace('_', ' ').toLowerCase()} request.`,
        metadata: { approvalId: approval.id, requestType }
      });
    }
  }

  return approval;
};

/**
 * Execute approved schedule creation
 */
const executeApprovedSchedule = async (approval, actorUserId) => {
  const { organizationId, requesterId, requestType, details = {} } = approval;

  if (requestType === 'SHIFT_SWAP') {
    const { swapWithUserId, targetDate, reason } = details;
    if (swapWithUserId && targetDate) {
      await scheduleService.swapShifts({
        organizationId,
        userAId: requesterId,
        userBId: swapWithUserId,
        date: targetDate,
        reason: reason || approval.reason || 'Approved shift swap',
        actorUserId
      });
    }
  } else if (['TEMPORARY_OVERRIDE', 'WEEKEND_OVERRIDE', 'HOLIDAY_WORK'].includes(requestType)) {
    const { shiftId, startDate, endDate, reason } = details;
    if (shiftId && startDate && endDate) {
      await scheduleService.createOverride({
        organizationId,
        userId: requesterId,
        shiftId,
        startDate,
        endDate,
        reason: reason || approval.reason || `Approved ${requestType.toLowerCase()}`,
        actorUserId
      });
    }
  }
};

/**
 * Review approval (Approve or Reject) by Team Leader or Admin
 */
const reviewApproval = async ({
  approvalId,
  actorUser,
  action, // 'APPROVE' | 'REJECT'
  note = ''
}) => {
  if (!approvalId || !actorUser || !action) {
    throw new Error('Missing review parameters.');
  }

  const approval = await prisma.shiftApproval.findUnique({
    where: { id: approvalId },
    include: {
      requester: { select: { id: true, name: true, organizationId: true } }
    }
  });

  if (!approval) {
    throw new Error('Shift approval request not found.');
  }

  // Multi-tenant check
  if (actorUser.role !== 'SUPER_ADMIN' && approval.organizationId !== actorUser.organizationId) {
    throw new Error('Unauthorized: Tenant mismatch.');
  }

  const isTL = actorUser.role === 'TEAM_LEADER';
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(actorUser.role);

  let newStatus = approval.status;
  const updateData = { approverId: actorUser.id };

  if (isTL) {
    if (approval.status !== 'PENDING_TL_APPROVAL') {
      throw new Error(`Cannot review request in status ${approval.status}.`);
    }

    if (action === 'APPROVE') {
      newStatus = 'PENDING_ADMIN_APPROVAL';
      updateData.tlNote = note || 'Endorsed by Team Leader';
      updateData.status = newStatus;

      // Notify Admins
      const admins = await prisma.user.findMany({
        where: { organizationId: approval.organizationId, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true }
      });
      for (const adm of admins) {
        await createShiftNotification({
          organizationId: approval.organizationId,
          userId: adm.id,
          type: 'SHIFT_CHANGED',
          title: 'Shift Request Endorsed by Team Leader',
          message: `${approval.requester.name}'s request was endorsed by TL ${actorUser.name}. Awaiting final approval.`,
          metadata: { approvalId: approval.id }
        });
      }
    } else {
      newStatus = 'REJECTED';
      updateData.tlNote = note || 'Rejected by Team Leader';
      updateData.status = newStatus;

      // Notify Requester
      await createShiftNotification({
        organizationId: approval.organizationId,
        userId: approval.requesterId,
        type: 'SHIFT_CHANGED',
        title: 'Shift Request Declined',
        message: `Your ${approval.requestType.replace('_', ' ').toLowerCase()} was declined by your Team Leader. Note: "${note || 'None'}"`,
        metadata: { approvalId: approval.id, status: 'REJECTED' }
      });
    }
  } else if (isAdmin) {
    if (!['PENDING_TL_APPROVAL', 'PENDING_ADMIN_APPROVAL'].includes(approval.status)) {
      throw new Error(`Cannot review request in status ${approval.status}.`);
    }

    if (action === 'APPROVE') {
      newStatus = 'APPROVED';
      updateData.adminNote = note || 'Approved by Admin';
      updateData.status = newStatus;

      // Execute Schedule
      await executeApprovedSchedule(approval, actorUser.id);

      // Notify Requester
      await createShiftNotification({
        organizationId: approval.organizationId,
        userId: approval.requesterId,
        type: 'SWAP_APPROVED',
        title: 'Shift Request Approved! 🎉',
        message: `Your ${approval.requestType.replace('_', ' ').toLowerCase()} has been approved and activated.`,
        metadata: { approvalId: approval.id, status: 'APPROVED' }
      });

      // If swap, also notify swapped partner
      if (approval.requestType === 'SHIFT_SWAP' && approval.details?.swapWithUserId) {
        await createShiftNotification({
          organizationId: approval.organizationId,
          userId: approval.details.swapWithUserId,
          type: 'SWAP_APPROVED',
          title: 'Shift Swap Approved & Active',
          message: `Your shift swap with ${approval.requester.name} has been approved by Admin.`,
          metadata: { approvalId: approval.id, status: 'APPROVED' }
        });
      }
    } else {
      newStatus = 'REJECTED';
      updateData.adminNote = note || 'Rejected by Admin';
      updateData.status = newStatus;

      // Notify Requester
      await createShiftNotification({
        organizationId: approval.organizationId,
        userId: approval.requesterId,
        type: 'SHIFT_CHANGED',
        title: 'Shift Request Rejected',
        message: `Your ${approval.requestType.replace('_', ' ').toLowerCase()} was rejected by Admin. Reason: "${note || 'None'}"`,
        metadata: { approvalId: approval.id, status: 'REJECTED' }
      });
    }
  } else {
    throw new Error('Unauthorized to review shift approvals.');
  }

  return await prisma.shiftApproval.update({
    where: { id: approvalId },
    data: updateData,
    include: {
      requester: { select: { id: true, name: true, employeeId: true } },
      approver: { select: { id: true, name: true, role: true } }
    }
  });
};

/**
 * Get approvals list scoped by role
 */
const getApprovals = async ({ organizationId, user, status, requestType }) => {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (status) where.status = status;
  if (requestType) where.requestType = requestType;

  // Role scoping
  if (user.role === 'EMPLOYEE' || user.role === 'INTERN') {
    where.requesterId = user.id;
  } else if (user.role === 'TEAM_LEADER') {
    // Find team members
    const team = await prisma.team.findFirst({
      where: { organizationId, leaderId: user.id },
      include: { members: { select: { userId: true } } }
    });
    const memberIds = team?.members?.map(m => m.userId) || [];
    where.OR = [
      { requesterId: user.id },
      { requesterId: { in: memberIds } }
    ];
  }

  return await prisma.shiftApproval.findMany({
    where,
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          department: true,
          profilePic: true
        }
      },
      approver: {
        select: {
          id: true,
          name: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

module.exports = {
  requestApproval,
  reviewApproval,
  getApprovals,
  executeApprovedSchedule
};
