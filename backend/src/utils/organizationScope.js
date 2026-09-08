const prisma = require('./db');

/**
 * Safely resolves the target organization ID for a request.
 * - SUPER_ADMIN: Can pass organizationId via query/body/params/headers to target any company.
 *   If 'all' is passed, returns null. If none passed, falls back to user.organizationId.
 * - ADMIN / ALL OTHER ROLES: Strictly returns user.organizationId.
 *   ANY client-supplied organizationId override is IGNORED to prevent tenant tampering.
 *
 * @param {Object} req - Express request object containing req.user
 * @returns {string|null} Target organization ID or null
 */
const getEffectiveOrgId = (req) => {
  const user = req?.user;
  if (!user) return null;

  if (user.role === 'SUPER_ADMIN') {
    const requestedOrgId =
      req.query?.organizationId ||
      req.body?.organizationId ||
      req.params?.organizationId ||
      req.headers?.['x-organization-id'];

    if (requestedOrgId && requestedOrgId !== 'all') {
      return requestedOrgId;
    }
    if (requestedOrgId === 'all') {
      return null;
    }
    return user.organizationId || null;
  }

  // Non-SUPER_ADMIN is strictly locked to their assigned organizationId
  return user.organizationId || null;
};

/**
 * Returns a Prisma `where` clause object for models WITH a scalar `organizationId` column.
 * e.g. User, Team, Ticket, Asset, ChatRoom, SalaryTemplate, PayrollSettings, Payslip, WorkCalendar.
 */
const getOrganizationWhere = (req, extra = {}) => {
  const targetOrgId = getEffectiveOrgId(req);
  if (!targetOrgId) {
    return { ...extra };
  }
  return {
    organizationId: targetOrgId,
    ...extra
  };
};

/**
 * Returns a Prisma `where` clause object for Project model (no scalar organizationId column).
 * Scopes projects by checking if creator, leader, or assigned team belongs to targetOrgId.
 */
const getProjectWhere = (req, extra = {}) => {
  const targetOrgId = getEffectiveOrgId(req);
  if (!targetOrgId) {
    return { ...extra };
  }

  const orgCondition = {
    OR: [
      { creator: { organizationId: targetOrgId } },
      { leader: { organizationId: targetOrgId } },
      { team: { organizationId: targetOrgId } }
    ]
  };

  if (extra.OR) {
    const existingOR = Array.isArray(extra.OR) ? extra.OR : [extra.OR];
    const { OR, ...restExtra } = extra;
    return {
      ...restExtra,
      AND: [
        orgCondition,
        { OR: existingOR }
      ]
    };
  }

  return {
    ...extra,
    ...orgCondition
  };
};

/**
 * Returns a Prisma `where` clause object for Task model (no scalar organizationId column).
 * Scopes tasks by checking if assignee, creator, team, or parent project belongs to targetOrgId.
 */
const getTaskWhere = (req, extra = {}) => {
  const targetOrgId = getEffectiveOrgId(req);
  if (!targetOrgId) {
    return { ...extra };
  }

  const orgCondition = {
    OR: [
      { assignee: { organizationId: targetOrgId } },
      { creator: { organizationId: targetOrgId } },
      { team: { organizationId: targetOrgId } },
      {
        project: {
          OR: [
            { creator: { organizationId: targetOrgId } },
            { leader: { organizationId: targetOrgId } },
            { team: { organizationId: targetOrgId } }
          ]
        }
      }
    ]
  };

  if (extra.OR) {
    const existingOR = Array.isArray(extra.OR) ? extra.OR : [extra.OR];
    const { OR, ...restExtra } = extra;
    return {
      ...restExtra,
      AND: [
        orgCondition,
        { OR: existingOR }
      ]
    };
  }

  return {
    ...extra,
    ...orgCondition
  };
};

/**
 * Returns a Prisma `where` clause object for models related to User (e.g. Attendance, LeaveRequest, WorkLog).
 */
const getUserRelationWhere = (req, extra = {}) => {
  const targetOrgId = getEffectiveOrgId(req);
  if (!targetOrgId) {
    return { ...extra };
  }
  return {
    ...extra,
    user: { organizationId: targetOrgId }
  };
};

/**
 * Asserts that a record belongs to the effective organization for the request.
 * If targetOrgId is present and record.organizationId (or record.user.organizationId) doesn't match, throws a 403 error.
 * Returns true if valid.
 */
const assertOrganizationAccess = (record, req) => {
  if (!record) return true;
  const targetOrgId = getEffectiveOrgId(req);
  if (!targetOrgId) return true; // SUPER_ADMIN with no selected org ('all') can view

  const recOrgId = record.organizationId || record.user?.organizationId || record.processedBy?.organizationId || record.batch?.organizationId;
  if (recOrgId && recOrgId !== targetOrgId) {
    const error = new Error('Forbidden: Access denied to record outside your company scope.');
    error.statusCode = 403;
    throw error;
  }
  return true;
};

module.exports = {
  getEffectiveOrgId,
  getOrganizationWhere,
  getProjectWhere,
  getTaskWhere,
  getUserRelationWhere,
  assertOrganizationAccess
};
