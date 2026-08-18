/**
 * Centralized Helper to determine payroll eligibility for CRM users.
 * Salaried staff roles: ADMIN, TEAM_LEADER, EMPLOYEE, INTERN.
 * Platform Root (SUPER_ADMIN) is excluded from employee payroll batches.
 */
const isPayrollEligibleUser = (user) => {
  if (!user || user.status !== 'ACTIVE') return false;
  const eligibleRoles = ['ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'];
  return eligibleRoles.includes(user.role);
};

module.exports = {
  isPayrollEligibleUser
};
