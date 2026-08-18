const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');

// Helper to auto-generate asset ID (e.g. AST-1001)
const generateAssetId = async () => {
  const count = await prisma.asset.count();
  const number = 1001 + count;
  return `AST-${number}`;
};

// Helper to derive serial number prefix from Asset Name -> Model -> Category
const getSerialPrefix = (name, model, category) => {
  const target = (name || model || category || 'ASSET').trim();

  if (/macbook\s*pro/i.test(target)) return 'MBP';
  if (/macbook\s*air/i.test(target)) return 'MBA';
  if (/macbook/i.test(target)) return 'MB';
  if (/thinkpad/i.test(target)) return 'TP';
  if (/dell\s*xps/i.test(target)) return 'XPS';

  const words = target.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
  if (words.length === 0) return 'AST';
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }

  let prefix = '';
  for (const w of words) {
    prefix += w[0].toUpperCase();
  }
  return prefix.substring(0, 6);
};

// Create new asset (Admin / Super Admin)
const createAsset = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      model,
      serialNumber,
      purchaseDate,
      warrantyExpiry,
      cost,
      vendor,
      location,
      billPhoto,
      status,
      description,
      quantity
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: 'Asset name and category are required.' });
    }

    const qty = quantity !== undefined && quantity !== null && quantity !== '' ? parseInt(quantity, 10) : 1;

    if (isNaN(qty) || qty < 1 || qty > 500) {
      return res.status(400).json({ message: 'Quantity must be an integer between 1 and 500.' });
    }

    const parsedPurchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    const parsedWarrantyExpiry = warrantyExpiry ? new Date(warrantyExpiry) : null;
    const parsedCost = cost ? parseFloat(cost) : null;
    const uploadedBillPhoto = billPhoto || (req.file ? `/uploads/attachments/${req.file.filename}` : null);

    if (qty === 1) {
      if (serialNumber) {
        const existingSn = await prisma.asset.findUnique({ where: { serialNumber } });
        if (existingSn) {
          return res.status(400).json({ message: 'An asset with this serial number already exists.' });
        }
      }

      const assetId = await generateAssetId();

      const newAsset = await prisma.asset.create({
        data: {
          assetId,
          name,
          category: category || 'LAPTOP',
          brand: brand || null,
          model: model || null,
          serialNumber: serialNumber || null,
          purchaseDate: parsedPurchaseDate,
          warrantyExpiry: parsedWarrantyExpiry,
          cost: parsedCost,
          vendor: vendor || null,
          location: location || null,
          billPhoto: uploadedBillPhoto,
          status: status || 'AVAILABLE',
          description: description || null,
          quantity: 1
        }
      });

      await logActivity({
        userId: req.user.id,
        action: 'ASSET_CREATED',
        details: `Created new asset "${newAsset.name}" (${assetId})`
      });

      return res.status(201).json({
        success: true,
        created: 1,
        message: '1 asset created successfully',
        ...newAsset
      });
    }

    // Bulk creation (qty > 1)
    const prefix = getSerialPrefix(name, model, category);

    const createdAssets = await prisma.$transaction(async (tx) => {
      const baseCount = await tx.asset.count();
      const assetsToCreate = [];

      let seq = 1;
      while (true) {
        const testSn = `AUTO-${prefix}-${String(seq).padStart(3, '0')}`;
        const existing = await tx.asset.findUnique({ where: { serialNumber: testSn } });
        if (!existing) break;
        seq++;
      }

      for (let i = 0; i < qty; i++) {
        const currentNum = 1001 + baseCount + i;
        const assetId = `AST-${currentNum}`;
        const autoSn = `AUTO-${prefix}-${String(seq + i).padStart(3, '0')}`;

        const assetData = {
          assetId,
          name,
          category: category || 'LAPTOP',
          brand: brand || null,
          model: model || null,
          serialNumber: autoSn,
          purchaseDate: parsedPurchaseDate,
          warrantyExpiry: parsedWarrantyExpiry,
          cost: parsedCost,
          vendor: vendor || null,
          location: location || null,
          billPhoto: uploadedBillPhoto,
          status: status || 'AVAILABLE',
          description: description || null,
          quantity: qty
        };

        const created = await tx.asset.create({ data: assetData });
        assetsToCreate.push(created);
      }

      return assetsToCreate;
    });

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_BULK_CREATED',
      details: `Created ${qty} assets for "${name}" (Quantity: ${qty})`
    });

    return res.status(201).json({
      success: true,
      created: qty,
      message: `${qty} assets created successfully`,
      assets: createdAssets
    });
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ message: 'Failed to create asset.' });
  }
};

