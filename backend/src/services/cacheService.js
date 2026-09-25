/**
 * In-memory High Performance Cache Service with TTL & Hit/Miss Telemetry
 * Optimizes repeated read queries (Dashboard KPIs, System Settings, Compliance Aggregates).
 */

const cacheStore = new Map();

const metrics = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0
};

/**
 * Get cached item or null if expired/absent
 */
const get = (key) => {
  const item = cacheStore.get(key);
  if (!item) {
    metrics.misses += 1;
    return null;
  }

  if (Date.now() > item.expiry) {
    cacheStore.delete(key);
    metrics.evictions += 1;
    metrics.misses += 1;
    return null;
  }

  metrics.hits += 1;
  return item.value;
};

/**
 * Set item in cache with TTL in seconds (default: 60s)
 */
const set = (key, value, ttlSeconds = 60) => {
  metrics.sets += 1;
  cacheStore.set(key, {
    value,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
  return value;
};

/**
 * Get or compute (cache-aside pattern)
 */
const getOrCompute = async (key, computeFn, ttlSeconds = 60) => {
  const cached = get(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await computeFn();
  set(key, fresh, ttlSeconds);
  return fresh;
};

/**
 * Invalidate cache by exact key or pattern prefix
 */
const invalidate = (pattern) => {
  if (!pattern) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.startsWith(pattern) || key.includes(pattern)) {
      cacheStore.delete(key);
    }
  }
};

/**
 * Retrieve cache performance telemetry
 */
const getCacheTelemetry = () => {
  const total = metrics.hits + metrics.misses;
  const hitRatio = total > 0 ? ((metrics.hits / total) * 100).toFixed(1) : '100.0';

  return {
    itemCount: cacheStore.size,
    hits: metrics.hits,
    misses: metrics.misses,
    hitRatio: `${hitRatio}%`,
    sets: metrics.sets,
    evictions: metrics.evictions
  };
};

module.exports = {
  get,
  set,
  getOrCompute,
  invalidate,
  getCacheTelemetry
};
