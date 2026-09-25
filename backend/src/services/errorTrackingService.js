/**
 * Centralized Error Tracking Service for Innoveity CRM
 * Captures backend exceptions, API failures, and client-side UI crashes with stack traces,
 * user context, and forensic metadata.
 */

const errorBuffer = [];
const MAX_ERRORS = 200;

/**
 * Track an error occurrence
 */
const trackError = ({
  message,
  stack,
  type = 'BACKEND_EXCEPTION',
  statusCode = 500,
  path = null,
  method = null,
  userId = null,
  organizationId = null,
  ip = null,
  userAgent = null,
  componentStack = null
}) => {
  const errorRecord = {
    id: 'ERR-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    type, // 'BACKEND_EXCEPTION' | 'FRONTEND_CRASH' | 'API_FAILURE'
    message: String(message || 'Unknown Exception').substring(0, 500),
    stack: stack ? String(stack).substring(0, 3000) : null,
    componentStack: componentStack ? String(componentStack).substring(0, 1500) : null,
    statusCode: Number(statusCode) || 500,
    path: path || null,
    method: method || null,
    userId: userId || null,
    organizationId: organizationId || null,
    ip: ip || '127.0.0.1',
    userAgent: userAgent ? String(userAgent).substring(0, 200) : null,
    timestamp: new Date()
  };

  errorBuffer.unshift(errorRecord);
  if (errorBuffer.length > MAX_ERRORS) {
    errorBuffer.pop();
  }

  return errorRecord;
};

/**
 * Record a client-side frontend crash report
 */
const recordClientCrash = ({
  message,
  stack,
  componentStack,
  url,
  userId,
  organizationId,
  ip,
  userAgent
}) => {
  return trackError({
    message,
    stack,
    componentStack,
    path: url,
    method: 'CLIENT_RENDER',
    type: 'FRONTEND_CRASH',
    statusCode: 0,
    userId,
    organizationId,
    ip,
    userAgent
  });
};

/**
 * Retrieve captured errors with search and filter
 */
const getErrorLogs = ({ limit = 50, type = 'ALL', search = '' } = {}) => {
  let filtered = [...errorBuffer];

  if (type && type !== 'ALL') {
    filtered = filtered.filter((e) => e.type === type);
  }

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.message?.toLowerCase().includes(term) ||
        e.path?.toLowerCase().includes(term) ||
        e.id?.toLowerCase().includes(term)
    );
  }

  return filtered.slice(0, Number(limit) || 50);
};

/**
 * Get error frequency and severity breakdown
 */
const getErrorStats = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayCount = errorBuffer.filter((e) => new Date(e.timestamp) >= startOfToday).length;
  const backendCount = errorBuffer.filter((e) => e.type === 'BACKEND_EXCEPTION').length;
  const frontendCount = errorBuffer.filter((e) => e.type === 'FRONTEND_CRASH').length;
  const apiFailureCount = errorBuffer.filter((e) => e.type === 'API_FAILURE').length;

  return {
    totalCaptured: errorBuffer.length,
    todayCount,
    breakdown: {
      backendExceptions: backendCount,
      frontendCrashes: frontendCount,
      apiFailures: apiFailureCount
    }
  };
};

/**
 * Clear captured error buffer
 */
const clearErrors = () => {
  errorBuffer.length = 0;
  return { success: true, message: 'Error tracking log cleared.' };
};

module.exports = {
  trackError,
  recordClientCrash,
  getErrorLogs,
  getErrorStats,
  clearErrors
};