// Get all assets with filter, search & role checks
const getAllAssets = async (req, res) => {
  try {
    const { category, status, department, brand, search, page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Role-based visibility: Employee/Intern only view assets assigned to them
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      where.assignedToId = req.user.id;
    } else {
      // Admin filters
      if (category) where.category = category;
      if (status) where.status = status;
      if (brand) where.brand = { contains: brand, mode: 'insensitive' };
      if (department) {
        where.assignedTo = {
          department: { contains: department, mode: 'insensitive' }
        };
      }
    }

    if (search) {
      where.OR = [
        { assetId: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { assignedTo: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [assets, totalCount] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: {
            select: {
              id: true,
              employeeId: true,
              name: true,
              email: true,
              role: true,
              department: true,
              profilePic: true
            }
          }
        }
      }),
      prisma.asset.count({ where })
    ]);

    res.json({
      assets,
      meta: {
        totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all assets error:', error);
    res.status(500).json({ message: 'Failed to fetch assets.' });
  }
};

// Get single asset details by ID
const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            email: true,
            role: true,
            department: true,
            profilePic: true
          }
        },
        assignments: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, employeeId: true, role: true } },
            assignedBy: { select: { id: true, name: true } }
          }
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            category: true,
            createdAt: true
          }
        }
      }
    });

    if (!asset) {
      return res.status(404).json({ message: 'Asset not found.' });
    }

    // Role check: non-admins can only view their own assigned asset
    if ((req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') && asset.assignedToId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json(asset);
  } catch (error) {
    console.error('Get asset by id error:', error);
    res.status(500).json({ message: 'Failed to fetch asset details.' });
  }
};

// Update asset details
const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      brand,
      model,
      serialNumber,
      purchaseDate,
      warrantyExpiry,
      cost,
      vendor,
      location,
      billPhoto,
      status,
      description
    } = req.body;

    const existingAsset = await prisma.asset.findUnique({ where: { id } });
    if (!existingAsset) {
      return res.status(404).json({ message: 'Asset not found.' });
    }

    if (serialNumber && serialNumber !== existingAsset.serialNumber) {
      const existingSn = await prisma.asset.findUnique({ where: { serialNumber } });
      if (existingSn) {
        return res.status(400).json({ message: 'An asset with this serial number already exists.' });
      }
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        name: name || existingAsset.name,
        category: category || existingAsset.category,
        brand: brand !== undefined ? brand : existingAsset.brand,
        model: model !== undefined ? model : existingAsset.model,
        serialNumber: serialNumber !== undefined ? serialNumber : existingAsset.serialNumber,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : existingAsset.purchaseDate,
        warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : existingAsset.warrantyExpiry,
        cost: cost !== undefined ? (cost ? parseFloat(cost) : null) : existingAsset.cost,
        vendor: vendor !== undefined ? vendor : existingAsset.vendor,
        location: location !== undefined ? location : existingAsset.location,
        billPhoto: billPhoto !== undefined ? billPhoto : (req.file ? `/uploads/attachments/${req.file.filename}` : existingAsset.billPhoto),
        status: status || existingAsset.status,
        description: description !== undefined ? description : existingAsset.description
      },
      include: {
        assignedTo: true
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_UPDATED',
      details: `Updated asset "${updatedAsset.name}" (${updatedAsset.assetId})`
    });

    res.json(updatedAsset);
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ message: 'Failed to update asset.' });
  }
};

// Assign asset to a user (Intern, Employee, Admin, Team Leader)
const assignAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, expectedReturn, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'Assigned user is required.' });
    }

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(400).json({ message: 'Target user not found.' });
    }

    const assignedDate = new Date();
    const expectedReturnDate = expectedReturn ? new Date(expectedReturn) : null;

    // Transaction: update asset status & create assignment record
    const [updatedAsset, newAssignment] = await prisma.$transaction([
      prisma.asset.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          assignedToId: userId,
          assignedDate,
          expectedReturn: expectedReturnDate,
          notes: notes || null
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, employeeId: true, role: true, department: true }
          }
        }
      }),
      prisma.assetAssignment.create({
        data: {
          assetId: id,
          userId,
          assignedById: req.user.id,
          assignedDate,
          expectedReturn: expectedReturnDate,
          notes: notes || null,
          status: 'ACTIVE'
        }
      })
    ]);

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_ASSIGNED',
      details: `Assigned asset "${asset.name}" (${asset.assetId}) to ${targetUser.name} (${targetUser.employeeId})`
    });

    res.json(updatedAsset);
  } catch (error) {
    console.error('Assign asset error:', error);
    res.status(500).json({ message: 'Failed to assign asset.' });
  }
};

