const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/company_branding.json');

// Ensure data directory exists
const dataDir = path.dirname(STORE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Get branding settings object for organizationId
 */
function getCompanyBranding(organizationId) {
  if (!organizationId) return null;
  if (!fs.existsSync(STORE_PATH)) return null;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data[organizationId] || null;
  } catch (err) {
    console.error('Error reading company branding store:', err);
    return null;
  }
}

/**
 * Save or update branding settings for organizationId
 */
function setCompanyBranding(organizationId, brandingData) {
  if (!organizationId) return;
  let data = {};
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      data = {};
    }
  }

  const current = data[organizationId] || {};
  data[organizationId] = {
    ...current,
    ...brandingData,
    updatedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing company branding store:', err);
  }
}

module.exports = {
  getCompanyBranding,
  setCompanyBranding
};
