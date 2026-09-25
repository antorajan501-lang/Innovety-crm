const prisma = require('../utils/db');

/**
 * Service to manage company assets with branch, condition, and issue/return tracking
 */

const createAsset = async ({
  organizationId,
  name,
  category = 'LAPTOP',
  brand,
  model,
  serialNumber,
  branchId,
  condition = 'EXCELLENT',
  cost,
  purchaseDate,
  warrantyExpiry,
  vendor,
  location,
  description
}) => {
  if (!name) {
    throw new Error('Asset name is required.');
  }

  // Auto-generate Asset ID e.g. AST-1001
  const count = await prisma.asset.count();
  const assetId = `AST-${1001 + count}`;

  if (serialNumber) {
    const existing = await prisma.asset.findFirst({
      where: { serialNumber }
    });
    if (existing) {
      throw new Error(`Asset with serial number "${serialNumber}" already exists.`);
    }
  }

  const asset = await prisma.asset.create({
    data: {
      organizationId,
      assetId,
      name: name.trim(),
      category: category || 'LAPTOP',
      brand: brand ? brand.trim() : null,
      model: model ? model.trim() : null,
      serialNumber: serialNumber ? serialNumber.trim() : null,
      branchId: branchId || null,
      condition: condition || 'EXCELLENT',
      cost: cost ? parseFloat(cost) : null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
      vendor: vendor ? vendor.trim() : null,
      location: location ? location.trim() : null,
      description: description ? description.trim() : null,
      status: 'AVAILABLE'
    },
    include: {
      branch: true
    }
  });

  return asset;
};

const getAssets = async ({
  organizationId,
  branchId,
  category,
  status,
  assignedToId,
  search
}) => {
  const where = {};

  if (organizationId) {
    where.organizationId = organizationId;
  }

  if (branchId && branchId !== 'ALL') {
    where.branchId = branchId;
  }

  if (category && category !== 'ALL') {
    where.category = category;
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { assetId: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { assignedTo: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      branch: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          employeeId: true,
          department: true,
          email: true,
          profilePic: true
        }
      }
    }
  });

  return assets;
};

const assignAsset = async ({
  assetId,
  userId,
  organizationId,
  branchId,
  condition,
  issueDate,
  expectedReturn,
  remarks,
  actorId
}) => {
  const where = { id: assetId };
  if (organizationId) where.organizationId = organizationId;

  const asset = await prisma.asset.findFirst({ where });
  if (!asset) {
    throw new Error('Asset not found.');
  }

  if (asset.status === 'ASSIGNED' && asset.assignedToId && asset.assignedToId !== userId) {
    throw new Error('Asset is already assigned to another employee.');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId }
  });
  if (!user) {
    throw new Error('Target employee not found.');
  }

  const assignedAt = issueDate ? new Date(issueDate) : new Date();

  // Update Asset
  const updatedAsset = await prisma.asset.update({
    where: { id: assetId },
    data: {
      assignedToId: user.id,
      status: 'ASSIGNED',
      issueDate: assignedAt,
      assignedDate: assignedAt,
      expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
      returnDate: null,
      branchId: branchId || user.branchId || asset.branchId,
      condition: condition || asset.condition || 'EXCELLENT',
      notes: remarks || asset.notes
    },
    include: {
      branch: true,
      assignedTo: true
    }
  });

  // Create Assignment record
  await prisma.assetAssignment.create({
    data: {
      assetId,
      userId: user.id,
      assignedById: actorId || null,
      assignedDate: assignedAt,
      expectedReturn: expectedReturn ? new Date(expectedReturn) : null,
      status: 'ACTIVE',
      remarks: remarks || null
    }
  });

  // Log Audit Event
  if (organizationId) {
    await prisma.organizationAuditLog.create({
      data: {
        organizationId,
        action: 'ASSET_ASSIGNMENT',
        category: 'ASSET',
        entityType: 'Asset',
        entityId: assetId,
        performedById: actorId || null,
        targetUserId: user.id,
        details: {
          assetName: asset.name,
          assetId: asset.assetId,
          employeeName: user.name,
          employeeId: user.employeeId
        }
      }
    });
  }

  return updatedAsset;
};

const returnAsset = async ({
  assetId,
  organizationId,
  returnDate,
  conditionOnReturn = 'Good',
  remarks,
  actorId
}) => {
  const where = { id: assetId };
  if (organizationId) where.organizationId = organizationId;

  const asset = await prisma.asset.findFirst({
    where,
    include: { assignedTo: true }
  });
  if (!asset) {
    throw new Error('Asset not found.');
  }

  const returnedAt = returnDate ? new Date(returnDate) : new Date();
  const previousUser = asset.assignedTo;

  // Update Asset
  const updatedAsset = await prisma.asset.update({
    where: { id: assetId },
    data: {
      assignedToId: null,
      status: 'AVAILABLE',
      returnDate: returnedAt,
      condition: conditionOnReturn || asset.condition,
      notes: remarks || `Returned on ${returnedAt.toLocaleDateString()}`
    },
    include: {
      branch: true
    }
  });

  // Update active assignment
  await prisma.assetAssignment.updateMany({
    where: { assetId, status: 'ACTIVE' },
    data: {
      status: 'RETURNED',
      returnDate: returnedAt,
      conditionOnReturn,
      remarks: remarks || null
    }
  });

  // Log Audit Event
  if (organizationId) {
    await prisma.organizationAuditLog.create({
      data: {
        organizationId,
        action: 'ASSET_RETURN',
        category: 'ASSET',
        entityType: 'Asset',
        entityId: assetId,
        performedById: actorId || null,
        targetUserId: previousUser?.id || null,
        details: {
          assetName: asset.name,
          assetId: asset.assetId,
          previousUser: previousUser?.name,
          conditionOnReturn
        }
      }
    });
  }

  return updatedAsset;
};

const getAssetDashboardStats = async (organizationId) => {
  const where = organizationId ? { organizationId } : {};

  const [total, assigned, available, maintenance, damaged, allAssets] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.count({ where: { ...where, status: 'ASSIGNED' } }),
    prisma.asset.count({ where: { ...where, status: 'AVAILABLE' } }),
    prisma.asset.count({ where: { ...where, status: 'MAINTENANCE' } }),
    prisma.asset.count({ where: { ...where, status: 'DAMAGED' } }),
    prisma.asset.findMany({
      where,
      select: { category: true, branchId: true }
    })
  ]);

  // Category counts
  const categoryCounts = {};
  for (const a of allAssets) {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;
  }

  return {
    total,
    assigned,
    available,
    maintenance,
    damaged,
    categoryBreakdown: categoryCounts
  };
};

module.exports = {
  createAsset,
  getAssets,
  assignAsset,
  returnAsset,
  getAssetDashboardStats
};