// Return asset
const returnAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnDate, conditionOnReturn, remarks } = req.body;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: { assignedTo: true }
    });

    if (!asset) {
      return res.status(404).json({ message: 'Asset not found.' });
    }

    const prevUser = asset.assignedTo;
    const returnTime = returnDate ? new Date(returnDate) : new Date();

    // Map return condition to asset status
    let nextStatus = 'AVAILABLE';
    if (conditionOnReturn === 'Damaged') nextStatus = 'DAMAGED';
    else if (conditionOnReturn === 'Lost') nextStatus = 'LOST';
    else if (conditionOnReturn === 'Needs Repair') nextStatus = 'MAINTENANCE';

    // Find active assignment and close it
    const activeAssignment = await prisma.assetAssignment.findFirst({
      where: { assetId: id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });

    await prisma.$transaction([
      prisma.asset.update({
        where: { id },
        data: {
          status: nextStatus,
          assignedToId: null,
          assignedDate: null,
          expectedReturn: null,
          notes: remarks || null
        }
      }),
      ...(activeAssignment
        ? [
            prisma.assetAssignment.update({
              where: { id: activeAssignment.id },
              data: {
                returnDate: returnTime,
                conditionOnReturn: conditionOnReturn || 'Good',
                remarks: remarks || null,
                status: 'RETURNED'
              }
            })
          ]
        : [])
    ]);

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_RETURNED',
      details: `Returned asset "${asset.name}" (${asset.assetId}) from ${prevUser ? prevUser.name : 'User'}. Condition: ${conditionOnReturn || 'Good'}`
    });

    res.json({ message: 'Asset returned successfully.', status: nextStatus });
  } catch (error) {
    console.error('Return asset error:', error);
    res.status(500).json({ message: 'Failed to return asset.' });
  }
};

// Delete asset (only if not currently assigned)
const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ message: 'Asset not found.' });
    }

    if (asset.assignedToId || asset.status === 'ASSIGNED') {
      return res.status(400).json({
        message: 'Cannot delete asset while it is currently assigned to a user. Please return the asset first.'
      });
    }

    await prisma.asset.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_DELETED',
      details: `Deleted asset "${asset.name}" (${asset.assetId})`
    });

    res.json({ message: 'Asset deleted successfully.' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ message: 'Failed to delete asset.' });
  }
};

// Get asset KPI statistics for dashboard
const getAssetAnalytics = async (req, res) => {
  try {
    const totalAssets = await prisma.asset.count();
    const assignedAssets = await prisma.asset.count({
      where: {
        OR: [
          { status: 'ASSIGNED' },
          { NOT: { assignedToId: null } }
        ]
      }
    });
    const availableAssets = Math.max(0, totalAssets - assignedAssets);

    res.json({
      totalAssets,
      availableAssets,
      assignedAssets
    });
  } catch (error) {
    console.error('Get asset analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch asset analytics.' });
  }
};

// Upload bill photo for an existing asset
const uploadBillPhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const billPhotoPath = `/uploads/attachments/${req.file.filename}`;

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: { billPhoto: billPhotoPath }
    });

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_BILL_UPLOADED',
      details: `Uploaded bill photocopy for asset "${updatedAsset.name}" (${updatedAsset.assetId})`
    });

    res.json({ message: 'Bill photocopy uploaded successfully.', billPhoto: billPhotoPath, asset: updatedAsset });
  } catch (error) {
    console.error('Upload bill photo error:', error);
    res.status(500).json({ message: 'Failed to upload bill photo.' });
  }
};

// Delete/Remove bill photo for an existing asset
const deleteBillPhoto = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: { billPhoto: null }
    });

    await logActivity({
      userId: req.user.id,
      action: 'ASSET_BILL_DELETED',
      details: `Removed bill photocopy from asset "${updatedAsset.name}" (${updatedAsset.assetId})`
    });

    res.json({ message: 'Bill photocopy deleted successfully.', asset: updatedAsset });
  } catch (error) {
    console.error('Delete bill photo error:', error);
    res.status(500).json({ message: 'Failed to delete bill photo.' });
  }
};

module.exports = {
  createAsset,
  getAllAssets,
  getAssetById,
  updateAsset,
  assignAsset,
  returnAsset,
  deleteAsset,
  getAssetAnalytics,
  uploadBillPhoto,
  deleteBillPhoto
};
