const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/company_position_orders.json');

// Ensure data directory exists
const dataDir = path.dirname(STORE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Read custom position order array for a given organizationId
 */
function getCompanyOrder(organizationId) {
  if (!organizationId) return null;
  if (!fs.existsSync(STORE_PATH)) return null;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data[organizationId] || null;
  } catch (err) {
    console.error('Error reading company position orders:', err);
    return null;
  }
}

/**
 * Write custom position order array for a given organizationId
 */
function setCompanyOrder(organizationId, positionIds) {
  if (!organizationId || !Array.isArray(positionIds)) return;
  let data = {};
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      data = {};
    }
  }
  data[organizationId] = positionIds;
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Sort position array using tenant-specific order mapping
 */
function sortPositionsForCompany(positions, organizationId) {
  if (!Array.isArray(positions)) return [];
  const customOrder = getCompanyOrder(organizationId);

  if (!customOrder || !Array.isArray(customOrder) || customOrder.length === 0) {
    return [...positions].sort((a, b) => (a.sortOrder || a.level || 0) - (b.sortOrder || b.level || 0));
  }

  const orderMap = new Map(customOrder.map((id, index) => [id, index]));

  return [...positions].sort((a, b) => {
    const indexA = orderMap.has(a.id) ? orderMap.get(a.id) : 9999 + (a.sortOrder || a.level || 0);
    const indexB = orderMap.has(b.id) ? orderMap.get(b.id) : 9999 + (b.sortOrder || b.level || 0);
    return indexA - indexB;
  });
}

/**
 * Remove a deleted positionId from custom order mapping
 */
function removePositionFromCompanyOrder(organizationId, positionId) {
  if (!organizationId || !positionId) return;
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (data[organizationId] && Array.isArray(data[organizationId])) {
      data[organizationId] = data[organizationId].filter((id) => id !== positionId);
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error removing position from company order:', err);
  }
}

module.exports = {
  getCompanyOrder,
  setCompanyOrder,
  removePositionFromCompanyOrder,
  sortPositionsForCompany
};
