const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/company_departments.json');

// Ensure data directory exists
const dataDir = path.dirname(STORE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Read list of department IDs associated with organizationId
 */
function getCompanyDepartmentIds(organizationId) {
  if (!organizationId) return null;
  if (!fs.existsSync(STORE_PATH)) return null;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data[organizationId] || null;
  } catch (err) {
    console.error('Error reading company departments:', err);
    return null;
  }
}

/**
 * Get Set of all department IDs assigned to any organization
 */
function getAllAssignedCompanyDeptIds() {
  if (!fs.existsSync(STORE_PATH)) return new Set();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const set = new Set();
    Object.values(data).forEach((ids) => {
      if (Array.isArray(ids)) {
        ids.forEach((id) => set.add(id));
      }
    });
    return set;
  } catch (err) {
    return new Set();
  }
}

/**
 * Add a department ID to an organizationId
 */
function addDepartmentToCompany(organizationId, departmentId) {
  if (!organizationId || !departmentId) return;
  let data = {};
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      data = {};
    }
  }
  const current = data[organizationId] || [];
  if (!current.includes(departmentId)) {
    data[organizationId] = [...current, departmentId];
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
}

/**
 * Filter departments for a company with strict multi-tenant isolation
 */
function filterDepartmentsForCompany(allDepts, organizationId) {
  if (!Array.isArray(allDepts)) return [];
  if (!organizationId) return allDepts;

  const companyDeptIds = getCompanyDepartmentIds(organizationId) || [];
  const allAssignedDeptIds = getAllAssignedCompanyDeptIds();

  return allDepts.filter((d) => {
    // If explicitly assigned to THIS company, include it
    if (companyDeptIds.includes(d.id)) return true;

    // If explicitly assigned to ANOTHER company, exclude it
    if (allAssignedDeptIds.has(d.id)) return false;

    // Legacy master department: include if it has active users in this organization
    return (d._count?.users > 0);
  });
}

module.exports = {
  getCompanyDepartmentIds,
  addDepartmentToCompany,
  filterDepartmentsForCompany
};
