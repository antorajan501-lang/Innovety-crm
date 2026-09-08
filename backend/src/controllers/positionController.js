const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logActivity } = require('../utils/activityLogger');
const { setCompanyOrder, sortPositionsForCompany, removePositionFromCompanyOrder } = require('../utils/companyPositionStore');

/**
 * Robust helper to resolve non-empty organizationId from request body, query, or user session
 */
const resolveOrgId = (req) => {
  if (req.user?.role === 'SUPER_ADMIN') {
    const bodyOrg = req.body?.organizationId;
    const queryOrg = req.query?.organizationId;
    const userOrg = req.user?.organizationId;

    if (bodyOrg && typeof bodyOrg === 'string' && bodyOrg.trim() !== '' && bodyOrg.trim() !== 'all') {
      return bodyOrg.trim();
    }
    if (queryOrg && typeof queryOrg === 'string' && queryOrg.trim() !== '' && queryOrg.trim() !== 'all') {
      return queryOrg.trim();
    }
    if (userOrg && typeof userOrg === 'string' && userOrg.trim() !== '') {
      return userOrg.trim();
    }
    return null;
  }
  return req.user?.organizationId || null;
};

/**
 * GET /api/positions
 * Get positions for a specific organization with employee counts sorted by hierarchy level
 */
const getPositions = async (req, res) => {
  try {
    const organizationId = resolveOrgId(req);

    const whereClause = organizationId ? { organizationId } : {};
    const whereUsers = organizationId ? { organizationId } : {};

    const positions = await prisma.position.findMany({
      where: whereClause,
      orderBy: { level: 'asc' },
      include: {
        _count: {
          select: {
            users: {
              where: whereUsers
            }
          }
        }
      }
    });

    const formatted = positions.map(pos => ({
      ...pos,
      totalEmployees: pos._count.users
    }));

    const sortedPositions = sortPositionsForCompany(formatted, organizationId);

    res.json(sortedPositions);
  } catch (error) {
    console.error('Fetch positions error:', error);
    res.status(500).json({ message: 'Failed to fetch positions.' });
  }
};

/**
 * POST /api/positions
 * Create a new Position within a specific company (Super Admin / Admin)
 */
