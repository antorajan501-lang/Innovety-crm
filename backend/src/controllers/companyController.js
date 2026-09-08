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
 * Protect INNOVEITY from deletion
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
        message: 'The default INNOVEITY organization cannot be deleted.'
      });
    }

    // Execute transactional cascade deletion for all child dependencies
    await prisma.$transaction(async (tx) => {
      // 1. Delete organization settings & audit logs
      await tx.organizationSettings.deleteMany({ where: { organizationId: id } });
      await tx.organizationAuditLog.deleteMany({ where: { organizationId: id } });

      // 2. Delete messages & chat rooms
      await tx.chatMessage.deleteMany({ where: { organizationId: id } });
      await tx.chatRoom.deleteMany({ where: { organizationId: id } });

      // 3. Delete work logs, leave requests & attendances
      await tx.workLog.deleteMany({ where: { organizationId: id } });
      await tx.leaveRequest.deleteMany({ where: { organizationId: id } });
      await tx.attendance.deleteMany({ where: { organizationId: id } });

      // 4. Delete tasks & projects
      await tx.task.deleteMany({ where: { organizationId: id } });
      await tx.project.deleteMany({ where: { organizationId: id } });

      // 5. Delete notifications
      await tx.notification.deleteMany({ where: { organizationId: id } });

      // 6. Delete users associated with organization (except SUPER_ADMIN)
      await tx.user.deleteMany({
        where: {
          organizationId: id,
          role: { not: 'SUPER_ADMIN' }
        }
      });

      // 7. Finally delete the Organization entity
      await tx.organization.delete({
        where: { id }
      });
    });

    // Disconnect active sockets for this organization
    disconnectOrganizationSockets(id);

    res.json({
      success: true,
      message: `Organization "${organization.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('[deleteOrganization] Transaction error:', error);
    next(error);
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

    const [users, projects, attendances, workLogs, leaveRequests, chatRooms] = await Promise.all([
      prisma.user.count({ where: { organizationId: id } }),
      prisma.project.count({ where: { organizationId: id } }),
      prisma.attendance.count({ where: { organizationId: id } }),
      prisma.workLog.count({ where: { organizationId: id } }),
      prisma.leaveRequest.count({ where: { organizationId: id } }),
      prisma.chatRoom.count({ where: { organizationId: id } })
    ]);

    res.json({
      success: true,
      stats: {
        users,
        projects,
        attendances,
        workLogs,
        leaveRequests,
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
