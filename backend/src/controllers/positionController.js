const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { logActivity } = require('../utils/activityLogger');

/**
 * GET /api/positions
 * Get all positions with employee counts sorted by hierarchy level
 */
const getPositions = async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      orderBy: { level: 'asc' },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    const formatted = positions.map(pos => ({
      ...pos,
      totalEmployees: pos._count.users
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Fetch positions error:', error);
    res.status(500).json({ message: 'Failed to fetch positions.' });
  }
};

/**
 * POST /api/positions
 * Create a new Position (Super Admin only)
 */
const createPosition = async (req, res) => {
  try {
    const { name, code, level, description, color, textColor, icon, priority, sortOrder } = req.body;

    if (!name || !code || level === undefined || level === null) {
      return res.status(400).json({ message: 'Position Name, Code, and Level are required.' });
    }

    const cleanName = String(name).trim();
    const cleanCode = String(code).trim().toUpperCase();
    const parsedLevel = parseInt(level, 10);

    if (isNaN(parsedLevel) || parsedLevel < 1) {
      return res.status(400).json({ message: 'Level must be a positive integer.' });
    }

    // Check duplicate name
    const existingName = await prisma.position.findFirst({
      where: { name: { equals: cleanName, mode: 'insensitive' } }
    });
    if (existingName) {
      return res.status(400).json({ message: `Position name "${cleanName}" already exists.` });
    }

    // Check duplicate code
    const existingCode = await prisma.position.findFirst({
      where: { code: { equals: cleanCode, mode: 'insensitive' } }
    });
    if (existingCode) {
      return res.status(400).json({ message: `Position code "${cleanCode}" already exists.` });
    }

    // Check duplicate level
    const existingLevel = await prisma.position.findUnique({
      where: { level: parsedLevel }
    });
    if (existingLevel) {
      return res.status(400).json({ message: `Hierarchy Level ${parsedLevel} is already assigned to "${existingLevel.name}".` });
    }

    const position = await prisma.position.create({
      data: {
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
      details: `Created new position "${position.name}" (Code: ${position.code}, Level: ${position.level})`,
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
 * Update an existing Position
 */
const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, level, description, color, textColor, icon, priority, sortOrder, status } = req.body;

    const existingPos = await prisma.position.findUnique({ where: { id } });
    if (!existingPos) {
      return res.status(404).json({ message: 'Position not found.' });
    }

    const dataToUpdate = {};

    if (name && name !== existingPos.name) {
      const cleanName = String(name).trim();
      const duplicateName = await prisma.position.findFirst({
        where: { name: { equals: cleanName, mode: 'insensitive' }, id: { not: id } }
      });
      if (duplicateName) {
        return res.status(400).json({ message: `Position name "${cleanName}" already exists.` });
      }
      dataToUpdate.name = cleanName;
    }

    if (code && code !== existingPos.code) {
      const cleanCode = String(code).trim().toUpperCase();
      const duplicateCode = await prisma.position.findFirst({
        where: { code: { equals: cleanCode, mode: 'insensitive' }, id: { not: id } }
      });
      if (duplicateCode) {
        return res.status(400).json({ message: `Position code "${cleanCode}" already exists.` });
      }
      dataToUpdate.code = cleanCode;
    }

    if (level !== undefined && level !== null && level !== existingPos.level) {
      const parsedLevel = parseInt(level, 10);
      const duplicateLevel = await prisma.position.findFirst({
        where: { level: parsedLevel, id: { not: id } }
      });
      if (duplicateLevel) {
        return res.status(400).json({ message: `Hierarchy Level ${parsedLevel} is already assigned to "${duplicateLevel.name}".` });
      }
      dataToUpdate.level = parsedLevel;
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
      details: `Updated position "${updated.name}" (${updated.code})`,
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
 * Toggle Active / Inactive Status
 */
const togglePositionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be ACTIVE or INACTIVE.' });
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
 * Safe Deletion: Allowed only if position is INACTIVE and has ZERO assigned employees
 */
const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;

    const position = await prisma.position.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } }
    });

    if (!position) {
      return res.status(404).json({ message: 'Position not found.' });
    }

    if (position._count.users > 0) {
      return res.status(400).json({
        message: `Cannot delete position "${position.name}". It is currently assigned to ${position._count.users} employee(s). Please reassign them first.`
      });
    }

    if (position.status !== 'INACTIVE') {
      return res.status(400).json({
        message: `Cannot delete active position "${position.name}". Please deactivate the position first before deleting.`
      });
    }

    await prisma.position.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'POSITION_DELETED',
      details: `Deleted inactive position "${position.name}" (${position.code})`,
      ipAddress: req.ip
    });

    res.json({ message: `Position "${position.name}" deleted successfully.` });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ message: 'Failed to delete position.' });
  }
};

/**
 * PUT /api/positions/reorder
 * Reorder Position Hierarchy Levels dynamically
 */
const reorderPositions = async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, level }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items array is required for reordering.' });
    }

    // Step 1: Temporarily set levels to negative numbers to prevent @unique constraint collision during level swap
    const tempUpdates = items.map((item, idx) =>
      prisma.position.update({
        where: { id: item.id },
        data: {
          level: -(idx + 1000),
          sortOrder: -(idx + 1000)
        }
      })
    );

    // Step 2: Set final positive levels & sortOrder
    const finalUpdates = items.map((item, idx) =>
      prisma.position.update({
        where: { id: item.id },
        data: {
          level: idx + 1,
          sortOrder: idx + 1
        }
      })
    );

    await prisma.$transaction([...tempUpdates, ...finalUpdates]);

    await logActivity({
      userId: req.user.id,
      action: 'POSITIONS_REORDERED',
      details: 'Reordered position hierarchy levels',
      ipAddress: req.ip
    });

    const reordered = await prisma.position.findMany({
      orderBy: { level: 'asc' },
      include: { _count: { select: { users: true } } }
    });

    const formatted = reordered.map(p => ({
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
