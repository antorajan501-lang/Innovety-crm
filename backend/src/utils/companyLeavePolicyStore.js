const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/company_leave_policies.json');

// Ensure data directory exists
const dataDir = path.dirname(STORE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Get company-specific leave policy configuration
 */
function getCompanyLeavePolicy(organizationId) {
  const defaultPolicy = {
    allocationType: 'ANNUAL',
    carryForwardEnabled: true,
    maxCarryForwardDays: 5.0,
    halfDayAllowed: true,
    workingDaysOnly: true,
    autoApproval: false
  };

  if (!organizationId || !fs.existsSync(STORE_PATH)) {
    return defaultPolicy;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.policies && data.policies[organizationId]
      ? { ...defaultPolicy, ...data.policies[organizationId] }
      : defaultPolicy;
  } catch (err) {
    console.error('Error reading company leave policy:', err);
    return defaultPolicy;
  }
}

/**
 * Save company-specific leave policy configuration
 */
function setCompanyLeavePolicy(organizationId, policyData) {
  if (!organizationId) return;
  let data = { policies: {}, types: {} };
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      data = { policies: {}, types: {} };
    }
  }

  if (!data.policies) data.policies = {};
  data.policies[organizationId] = {
    ...data.policies[organizationId],
    ...policyData
  };

  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Read list of leave type IDs associated with organizationId
 */
function getCompanyLeaveTypeIds(organizationId) {
  if (!organizationId || !fs.existsSync(STORE_PATH)) return null;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.types ? data.types[organizationId] || null : null;
  } catch (err) {
    console.error('Error reading company leave types:', err);
    return null;
  }
}

/**
 * Get Set of all leave type IDs assigned to any organization
 */
function getAllAssignedLeaveTypeIds() {
  if (!fs.existsSync(STORE_PATH)) return new Set();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const set = new Set();
    if (data.types) {
      Object.values(data.types).forEach((ids) => {
        if (Array.isArray(ids)) {
          ids.forEach((id) => set.add(id));
        }
      });
    }
    return set;
  } catch (err) {
    return new Set();
  }
}

/**
 * Add a leave type ID to an organizationId
 */
function addLeaveTypeToCompany(organizationId, leaveTypeId) {
  if (!organizationId || !leaveTypeId) return;
  let data = { policies: {}, types: {} };
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      data = { policies: {}, types: {} };
    }
  }

  if (!data.types) data.types = {};
  const current = data.types[organizationId] || [];
  if (!current.includes(leaveTypeId)) {
    data.types[organizationId] = [...current, leaveTypeId];
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
}

/**
 * Remove a leave type ID from an organizationId
 */
function removeLeaveTypeFromCompany(organizationId, leaveTypeId) {
  if (!organizationId || !leaveTypeId) return;
  if (!fs.existsSync(STORE_PATH)) return;

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (data.types && data.types[organizationId]) {
      data.types[organizationId] = data.types[organizationId].filter((id) => id !== leaveTypeId);
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error removing leave type from company:', err);
  }
}

/**
 * Filter leave types for a company with strict multi-tenant isolation
 */
function filterLeaveTypesForCompany(allTypes, organizationId) {
  if (!Array.isArray(allTypes)) return [];
  if (!organizationId) return allTypes;

  const companyTypeIds = getCompanyLeaveTypeIds(organizationId) || [];
  const allAssignedTypeIds = getAllAssignedLeaveTypeIds();

  const filtered = allTypes.filter((lt) => {
    // Core system leave types (WFH, CL, SL) are ALWAYS included for every company
    const isSystemType = lt.isSystem || ['WFH', 'CL', 'SL'].includes((lt.code || '').toUpperCase());
    if (isSystemType) return true;

    // If explicitly assigned to THIS company, include it
    if (companyTypeIds.includes(lt.id)) return true;

    // If explicitly assigned to ANOTHER company, exclude it
    if (allAssignedTypeIds.has(lt.id)) return false;

    // Default system master types: available to companies that don't have custom types overrides yet
    return true;
  });

  return filtered;
}

module.exports = {
  getCompanyLeavePolicy,
  setCompanyLeavePolicy,
  getCompanyLeaveTypeIds,
  addLeaveTypeToCompany,
  removeLeaveTypeFromCompany,
  filterLeaveTypesForCompany
};
