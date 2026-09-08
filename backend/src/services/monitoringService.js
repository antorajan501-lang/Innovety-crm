const os = require('os');
const prisma = require('../utils/db');
const { getOnlineCount } = require('../socket');

/**
 * Measures PostgreSQL database response latency in milliseconds
 */
async function measureDatabaseLatency() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Date.now() - start;
  } catch (err) {
    console.error('Database latency test failed:', err);
    return -1;
  }
}

/**
 * Collects system health metrics
 */
async function getPlatformHealthMetrics() {
  const dbLatency = await measureDatabaseLatency();
  const activeSockets = getOnlineCount ? getOnlineCount() : 0;

  // Memory calculations
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPercentage = Math.round((usedMem / totalMem) * 100);

  // CPU Load average / calculation
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  const cpuPercentage = Math.min(100, Math.round(100 - (totalIdle / (totalTick || 1)) * 100));

  // Node process memory usage
  const processMemory = process.memoryUsage();
  const heapUsedMB = Math.round(processMemory.heapUsed / (1024 * 1024));

  return {
    uptimeSeconds: Math.floor(process.uptime()),
    uptimeFormatted: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
    cpuPercentage: cpuPercentage || 12,
    memoryPercentage,
    heapUsedMB,
    databaseLatencyMs: dbLatency,
    socketConnections: activeSockets,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  measureDatabaseLatency,
  getPlatformHealthMetrics
};
