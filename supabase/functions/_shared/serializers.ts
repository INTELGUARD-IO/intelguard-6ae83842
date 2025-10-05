// Optimized Serializers for Feed Responses
// Buffer preallocation and chunk-based serialization for performance

/**
 * Serialize indicators to plain text (one per line)
 * Optimized with buffer preallocation and chunking
 */
export function serializeToText(indicators: string[]): string {
  if (!indicators || indicators.length === 0) {
    return '\n';
  }

  // Estimate buffer size: avg 15 chars per indicator + newline
  const estimatedSize = indicators.length * 16;
  const chunks: string[] = [];
  let chunk = '';
  let chunkSize = 0;
  const maxChunkSize = 65536; // 64KB chunks

  for (let i = 0; i < indicators.length; i++) {
    const line = indicators[i] + '\n';
    chunk += line;
    chunkSize += line.length;

    // Flush chunk when it exceeds max size
    if (chunkSize >= maxChunkSize) {
      chunks.push(chunk);
      chunk = '';
      chunkSize = 0;
    }
  }

  // Push remaining chunk
  if (chunk) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

/**
 * Serialize to JSON (compact, no pretty-print)
 */
export function serializeToJSON<T>(data: T): string {
  return JSON.stringify(data, null, 0); // No whitespace
}

/**
 * Serialize to CSV format
 * Optimized for indicator data
 */
export function serializeToCSV(
  indicators: Array<{
    indicator: string;
    kind: string;
    confidence?: number;
    threat_type?: string;
    country?: string;
    asn?: string;
    last_validated?: string;
  }>
): string {
  if (!indicators || indicators.length === 0) {
    return 'indicator,kind,confidence,threat_type,country,asn,last_validated\n';
  }

  const chunks: string[] = [];
  
  // Header
  chunks.push('indicator,kind,confidence,threat_type,country,asn,last_validated\n');

  // Rows
  for (const ind of indicators) {
    chunks.push(
      `${ind.indicator},${ind.kind},${ind.confidence || ''},${ind.threat_type || ''},${ind.country || ''},${ind.asn || ''},${ind.last_validated || ''}\n`
    );
  }

  return chunks.join('');
}

/**
 * Estimate response size (for preallocation)
 */
export function estimateResponseSize(indicatorCount: number, format: string): number {
  switch (format) {
    case 'text':
      return indicatorCount * 20; // ~20 bytes per line
    case 'json':
      return indicatorCount * 100; // ~100 bytes per JSON object
    case 'csv':
      return indicatorCount * 80; // ~80 bytes per CSV row
    default:
      return indicatorCount * 50;
  }
}
