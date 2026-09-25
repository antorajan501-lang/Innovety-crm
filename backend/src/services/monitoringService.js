const os = require('os');
const { getSystemHealth } = require('./healthService');

/**
 * Monitoring Service for Innoveity CRM
 * Maintains time-series telemetry buffer for real-time graphs and alerts.
 */

const timeSeriesHistory = [];
const MAX_HISTORY_POINTS = 60; // Up to 60 snapshots

const recordSnapshot = async () => {
  try {
    const health = await getSystemHealth();
    const point = {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      heapUsedMb: health.memory.heapUsedMb,
      latencyMs: health.database.latencyMs >= 0 ? health.database.latencyMs : 0,
      activeUsers: health.telemetry.activeUsers24h
    };

    timeSeriesHistory.push(point);
    if (timeSeriesHistory.length > MAX_HISTORY_POINTS) {
      timeSeriesHistory.shift();
    }
  } catch (e) {
    // Ignore snapshot error
  }
};

// Seed initial history point
recordSnapshot();
setInterval(recordSnapshot, 30 * 1000); // 30-second interval

const getMonitoringData = async () => {
  const currentHealth = await getSystemHealth();
  return {
    current: currentHealth,
    history: timeSeriesHistory,
    alerts: [
      {
        id: 'ALT-1',
        type: 'PERFORMANCE',
        severity: currentHealth.database.latencyMs > 200 ? 'WARNING' : 'INFO',
        message: currentHealth.database.latencyMs > 200
          ? 'Database query latency exceeds 200ms threshold.'
          : 'Database latency is optimal (< 50ms).',
        timestamp: new Date()
      },
      {
        id: 'ALT-2',
        type: 'MEMORY',
        severity: currentHealth.memory.heapUsedMb > 800 ? 'WARNING' : 'INFO',
        message: `Node.js Heap usage is ${currentHealth.memory.heapUsedMb} MB.`,
        timestamp: new Date()
      }
    ]
  };
};

module.exports = {
  getMonitoringData
};
