/**
 * Feature Flag Utility for Multi-Tenancy
 * Returns true unless MULTI_TENANT_ENABLED is explicitly set to 'false'
 */
const isMultiTenantEnabled = () => {
  return process.env.MULTI_TENANT_ENABLED !== 'false';
};

module.exports = {
  isMultiTenantEnabled
};
