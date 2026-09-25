const prisma = require('../utils/db');
const { getEffectiveSettings } = require('../utils/settingsResolver');
const { getCompanyBranding } = require('../utils/companyBrandingStore');

/**
 * GET /api/public/company/:slug
 * Retrieves non-sensitive public branding information for an organization.
 * Returns 404 if not found, 403 if suspended.
 */
const getPublicCompanyBranding = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || !slug.trim()) {
      return res.status(400).json({ message: 'Company slug or code is required.' });
    }

    const cleanSlug = slug.trim().toLowerCase();

    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { slug: cleanSlug },
          { companyCode: { equals: slug.trim(), mode: 'insensitive' } }
        ]
      }
    });

    if (!organization) {
      return res.status(404).json({ message: 'Organization not found.' });
    }

    if (organization.status === 'SUSPENDED') {
      return res.status(403).json({ message: 'This company account is currently suspended. Please contact system administrator.' });
    }

    const settings = await getEffectiveSettings(organization.id);
    const stored = getCompanyBranding(organization.id) || {};

    let dbOrgSettings = null;
    try {
      dbOrgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId: organization.id }
      });
    } catch (e) {}
    const dbBranding = (dbOrgSettings?.branding && typeof dbOrgSettings.branding === 'object') ? dbOrgSettings.branding : {};

    const loginPrimaryColor = stored.loginPrimaryColor || dbBranding.loginPrimaryColor || settings.primaryColor || '#F97316';
    const loginBackgroundType = stored.loginBackgroundType || dbBranding.loginBackgroundType || 'gradient';
    const loginBackgroundColor = stored.loginBackgroundColor || dbBranding.loginBackgroundColor || '#0F172A';
    const loginGradientStart = stored.loginGradientStart || dbBranding.loginGradientStart || '#0F172A';
    const loginGradientEnd = stored.loginGradientEnd || dbBranding.loginGradientEnd || '#1E293B';
    const loginGradientDirection = stored.loginGradientDirection || dbBranding.loginGradientDirection || 'to bottom right';
    const loginBackgroundImage = stored.loginBackgroundImage || dbBranding.loginBackgroundImage || null;
    const loginCardStyle = stored.loginCardStyle || dbBranding.loginCardStyle || 'glass';
    const loginButtonStyle = stored.loginButtonStyle || dbBranding.loginButtonStyle || 'rounded';
    const showLoginLogo = stored.showLoginLogo !== undefined ? stored.showLoginLogo : (dbBranding.showLoginLogo !== undefined ? dbBranding.showLoginLogo : true);
    const loginWelcomeTitle = stored.loginWelcomeTitle || dbBranding.loginWelcomeTitle || `Welcome to ${stored.companyName || dbBranding.companyName || organization.name}`;
    const loginWelcomeSubtitle = stored.loginWelcomeSubtitle || dbBranding.loginWelcomeSubtitle || 'Sign in to continue to your workspace';

    return res.json({
      id: organization.id,
      name: stored.companyName || dbBranding.companyName || settings.companyName || organization.name,
      slug: organization.slug,
      companyCode: organization.companyCode,
      logo: stored.companyLogo || dbBranding.companyLogo || settings.logo || organization.logo || null,
      primaryColor: loginPrimaryColor,
      timezone: settings.timezone || organization.timezone || 'Asia/Kolkata',
      status: organization.status,
      // Login Theme Customization Attributes
      loginPrimaryColor,
      loginBackgroundType,
      loginBackgroundColor,
      loginGradientStart,
      loginGradientEnd,
      loginGradientDirection,
      loginBackgroundImage,
      loginCardStyle,
      loginButtonStyle,
      showLoginLogo,
      loginWelcomeTitle,
      loginWelcomeSubtitle
    });
  } catch (error) {
    console.error('Error fetching public company branding:', error);
    return res.status(500).json({ message: 'Failed to retrieve company branding.', error: error.message });
  }
};

/**
 * GET /api/public/company/branding/active
 * Unauthenticated endpoint for the login page to read active company login theme and branding.
 */
const getActiveCompanyBranding = async (req, res) => {
  try {
    const { organizationId, companyId, slug } = req.query;
    const targetOrgId = organizationId || companyId || req.headers['x-organization-id'];

    let organization = null;
    if (targetOrgId && targetOrgId !== 'all') {
      organization = await prisma.organization.findUnique({
        where: { id: targetOrgId }
      });
    }

    if (!organization && slug && slug.trim()) {
      const cleanSlug = slug.trim().toLowerCase();
      organization = await prisma.organization.findFirst({
        where: {
          OR: [
            { slug: cleanSlug },
            { companyCode: { equals: slug.trim(), mode: 'insensitive' } }
          ]
        }
      });
    }

    if (!organization) {
      organization = await prisma.organization.findFirst({
        where: { status: { not: 'SUSPENDED' } },
        orderBy: { createdAt: 'asc' }
      });
    }

    const orgId = organization?.id;
    const stored = (orgId ? getCompanyBranding(orgId) : null) || getCompanyBranding('GLOBAL') || {};

    let dbOrgSettings = null;
    if (orgId) {
      try {
        dbOrgSettings = await prisma.organizationSettings.findUnique({
          where: { organizationId: orgId }
        });
      } catch (e) {}
    }

    const dbBranding = (dbOrgSettings?.branding && typeof dbOrgSettings.branding === 'object') ? dbOrgSettings.branding : {};
    const settings = orgId ? await getEffectiveSettings(orgId) : {};

    const loginPrimaryColor = stored.loginPrimaryColor || dbBranding.loginPrimaryColor || settings.primaryColor || '#F97316';
    const companyName = stored.companyName || dbBranding.companyName || settings.companyName || organization?.name || 'Innoveity Tech';
    const logo = stored.companyLogo || dbBranding.companyLogo || settings.logo || organization?.logo || null;

    return res.json({
      success: true,
      organizationId: orgId || null,
      companyName,
      name: companyName,
      logo,
      companyLogo: logo,
      slug: organization?.slug || 'innoveity',
      companyCode: organization?.companyCode || null,
      loginPrimaryColor,
      primaryColor: loginPrimaryColor
    });
  } catch (error) {
    console.error('Error fetching active company branding:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active company branding.',
      loginPrimaryColor: '#F97316'
    });
  }
};

module.exports = {
  getPublicCompanyBranding,
  getActiveCompanyBranding
};