const createPosition = async (req, res) => {
  try {
    const { name, code, level, description, color, textColor, icon, priority, sortOrder } = req.body;
    const organizationId = resolveOrgId(req);

    if (!organizationId) {
      return res.status(400).json({ message: 'Valid organizationId is required to create a position.' });
    }

    // Validate organization exists
    const orgExists = await prisma.organization.findUnique({
      where: { id: organizationId }
    });
    if (!orgExists) {
      return res.status(404).json({ message: 'Selected company does not exist.' });
    }

    if (!name || !code || level === undefined || level === null) {
      return res.status(400).json({ message: 'Position Name, Code, and Level are required.' });
    }

    const cleanName = String(name).trim();
    const cleanCode = String(code).trim().toUpperCase();
    const parsedLevel = parseInt(level, 10);

    if (isNaN(parsedLevel) || parsedLevel < 1) {
      return res.status(400).json({ message: 'Level must be a positive integer.' });
    }

    // Check duplicate name within the company
    const existingName = await prisma.position.findFirst({
      where: {
        organizationId,
        name: { equals: cleanName, mode: 'insensitive' }
      }
    });
    if (existingName) {
      return res.status(400).json({ message: `Position name "${cleanName}" already exists in this company.` });
    }

    // Check duplicate code within the company
    const existingCode = await prisma.position.findFirst({
      where: {
        organizationId,
        code: { equals: cleanCode, mode: 'insensitive' }
      }
    });
    if (existingCode) {
      return res.status(400).json({ message: `Position code "${cleanCode}" already exists in this company.` });
    }

    // Check duplicate level within the company
    const existingLevel = await prisma.position.findFirst({
      where: {
        organizationId,
        level: parsedLevel
      }
    });
    if (existingLevel) {
      return res.status(400).json({ message: `Hierarchy Level ${parsedLevel} is already assigned to "${existingLevel.name}" in this company.` });
    }

    const position = await prisma.position.create({
      data: {
        organizationId,
        name: cleanName,
        code: cleanCode,
        level: parsedLevel,
        description: description || null,
        color: color || '#4F46E5',
        textColor: textColor || '#FFFFFF',
        icon: icon || 'Award',
        priority: priority ? parseInt(priority, 10) : parsedLevel,
        sortOrder: sortOrder ? parseInt(sortOrder, 10) : parsedLevel
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'POSITION_CREATED',
      details: `Created new position "${position.name}" (Code: ${position.code}, Level: ${position.level}) for organizationId "${organizationId}"`,
      ipAddress: req.ip
    });

    res.status(201).json(position);
  } catch (error) {
    console.error('Create position error:', error);
    res.status(500).json({ message: 'Failed to create position.' });
  }
};

/**
 * PUT /api/positions/:id
 * Update an existing Position with company ownership validation and self-edit bug fix
 */
const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, level, description, color, textColor, icon, priority, sortOrder, status } = req.body;
    const organizationId = resolveOrgId(req);

    // Validate position ownership
    const existingPos = await prisma.position.findFirst({
      where: organizationId ? { id, organizationId } : { id }
    });
    if (!existingPos) {
      return res.status(404).json({ message: 'Position not found in selected company.' });
    }

    const targetOrgId = existingPos.organizationId;
    const dataToUpdate = {};

    // 1. Name duplicate check (only if name changed)
    if (name) {
      const cleanName = String(name).trim();
      if (cleanName.toLowerCase() !== existingPos.name.toLowerCase()) {
        const duplicateName = await prisma.position.findFirst({
          where: {
            organizationId: targetOrgId,
            name: { equals: cleanName, mode: 'insensitive' },
            id: { not: id }
          }
        });
        if (duplicateName) {
          return res.status(400).json({ message: `Position name "${cleanName}" already exists in this company.` });
        }
        dataToUpdate.name = cleanName;
      }
    }

    // 2. Code duplicate check (only if code changed)
    if (code) {
      const cleanCode = String(code).trim().toUpperCase();
      if (cleanCode !== existingPos.code.toUpperCase()) {
        const duplicateCode = await prisma.position.findFirst({
          where: {
            organizationId: targetOrgId,
            code: { equals: cleanCode, mode: 'insensitive' },
            id: { not: id }
          }
        });
        if (duplicateCode) {
          return res.status(400).json({ message: `Position code "${cleanCode}" already exists in this company.` });
        }
        dataToUpdate.code = cleanCode;
      }
    }

    // 3. Level duplicate check (only if level changed numerical value)
    if (level !== undefined && level !== null) {
      const parsedLevel = parseInt(level, 10);
      if (isNaN(parsedLevel) || parsedLevel < 1) {
        return res.status(400).json({ message: 'Level must be a positive integer.' });
      }

      if (parsedLevel !== existingPos.level) {
        const duplicateLevel = await prisma.position.findFirst({
          where: {
            organizationId: targetOrgId,
            level: parsedLevel,
            id: { not: id }
          }
        });
        if (duplicateLevel) {
          return res.status(400).json({ message: `Hierarchy Level ${parsedLevel} is already assigned to "${duplicateLevel.name}" in this company.` });
        }
        dataToUpdate.level = parsedLevel;
      }
    }

    if (description !== undefined) dataToUpdate.description = description;
    if (color) dataToUpdate.color = color;
    if (textColor) dataToUpdate.textColor = textColor;
    if (icon) dataToUpdate.icon = icon;
    if (priority !== undefined) dataToUpdate.priority = parseInt(priority, 10);
    if (sortOrder !== undefined) dataToUpdate.sortOrder = parseInt(sortOrder, 10);
    if (status) dataToUpdate.status = status;

    const updated = await prisma.position.update({
      where: { id },
      data: dataToUpdate
    });

    await logActivity({
      userId: req.user.id,
      action: 'POSITION_UPDATED',
      details: `Updated position "${updated.name}" (${updated.code}) in organization "${targetOrgId}"`,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ message: 'Failed to update position.' });
  }
};

/**
 * PATCH /api/positions/:id/status
 * Toggle Active / Inactive Status with ownership validation
 */
const togglePositionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organizationId = resolveOrgId(req);

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be ACTIVE or INACTIVE.' });
    }

    const existingPos = await prisma.position.findFirst({
      where: organizationId ? { id, organizationId } : { id }
    });
    if (!existingPos) {
      return res.status(404).json({ message: 'Position not found in selected company.' });
    }

    const updated = await prisma.position.update({
      where: { id },
      data: { status }
    });

    await logActivity({
      userId: req.user.id,
      action: 'POSITION_STATUS_TOGGLED',
      details: `Set status of position "${updated.name}" to ${status}`,
      ipAddress: req.ip
    });

    res.json(updated);
  } catch (error) {
    console.error('Toggle position status error:', error);
    res.status(500).json({ message: 'Failed to toggle position status.' });
  }
};

