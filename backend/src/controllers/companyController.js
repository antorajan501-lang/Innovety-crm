const prisma = require('../utils/db');
const bcrypt = require('bcrypt');
const { provisionOrganizationWorkspace, generateSlug } = require('../services/organizationProvisioningService');
const { disconnectOrganizationSockets, getOnlineCount } = require('../socket');
const { logOrganizationAction } = require('../services/organizationAuditService');
const { updateOrganizationStorage } = require('../services/storageService');

/**
 * GET /api/organizations
 * List all companies with search and status filtering
 */
const getAllOrganizations = async (req, res, next) => {
  try {
    const { search, status } = req.query;

    const whereClause = {};

    if (req.user?.role !== 'SUPER_ADMIN') {
      whereClause.status = 'ACTIVE';
    } else if (status && status !== 'ALL') {
      whereClause.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const query = search.trim();
      whereClause.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { companyCode: { contains: query, mode: 'insensitive' } },
        { slug: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } }
      ];
    }

    const organizations = await prisma.organization.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        companyCode: true,
        logo: true,
        status: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      count: organizations.length,
      data: organizations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organizations/:id
 * Get details for a single company
 */
const getOrganizationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    res.json({
      success: true,
      data: organization
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/organizations
 * Create and provision a new company workspace inside a single transaction
 */
const createOrganization = async (req, res, next) => {
  try {
    const {
      name,
      companyCode,
      email,
      phone,
      website,
      address,
      timezone,
      adminName,
      adminEmail,
      adminEmployeeId
    } = req.body;

    // Basic Validation
    if (!name || name.trim().length < 3 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Company Name is required and must be between 3 and 100 characters.'
      });
    }

    if (!companyCode || !companyCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company Code is required.'
      });
    }

    const formattedCode = companyCode.trim().toUpperCase();

    if (!/^[A-Z0-9_-]+$/.test(formattedCode)) {
      return res.status(400).json({
        success: false,
        message: 'Company Code must contain only uppercase letters, numbers, hyphens, or underscores.'
      });
    }

    let logoPath = null;
    if (req.file) {
      logoPath = `/uploads/logos/${req.file.filename}`;
    }

    // Execute atomic provisioning service
    const provisionResult = await provisionOrganizationWorkspace({
      name: name.trim(),
      companyCode: formattedCode,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      website: website ? website.trim() : null,
      address: address ? address.trim() : null,
      timezone: timezone || 'Asia/Kolkata',
      logoPath,
      adminName: adminName ? adminName.trim() : null,
      adminEmail: adminEmail ? adminEmail.trim().toLowerCase() : null,
      adminEmployeeId: adminEmployeeId ? adminEmployeeId.trim().toUpperCase() : null
    });

    res.status(201).json({
      success: true,
      message: `Organization "${provisionResult.organization.name}" provisioned successfully.`,
      data: provisionResult.organization,
      admin: provisionResult.admin,
      workspaceCreated: true
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to provision company workspace.'
    });
  }
};

/**
 * PUT /api/organizations/:id
 * Edit company details
 */
const updateOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, companyCode, email, phone, website, address, timezone } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    const isInnoveity = organization.slug === 'innoveity' || organization.companyCode === 'INN001';

    let finalName = organization.name;
    let finalCode = organization.companyCode;
    let finalSlug = organization.slug;

    if (name && name.trim()) {
      if (name.trim().length < 3 || name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Company Name must be between 3 and 100 characters.'
        });
      }
      finalName = name.trim();

      if (!isInnoveity && finalName !== organization.name) {
        finalSlug = await generateSlug(finalName, organization.id);
      }
    }

    if (companyCode && companyCode.trim()) {
      const formattedCode = companyCode.trim().toUpperCase();

      if (isInnoveity && formattedCode !== 'INN001') {
        return res.status(400).json({
          success: false,
          message: 'The default INNOVEITY organization code cannot be changed.'
        });
      }

      if (!isInnoveity && formattedCode !== organization.companyCode) {
        const existingCode = await prisma.organization.findUnique({
          where: { companyCode: formattedCode }
        });

        if (existingCode && existingCode.id !== organization.id) {
          return res.status(400).json({
            success: false,
            message: `Company code "${formattedCode}" is already in use by another organization.`
          });
        }
        finalCode = formattedCode;
      }
    }

    let logoPath = organization.logo;
    if (req.file) {
      logoPath = `/uploads/logos/${req.file.filename}`;
    }

    const updatedOrganization = await prisma.organization.update({
      where: { id },
      data: {
        name: finalName,
        companyCode: finalCode,
        slug: finalSlug,
        email: email !== undefined ? (email ? email.trim() : null) : organization.email,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : organization.phone,
        website: website !== undefined ? (website ? website.trim() : null) : organization.website,
        address: address !== undefined ? (address ? address.trim() : null) : organization.address,
        timezone: timezone || organization.timezone,
        logo: logoPath
      }
    });

    res.json({
      success: true,
      message: `Organization "${updatedOrganization.name}" updated successfully.`,
      data: updatedOrganization
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/organizations/:id/status
 * Activate or suspend a company with real-time socket disconnection
 */
const updateOrganizationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    const isInnoveity = organization.slug === 'innoveity' || organization.companyCode === 'INN001';

    if (isInnoveity && status && status.toUpperCase() === 'SUSPENDED') {
      return res.status(400).json({
        success: false,
        message: 'The default INNOVEITY organization cannot be suspended.'
      });
    }

    const newStatus = status ? status.toUpperCase() : (organization.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE');

    const updatedOrganization = await prisma.organization.update({
      where: { id },
      data: { status: newStatus }
    });

    // If company is suspended, disconnect active socket connections for that company
    if (newStatus === 'SUSPENDED') {
      disconnectOrganizationSockets(id);
    }

    await logOrganizationAction(
      id,
      req.user?.id,
      req.user?.email,
      newStatus === 'SUSPENDED' ? 'COMPANY_SUSPENDED' : 'COMPANY_ACTIVATED',
      { previousStatus: organization.status, newStatus }
    );

    res.json({
      success: true,
      message: `Organization status updated to ${updatedOrganization.status}.`,
      data: updatedOrganization
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/organizations/:id
 * Permanent Cascade Deletion for Tenant and all associated records
 */
const deleteOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    const isInnoveity = organization.slug === 'innoveity' || organization.companyCode === 'INN001';

    if (isInnoveity) {
      return res.status(400).json({
        success: false,
        message: 'Default Innoveity Workspace cannot be deleted.'
      });
    }

    const confirmText = req.body?.confirmText || req.query?.confirmText || req.body?.deleteInputText;
    if (confirmText !== 'CONFIRM') {
      return res.status(422).json({
        success: false,
        message: 'Type CONFIRM to continue.'
      });
    }

    // Execute transactional permanent cascade deletion for all tenant records
    await prisma.$transaction(async (tx) => {
      const orgId = id;

      // 1. Fetch all user IDs in the company
      const orgUsers = await tx.user.findMany({
        where: { organizationId: orgId },
        select: { id: true }
      });
      const userIds = orgUsers.map((u) => u.id);

      // 2. Notifications & Activity Logs
      if (userIds.length > 0) {
        await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
        await tx.activityLog.deleteMany({ where: { userId: { in: userIds } } });
      }
      await tx.activityLog.deleteMany({ where: { organizationId: orgId } });

      // 3. Chat System (Messages, Read Receipts, Members, Rooms)
      const orgChatRooms = await tx.chatRoom.findMany({
        where: { organizationId: orgId },
        select: { id: true }
      });
      const roomIds = orgChatRooms.map((r) => r.id);

      if (roomIds.length > 0) {
        const chatMessages = await tx.chatMessage.findMany({
          where: { roomId: { in: roomIds } },
          select: { id: true }
        });
        const messageIds = chatMessages.map((m) => m.id);

        if (messageIds.length > 0) {
          await tx.messageRead.deleteMany({ where: { messageId: { in: messageIds } } });
        }
        await tx.chatMessage.deleteMany({ where: { roomId: { in: roomIds } } });
        await tx.chatRoomMember.deleteMany({ where: { roomId: { in: roomIds } } });
        await tx.chatRoom.deleteMany({ where: { organizationId: orgId } });
      }
      if (userIds.length > 0) {
        await tx.chatRoomMember.deleteMany({ where: { userId: { in: userIds } } });
      }

      // 4. Work Logs & Attachments & AI Feedback
      if (userIds.length > 0) {
        const workLogs = await tx.workLog.findMany({
          where: { userId: { in: userIds } },
          select: { id: true }
        });
        const workLogIds = workLogs.map((w) => w.id);
        if (workLogIds.length > 0) {
          await tx.workLogAttachment.deleteMany({ where: { workLogId: { in: workLogIds } } });
        }
        await tx.workLog.deleteMany({ where: { userId: { in: userIds } } });
        await tx.aIFeedback.deleteMany({ where: { userId: { in: userIds } } });
      }

      // 5. Attendance Records
      if (userIds.length > 0) {
        await tx.attendance.deleteMany({ where: { userId: { in: userIds } } });
      }

      // 6. Leave Requests & Balances & History
      if (userIds.length > 0) {
        await tx.leaveRequest.deleteMany({ where: { userId: { in: userIds } } });
        await tx.userLeaveBalance.deleteMany({ where: { userId: { in: userIds } } });
        await tx.leaveCreditHistory.deleteMany({ where: { userId: { in: userIds } } });
      }

      // 7. Tickets & Ticket Replies / Attachments
      await tx.ticket.deleteMany({ where: { organizationId: orgId } });
      if (userIds.length > 0) {
        await tx.ticket.deleteMany({ where: { creatorId: { in: userIds } } });
      }

      // 8. Tasks (Subtasks, Comments, Submissions, History, Dependencies, Audit)
      const orgTasks = await tx.task.findMany({
        where: { organizationId: orgId },
        select: { id: true }
      });
      const taskIds = orgTasks.map((t) => t.id);

      if (taskIds.length > 0) {
        await tx.subtask.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskHistory.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskReviewHistory.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.taskDependency.deleteMany({
          where: { OR: [{ taskId: { in: taskIds } }, { dependsOnTaskId: { in: taskIds } }] }
        });
        await tx.taskStageApprovalAudit.deleteMany({ where: { taskId: { in: taskIds } } });
        await tx.task.deleteMany({ where: { id: { in: taskIds } } });
      }
      await tx.task.deleteMany({ where: { organizationId: orgId } });

      // 9. Projects (Milestones, Documents, History, Members, Workflow Stages)
      const orgProjects = await tx.project.findMany({
        where: { organizationId: orgId },
        select: { id: true }
      });
      const projectIds = orgProjects.map((p) => p.id);

      if (projectIds.length > 0) {
        await tx.projectMilestone.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.projectDocument.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.projectHistory.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.projectMember.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.projectWorkflowStage.deleteMany({ where: { projectId: { in: projectIds } } });
        await tx.project.deleteMany({ where: { id: { in: projectIds } } });
      }
      await tx.project.deleteMany({ where: { organizationId: orgId } });

      // 10. Teams & Team Members
      const orgTeams = await tx.team.findMany({
        where: { organizationId: orgId },
        select: { id: true }
      });
      const teamIds = orgTeams.map((t) => t.id);

      if (teamIds.length > 0) {
        await tx.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
        await tx.team.deleteMany({ where: { id: { in: teamIds } } });
      }
      await tx.team.deleteMany({ where: { organizationId: orgId } });

      // 11. Assets & Asset Assignments
      const orgAssets = await tx.asset.findMany({
        where: { organizationId: orgId },
        select: { id: true }
      });
      const assetIds = orgAssets.map((a) => a.id);

      if (assetIds.length > 0) {
        await tx.assetAssignment.deleteMany({ where: { assetId: { in: assetIds } } });
        await tx.asset.deleteMany({ where: { id: { in: assetIds } } });
      }
      await tx.asset.deleteMany({ where: { organizationId: orgId } });

      // 12. Departments & Positions & Position/Promotion History
      if (userIds.length > 0) {
        await tx.positionHistory.deleteMany({ where: { userId: { in: userIds } } });
        await tx.promotionHistory.deleteMany({ where: { userId: { in: userIds } } });
      }
      await tx.position.deleteMany({ where: { organizationId: orgId } });
      await tx.designationMaster.deleteMany({ where: { organizationId: orgId } });
      await tx.departmentMaster.deleteMany({ where: { organizationId: orgId } });

      // 13. Payroll, Salary Structures & Payslips
      await tx.payslip.deleteMany({ where: { organizationId: orgId } });
      await tx.payrollBatch.deleteMany({ where: { organizationId: orgId } });
      await tx.salaryRevision.deleteMany({ where: { organizationId: orgId } });
      await tx.salaryStructure.deleteMany({ where: { organizationId: orgId } });
      await tx.salaryTemplate.deleteMany({ where: { organizationId: orgId } });
      await tx.payrollSettings.deleteMany({ where: { organizationId: orgId } });

      // 14. Calendars, Settings & Audit Logs
      await tx.workCalendar.deleteMany({ where: { organizationId: orgId } });
      await tx.holidayCalendar.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationSettings.deleteMany({ where: { organizationId: orgId } });
      await tx.systemSettings.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationAuditLog.deleteMany({ where: { organizationId: orgId } });

      // 15. Delete Users belonging to Organization
      await tx.user.deleteMany({ where: { organizationId: orgId } });

      // 16. Delete Organization
      await tx.organization.delete({
        where: { id: orgId }
      });
    }, { timeout: 30000 });

    // Disconnect active sockets for this organization
    disconnectOrganizationSockets(id);

    // Broadcast organization_deleted event to connected clients
    try {
      const { getIO } = require('../socket');
      const io = getIO ? getIO() : null;
      if (io) {
        io.emit('organization_deleted', {
          id,
          name: organization.name
        });
      }
    } catch (e) { }

    return res.status(200).json({
      success: true,
      message: 'Company deleted successfully.'
    });
  } catch (error) {
    console.error('[deleteOrganization] Permanent deletion failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Company deletion failed.'
    });
  }
};

/**
 * POST /api/organizations/:id/reset-admin-password
 * Reset Company Admin Password
 */
const resetCompanyAdminPassword = async (req, res, next) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    // Find the first ADMIN user of this organization
    const adminUser = await prisma.user.findFirst({
      where: {
        organizationId: id,
        role: 'ADMIN'
      }
    });

    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: `No Admin account found for organization "${organization.name}".`
      });
    }

    const temporaryPassword = `${organization.companyCode}@2026`;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: hashedPassword }
    });

    await logOrganizationAction(
      id,
      req.user?.id,
      req.user?.email,
      'ADMIN_PASSWORD_RESET',
      { adminEmail: adminUser.email }
    );

    res.json({
      success: true,
      message: `Admin password for "${adminUser.name}" reset successfully.`,
      data: {
        adminId: adminUser.id,
        adminName: adminUser.name,
        email: adminUser.email,
        temporaryPassword
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organizations/:id/stats
 * Retrieve organization entity usage metrics and storage
 */
const getOrganizationStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { subscriptionPlan: true }
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.'
      });
    }

    const currentStorageMB = await updateOrganizationStorage(id);

    const [users, projects, tasks, departments, teams, attendances, workLogs, leaveRequests, tickets, chatRooms] = await Promise.all([
      prisma.user.count({ where: { organizationId: id } }),
      prisma.project.count({ where: { organizationId: id } }),
      prisma.task.count({ where: { organizationId: id } }),
      prisma.departmentMaster.count({ where: { organizationId: id } }),
      prisma.team.count({ where: { organizationId: id } }),
      prisma.attendance.count({ where: { user: { organizationId: id } } }),
      prisma.workLog.count({ where: { user: { organizationId: id } } }),
      prisma.leaveRequest.count({ where: { user: { organizationId: id } } }),
      prisma.ticket.count({ where: { organizationId: id } }),
      prisma.chatRoom.count({ where: { organizationId: id } })
    ]);

    res.json({
      success: true,
      stats: {
        users,
        projects,
        tasks,
        departments,
        teams,
        attendances,
        workLogs,
        leaveRequests,
        tickets,
        chatRooms,
        storageUsedMB: currentStorageMB,
        subscriptionPlan: organization.subscriptionPlan
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organizations/platform/health
 * Aggregates platform health cards for Super Admin dashboard
 */
const getPlatformHealthStats = async (req, res, next) => {
  try {
    const [totalOrgs, activeOrgs, suspendedOrgs, totalUsers, totalProjects, orgsWithPlans] = await Promise.all([
      prisma.organization.count(),
      prisma.organization.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.project.count(),
      prisma.organization.findMany({
        select: { id: true, name: true, storageUsedMB: true, subscriptionPlan: true }
      })
    ]);

    let storageWarningsCount = 0;
    orgsWithPlans.forEach((o) => {
      const maxMB = (o.subscriptionPlan?.maxStorageGB || 5) * 1024;
      if (o.storageUsedMB >= maxMB * 0.8) {
        storageWarningsCount++;
      }
    });

    const activeSockets = getOnlineCount ? getOnlineCount() : 0;

    res.json({
      success: true,
      health: {
        totalCompanies: totalOrgs,
        activeCompanies: activeOrgs,
        suspendedCompanies: suspendedOrgs,
        storageWarnings: storageWarningsCount,
        activeUsers: totalUsers,
        totalProjects: totalProjects,
        activeSockets,
        uptimePercentage: '99.9%'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  updateOrganizationStatus,
  deleteOrganization,
  resetCompanyAdminPassword,
  getOrganizationStats,
  getPlatformHealthStats
};
