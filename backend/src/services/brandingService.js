const prisma = require('../utils/db');

/**
 * Service to manage comprehensive company branding:
 * Logo, Theme Color, Login Background, Email Branding, and PDF Branding with live preview support.
 */

const DEFAULT_BRANDING = {
  companyName: 'Innoveity CRM',
  logo: null,
  selectedTheme: 'emerald',
  themeMode: 'light',
  themeColor: '#10B981', // Emerald
  accentColor: '#064E3B',
  loginBackground: 'linear-gradient(135deg, #064E3B 0%, #0F172A 100%)',
  emailBranding: {
    headerTitle: 'Innoveity Enterprise Notification',
    footerNotes: 'Confidential corporate communication. Powered by Innoveity CRM.',
    supportEmail: 'support@innovety.com',
    showCompanyLogo: true
  },
  pdfBranding: {
    primaryColor: '#10B981',
    headerHtml: '<h3>INNOVEITY CRM ENTERPRISE HRMS</h3>',
    footerHtml: '<p>Generated via Innoveity Automated HR Engine. All rights reserved.</p>',
    showWatermark: true,
    watermarkText: 'CONFIDENTIAL'
  }
};

const getCompanyBranding = async (organizationId) => {
  if (!organizationId) {
    return DEFAULT_BRANDING;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { settings: true }
  });

  if (!org) {
    return DEFAULT_BRANDING;
  }

  const orgSettingsBranding = org.settings?.branding && typeof org.settings.branding === 'object'
    ? org.settings.branding
    : {};

  const orgSettingsTheme = org.settings?.theme && typeof org.settings.theme === 'object'
    ? org.settings.theme
    : {};

  return {
    companyName: org.name,
    logo: org.logo || orgSettingsBranding.logo || null,
    selectedTheme: orgSettingsTheme.selectedTheme || orgSettingsBranding.selectedTheme || DEFAULT_BRANDING.selectedTheme,
    themeMode: orgSettingsTheme.themeMode || orgSettingsBranding.themeMode || DEFAULT_BRANDING.themeMode,
    themeColor: orgSettingsBranding.themeColor || '#10B981',
    accentColor: orgSettingsBranding.accentColor || '#064E3B',
    loginBackground: orgSettingsBranding.loginBackground || DEFAULT_BRANDING.loginBackground,
    emailBranding: {
      ...DEFAULT_BRANDING.emailBranding,
      ...(orgSettingsBranding.emailBranding || {})
    },
    pdfBranding: {
      ...DEFAULT_BRANDING.pdfBranding,
      ...(orgSettingsBranding.pdfBranding || {})
    }
  };
};

const updateCompanyBranding = async (organizationId, brandingData, actorId) => {
  if (!organizationId) {
    throw new Error('Organization ID is required to update branding.');
  }

  const currentBranding = await getCompanyBranding(organizationId);

  const mergedBranding = {
    ...currentBranding,
    ...brandingData,
    emailBranding: {
      ...currentBranding.emailBranding,
      ...(brandingData.emailBranding || {})
    },
    pdfBranding: {
      ...currentBranding.pdfBranding,
      ...(brandingData.pdfBranding || {})
    }
  };

  // 1. Update Organization logo if provided
  if (brandingData.logo !== undefined) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { logo: brandingData.logo || null }
    });
  }

  // 2. Update OrganizationSettings
  const tenantTheme = {
    selectedTheme: mergedBranding.selectedTheme || brandingData.selectedTheme || 'emerald',
    themeMode: mergedBranding.themeMode || brandingData.themeMode || 'light',
    primaryColor: mergedBranding.themeColor,
    accentColor: mergedBranding.accentColor
  };

  await prisma.organizationSettings.upsert({
    where: { organizationId },
    update: {
      branding: mergedBranding,
      theme: tenantTheme
    },
    create: {
      organizationId,
      branding: mergedBranding,
      theme: tenantTheme
    }
  });

  // 3. Log Audit Event
  await prisma.organizationAuditLog.create({
    data: {
      organizationId,
      action: 'COMPANY_EDIT',
      category: 'ORGANIZATION',
      entityType: 'OrganizationSettings',
      entityId: organizationId,
      performedById: actorId || null,
      details: {
        themeColor: mergedBranding.themeColor,
        hasLogo: !!mergedBranding.logo
      }
    }
  });

  return mergedBranding;
};

const resetCompanyBranding = async (organizationId, actorId) => {
  return await updateCompanyBranding(organizationId, DEFAULT_BRANDING, actorId);
};

module.exports = {
  DEFAULT_BRANDING,
  getCompanyBranding,
  updateCompanyBranding,
  resetCompanyBranding
};
