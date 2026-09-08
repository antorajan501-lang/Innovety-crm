const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '../data/company_repositories.json');

// Ensure data directory exists
const dataDir = path.dirname(STORE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Read list of repository IDs associated with organizationId
 */
function getCompanyRepositoryIds(organizationId) {
  if (!organizationId || !fs.existsSync(STORE_PATH)) return null;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.repositories ? data.repositories[organizationId] || null : null;
  } catch (err) {
    console.error('Error reading company repositories:', err);
    return null;
  }
}

/**
 * Get Set of all repository IDs assigned to any organization
 */
function getAllAssignedRepositoryIds() {
  if (!fs.existsSync(STORE_PATH)) return new Set();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    const set = new Set();
    if (data.repositories) {
      Object.values(data.repositories).forEach((ids) => {
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
 * Add a repository ID to an organizationId
 */
function addRepositoryToCompany(organizationId, repositoryId) {
  if (!organizationId || !repositoryId) return;
  let data = { repositories: {} };
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      data = JSON.parse(raw);
    } catch (err) {
      data = { repositories: {} };
    }
  }

  if (!data.repositories) data.repositories = {};
  const current = data.repositories[organizationId] || [];
  if (!current.includes(repositoryId)) {
    data.repositories[organizationId] = [...current, repositoryId];
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  }
}

/**
 * Remove a repository ID from an organizationId
 */
function removeRepositoryFromCompany(organizationId, repositoryId) {
  if (!organizationId || !repositoryId || !fs.existsSync(STORE_PATH)) return;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (data.repositories && Array.isArray(data.repositories[organizationId])) {
      data.repositories[organizationId] = data.repositories[organizationId].filter((id) => id !== repositoryId);
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error removing company repository:', err);
  }
}

/**
 * Filter repositories for a company with strict multi-tenant isolation
 */
function filterRepositoriesForCompany(allRepos, organizationId) {
  if (!Array.isArray(allRepos)) return [];
  if (!organizationId) return allRepos;

  const companyRepoIds = getCompanyRepositoryIds(organizationId) || [];
  const allAssignedRepoIds = getAllAssignedRepositoryIds();

  const filtered = allRepos.filter((repo) => {
    // If explicitly assigned to THIS company, include it
    if (companyRepoIds.includes(repo.id)) return true;

    // If explicitly assigned to ANOTHER company, exclude it
    if (allAssignedRepoIds.has(repo.id)) return false;

    // Unassigned system default repos: accessible to companies that don't have custom repos yet
    return true;
  });

  return filtered;
}

module.exports = {
  getCompanyRepositoryIds,
  addRepositoryToCompany,
  removeRepositoryFromCompany,
  filterRepositoriesForCompany
};