/**
 * DELETE /api/positions/:id
 * Deletes a position after verifying company ownership. Unassigns employees in this company before deleting.
 */
const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = resolveOrgId(req);

    // Strict ownership validation
    const position = await prisma.position.findFirst({
      where: organizationId ? { id, organizationId } : { id },
      include: { _count: { select: { users: true } } }
    });

    if (!position) {
      return res.status(404).json({ message: 'Position not found in selected company.' });
    }

    const assignedCount = position._count?.users || 0;
    let employeesUnassigned = 0;

    await prisma.$transaction(async (tx) => {
      // Unassign position from employees belonging to this organization
      const updateResult = await tx.user.updateMany({
        where: {
          positionId: id,
          organizationId: position.organizationId
        },
        data: { positionId: null }
      });
      employeesUnassigned = updateResult.count || assignedCount;

      // Delete the specific position record
      await tx.position.delete({
        where: { id: position.id }
      });
    });

    // Clean up in-memory / JSON tenant position ordering store
    removePositionFromCompanyOrder(position.organizationId, position.id);

    await logActivity({
      userId: req.user.id,
      action: 'POSITION_DELETED',
      details: `Deleted position "${position.name}" (${position.code}) from organization "${position.organizationId}", unassigned ${employeesUnassigned} employee(s).`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Position "${position.name}" deleted successfully.`,
      employeesUnassigned
    });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ message: 'Failed to delete position.' });
  }
};

/**
 * PUT /api/positions/reorder
 * Reorder Position Hierarchy Levels dynamically per company inside an atomic database transaction
 */
const reorderPositions = async (req, res) => {
  try {
    const { items, positions } = req.body;
    const organizationId = resolveOrgId(req);

    const reorderItems = Array.isArray(items) ? items : (Array.isArray(positions) ? positions : []);

    if (!organizationId) {
      return res.status(400).json({ message: 'organizationId is required for reordering positions.' });
    }

    if (reorderItems.length === 0) {
      return res.status(400).json({ message: 'Items array is required for reordering.' });
    }

    const validItems = reorderItems.filter((item) => item && item.id);

    // Atomically swap/reorder levels in database transaction
    await prisma.$transaction(async (tx) => {
      // Step 1: Assign temporary negative levels to avoid unique constraint collisions
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        await tx.position.updateMany({
          where: { id: item.id, organizationId },
          data: { level: -(1000 + i) }
        });
      }

      // Step 2: Assign final levels and sortOrders
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const newLevel = item.level !== undefined ? parseInt(item.level, 10) : (i + 1);
        const newSortOrder = item.sortOrder !== undefined ? parseInt(item.sortOrder, 10) : (i + 1);

        await tx.position.updateMany({
          where: { id: item.id, organizationId },
          data: {
            level: newLevel,
            sortOrder: newSortOrder,
            priority: newLevel
          }
        });
      }
    });

    // Also save order in-memory
    const positionIds = validItems.map((item) => item.id);
    setCompanyOrder(organizationId, positionIds);

    await logActivity({
      userId: req.user.id,
      action: 'POSITIONS_REORDERED',
      details: `Reordered position hierarchy levels for organization "${organizationId}"`,
      ipAddress: req.ip
    });

    const whereUsers = { organizationId };

    const allPositions = await prisma.position.findMany({
      where: { organizationId },
      orderBy: { level: 'asc' },
      include: {
        _count: {
          select: {
            users: {
              where: whereUsers
            }
          }
        }
      }
    });

    const formatted = allPositions.map((p) => ({
      ...p,
      totalEmployees: p._count.users
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Reorder positions error:', error);
    res.status(500).json({ message: 'Failed to reorder positions.' });
  }
};

/**
 * GET /api/positions/history/:userId
 * Fetch PositionHistory audit entries for a given user
 */
const getPositionHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const history = await prisma.positionHistory.findMany({
      where: { userId },
      include: {
        oldPosition: true,
        newPosition: true,
        changedBy: { select: { id: true, name: true, employeeId: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error('Fetch position history error:', error);
    res.status(500).json({ message: 'Failed to fetch position history.' });
  }
};

module.exports = {
  getPositions,
  createPosition,
  updatePosition,
  togglePositionStatus,
  deletePosition,
  reorderPositions,
  getPositionHistory
};
