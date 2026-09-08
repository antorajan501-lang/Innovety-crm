const prisma = require('../utils/db');
const { getEffectiveSettings } = require('../utils/settingsResolver');

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

    return res.json({
      name: settings.companyName || organization.name,
      slug: organization.slug,
      companyCode: organization.companyCode,
      logo: settings.logo || organization.logo || null,
      primaryColor: settings.primaryColor || '#10B981',
      timezone: settings.timezone || organization.timezone || 'Asia/Kolkata',
      status: organization.status
    });
  } catch (error) {
    console.error('Error fetching public company branding:', error);
    return res.status(500).json({ message: 'Failed to retrieve company branding.', error: error.message });
  }
};

module.exports = {
  getPublicCompanyBranding
};
