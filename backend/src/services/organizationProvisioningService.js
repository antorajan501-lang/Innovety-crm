const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const prisma = require('../utils/db');

// Helper to generate URL-friendly slug
const generateSlug = async (name, currentId = null) => {
  let baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) baseSlug = 'company';

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug }
    });

    if (!existing || (currentId && existing.id === currentId)) {
      break;
    }

    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
};

// Helper to create tenant upload workspace directories recursively
const ensureTenantWorkspaceDirectories = (companyCode) => {
  const sanitizeFolder = companyCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const uploadsBase = path.join(__dirname, '../../uploads');
  
  const folders = [
    path.join(uploadsBase, 'logos', sanitizeFolder),
    path.join(uploadsBase, 'profiles', sanitizeFolder),
    path.join(uploadsBase, 'chat', sanitizeFolder),
    path.join(uploadsBase, 'worklogs', sanitizeFolder),
    path.join(uploadsBase, 'documents', sanitizeFolder)
  ];

  const createdFolders = [];
  try {
    for (const folder of folders) {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        createdFolders.push(folder);
      }
    }
    return createdFolders;
  } catch (err) {
    // Cleanup any partially created directories if error occurs
    for (const folder of createdFolders) {
      try {
        if (fs.existsSync(folder)) {
          fs.rmdirSync(folder, { recursive: true });
        }
      } catch (cleanupErr) { }
    }
    throw err;
  }
};

/**
 * Provisions a complete multi-tenant company workspace inside a single Prisma transaction.
 */
const provisionOrganizationWorkspace = async ({
  name,
  companyCode,
  email,
  phone,
  website,
  address,
  timezone = 'Asia/Kolkata',
  logoPath = null,
  adminName,
  adminEmail,
  adminEmployeeId
}) => {
  const formattedCode = companyCode.trim().toUpperCase();
  const cleanName = name.trim();
  const cleanAdminName = adminName ? adminName.trim() : null;
  const cleanAdminEmail = adminEmail ? adminEmail.trim().toLowerCase() : null;
  const cleanAdminEmployeeId = adminEmployeeId ? adminEmployeeId.trim().toUpperCase() : null;

  // 1. Uniqueness Checks
  const existingCode = await prisma.organization.findUnique({
    where: { companyCode: formattedCode }
  });
  if (existingCode) {
    throw new Error(`Company code "${formattedCode}" is already in use by another organization.`);
  }

  if (cleanAdminEmail) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: cleanAdminEmail }
    });
    if (existingEmail) {
      throw new Error(`Admin email "${cleanAdminEmail}" is already registered.`);
    }
  }

  if (cleanAdminEmployeeId) {
    const existingEmpId = await prisma.user.findUnique({
      where: { employeeId: cleanAdminEmployeeId }
    });
    if (existingEmpId) {
      throw new Error(`Employee ID "${cleanAdminEmployeeId}" is already registered.`);
    }
  }

  // 2. Generate slug & temporary password
  const slug = await generateSlug(cleanName);
  const temporaryPassword = `${formattedCode}@2026`;
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  let createdWorkspaceFolders = [];

  try {
    // 3. Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Organization
      const organization = await tx.organization.create({
        data: {
          name: cleanName,
          slug,
          companyCode: formattedCode,
          email: email ? email.trim() : null,
          phone: phone ? phone.trim() : null,
          website: website ? website.trim() : null,
          address: address ? address.trim() : null,
          timezone: timezone || 'Asia/Kolkata',
          logo: logoPath,
          status: 'ACTIVE'
        }
      });

      // Create OrganizationSettings
      const settings = await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
          companyName: cleanName,
          logo: logoPath,
          primaryColor: '#10B981',
          timezone: timezone || 'Asia/Kolkata',
          clockInTime: '09:00',
          clockOutTime: '18:00',
          autoClockOutEnabled: true
        }
      });

      // Create First Company Admin User (if admin details provided)
      let adminUser = null;
      if (cleanAdminName && cleanAdminEmail && cleanAdminEmployeeId) {
        adminUser = await tx.user.create({
          data: {
            organizationId: organization.id,
            name: cleanAdminName,
            email: cleanAdminEmail,
            employeeId: cleanAdminEmployeeId,
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE'
          },
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            role: true,
            status: true,
            organizationId: true,
            createdAt: true
          }
        });
      }

      return { organization, settings, adminUser };
    });

    // 4. Create upload workspace directories
    createdWorkspaceFolders = ensureTenantWorkspaceDirectories(formattedCode);

    return {
      success: true,
      message: `Organization "${result.organization.name}" provisioned successfully.`,
      organization: result.organization,
      settings: result.settings,
      admin: result.adminUser ? {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
        employeeId: result.adminUser.employeeId,
        temporaryPassword
      } : null,
      workspaceCreated: true
    };
  } catch (error) {
    // Rollback filesystem if created
    for (const folder of createdWorkspaceFolders) {
      try {
        if (fs.existsSync(folder)) {
          fs.rmdirSync(folder, { recursive: true });
        }
      } catch (e) {}
    }
    console.error('Failed to provision organization workspace:', error);
    throw new Error(error.message || 'Failed to provision company workspace. No partial company was created.');
  }
};

module.exports = {
  provisionOrganizationWorkspace,
  generateSlug
};
