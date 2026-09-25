const prisma = require('../utils/db');

/**
 * Service to manage organization branches
 */
const createBranch = async ({
  organizationId,
  name,
  branchName,
  code,
  branchCode,
  address,
  city,
  country = 'India',
  timezone = 'Asia/Kolkata',
  workingHoursRef = '09:00 - 18:00',
  status = 'ACTIVE',
  members,
  memberIds
}) => {
  const finalName = (name || branchName || '').trim();
  const finalCode = (code || branchCode || '').trim().toUpperCase();

  if (!finalName || !finalCode) {
    throw new Error('Branch name and branch code are required.');
  }

  const memberList = Array.isArray(members) && members.length > 0
    ? members
    : (Array.isArray(memberIds) ? memberIds : []);

  // Multi-tenant validation: verify members belong to the specified organization
  if (memberList.length > 0 && organizationId) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: memberList },
        organizationId: organizationId
      },
      select: { id: true }
    });
    if (validUsers.length !== memberList.length) {
      throw new Error('Some selected members do not belong to the selected company.');
    }
  }

  // Check for duplicate branch code in the organization
  if (organizationId) {
    const existing = await prisma.orgBranch.findFirst({
      where: {
        organizationId,
        code: finalCode,
        isArchived: false
      }
    });
    if (existing) {
      throw new Error(`Branch with code "${finalCode}" already exists in this organization.`);
    }
  }

  let resolvedWorkingHours = workingHoursRef;
  if (!resolvedWorkingHours && organizationId) {
    try {
      const defaultShift = await prisma.shiftMaster.findFirst({
        where: { organizationId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' }
      });
      if (defaultShift && defaultShift.startTime && defaultShift.endTime) {
        resolvedWorkingHours = `${defaultShift.startTime} - ${defaultShift.endTime}`;
      }
    } catch (e) {
      // fallback to default
    }
  }
  if (!resolvedWorkingHours) {
    resolvedWorkingHours = '09:00 - 18:00';
  }

  const branch = await prisma.orgBranch.create({
    data: {
      organizationId,
      name: finalName,
      code: finalCode,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      country: country ? country.trim() : 'India',
      timezone: timezone || 'Asia/Kolkata',
      workingHoursRef: resolvedWorkingHours,
      status: status || 'ACTIVE',
      isArchived: false
    }
  });

  // Assign selected members to this newly created branch
  if (memberList.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: { in: memberList },
        ...(organizationId ? { organizationId } : {})
      },
      data: {
        branchId: branch.id
      }
    });
  }

  return {
    ...branch,
    employeeCount: memberList.length,
    assetCount: 0
  };
};

const getBranches = async ({
  organizationId,
  search,
  status,
  includeArchived = false
}) => {
  const where = {};

  if (organizationId) {
    where.organizationId = organizationId;
  }

  if (!includeArchived) {
    where.isArchived = false;
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } }
    ];
  }

  const branches = await prisma.orgBranch.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: {
          users: true,
          assets: true
        }
      }
    }
  });

  return branches.map((b) => ({
    ...b,
    employeeCount: b._count?.users || 0,
    assetCount: b._count?.assets || 0
  }));
};

const getBranchById = async (branchId, organizationId) => {
  const where = { id: branchId };
  if (organizationId) {
    where.organizationId = organizationId;
  }

  const branch = await prisma.orgBranch.findFirst({
    where,
    include: {
      _count: {
        select: {
          users: true,
          assets: true
        }
      },
      users: {
        select: {
          id: true,
          name: true,
          employeeId: true,
          role: true,
          department: true,
          email: true,
          profilePic: true
        },
        take: 10
      }
    }
  });

  if (!branch) {
    throw new Error('Branch not found.');
  }

  return {
    ...branch,
    employeeCount: branch._count?.users || 0,
    assetCount: branch._count?.assets || 0
  };
};

const updateBranch = async (branchId, organizationId, updateData) => {
  const where = { id: branchId };
  if (organizationId) {
    where.organizationId = organizationId;
  }

  const existing = await prisma.orgBranch.findFirst({ where });
  if (!existing) {
    throw new Error('Branch not found.');
  }

  const rawName = updateData.name !== undefined ? updateData.name : updateData.branchName;
  const finalName = rawName !== undefined ? String(rawName).trim() : undefined;

  const rawCode = updateData.code !== undefined ? updateData.code : updateData.branchCode;
  const finalCode = rawCode !== undefined ? String(rawCode).trim().toUpperCase() : undefined;

  // If changing code, verify uniqueness
  if (finalCode && finalCode !== existing.code && organizationId) {
    const codeConflict = await prisma.orgBranch.findFirst({
      where: {
        organizationId,
        code: finalCode,
        id: { not: branchId },
        isArchived: false
      }
    });
    if (codeConflict) {
      throw new Error(`Branch with code "${finalCode}" already exists.`);
    }
  }

  const memberList = Array.isArray(updateData.members)
    ? updateData.members
    : (Array.isArray(updateData.memberIds) ? updateData.memberIds : null);

  if (memberList !== null && organizationId) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: memberList },
        organizationId: organizationId
      },
      select: { id: true }
    });
    if (validUsers.length !== memberList.length) {
      throw new Error('Some selected members do not belong to the selected company.');
    }
  }

  const updated = await prisma.orgBranch.update({
    where: { id: branchId },
    data: {
      ...(finalName !== undefined && { name: finalName }),
      ...(finalCode !== undefined && { code: finalCode }),
      ...(updateData.address !== undefined && { address: updateData.address ? updateData.address.trim() : null }),
      ...(updateData.city !== undefined && { city: updateData.city ? updateData.city.trim() : null }),
      ...(updateData.country !== undefined && { country: updateData.country ? updateData.country.trim() : null }),
      ...(updateData.timezone && { timezone: updateData.timezone }),
      ...(updateData.workingHoursRef && { workingHoursRef: updateData.workingHoursRef }),
      ...(updateData.status && { status: updateData.status }),
      ...(updateData.isArchived !== undefined && { isArchived: updateData.isArchived })
    }
  });

  if (memberList !== null) {
    await prisma.user.updateMany({
      where: { branchId },
      data: { branchId: null }
    });
    if (memberList.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: { in: memberList },
          ...(organizationId ? { organizationId } : {})
        },
        data: { branchId }
      });
    }
  }

  const employeeCount = memberList !== null
    ? memberList.length
    : await prisma.user.count({ where: { branchId } });

  return {
    ...updated,
    employeeCount
  };
};

const archiveBranch = async (branchId, organizationId) => {
  const where = { id: branchId };
  if (organizationId) {
    where.organizationId = organizationId;
  }

  const existing = await prisma.orgBranch.findFirst({ where });
  if (!existing) {
    throw new Error('Branch not found.');
  }

  const archived = await prisma.orgBranch.update({
    where: { id: branchId },
    data: {
      isArchived: true,
      status: 'ARCHIVED'
    }
  });

  return archived;
};

const getBranchStats = async (organizationId) => {
  const where = organizationId ? { organizationId } : {};

  const [totalBranches, activeBranches, archivedBranches] = await Promise.all([
    prisma.orgBranch.count({ where: { ...where, isArchived: false } }),
    prisma.orgBranch.count({ where: { ...where, status: 'ACTIVE', isArchived: false } }),
    prisma.orgBranch.count({ where: { ...where, isArchived: true } })
  ]);

  return {
    totalBranches,
    activeBranches,
    archivedBranches
  };
};

module.exports = {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  archiveBranch,
  getBranchStats
};
