// Performance Logger Middleware
// Tracks request timing and performance metrics with feature flag support

interface PerfTimings {
  db_query: number;
  serialization: number;
  cache_lookup: number;
  total: number;
}

interface PerfLog {
  request_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number;
  timings: PerfTimings;
  timestamp: string;
}

// Feature flag: PERF_LOG (default: false)
const PERF_ENABLED = Deno.env.get('PERF_LOG') === 'true';

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Create a performance tracker for a request
 */
export function createPerfTracker(endpoint: string, method: string = 'GET') {
  const requestId = generateRequestId();
  const startTime = performance.now();
  
  const timings: PerfTimings = {
    db_query: 0,
    serialization: 0,
    cache_lookup: 0,
    total: 0
  };

  return {
    requestId,
    
    /**
     * Track DB query time
     */
    trackDbQuery: <T>(fn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      return fn().then((result) => {
        timings.db_query += performance.now() - start;
        return result;
      });
    },
    
    /**
     * Track serialization time
     */
    trackSerialization: <T>(fn: () => T): T => {
      const start = performance.now();
      const result = fn();
      timings.serialization += performance.now() - start;
      return result;
    },
    
    /**
     * Track cache lookup time
     */
    trackCache: <T>(fn: () => T): T => {
      const start = performance.now();
      const result = fn();
      timings.cache_lookup += performance.now() - start;
      return result;
    },
    
    /**
     * Log final performance metrics
     */
    logPerf: (statusCode: number) => {
      timings.total = performance.now() - startTime;
      
      if (PERF_ENABLED) {
        const log: PerfLog = {
          request_id: requestId,
          endpoint,
          method,
          status_code: statusCode,
          duration_ms: Math.round(timings.total),
          timings: {
            db_query: Math.round(timings.db_query),
            serialization: Math.round(timings.serialization),
            cache_lookup: Math.round(timings.cache_lookup),
            total: Math.round(timings.total)
          },
          timestamp: new Date().toISOString()
        };
        
        console.log(`[PERF] ${JSON.stringify(log)}`);
      }
      
      return timings;
    }
  };
}

/**
 * Add performance headers to response
 */
export function addPerfHeaders(headers: Headers, requestId: string, durationMs: number): Headers {
  headers.set('X-Request-Id', requestId);
  headers.set('X-Response-Time', `${Math.round(durationMs)}ms`);
  return headers;
}
