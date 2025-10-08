# IntelGuard - Technical Documentation

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Authentication & Authorization](#authentication--authorization)
4. [Edge Functions Reference](#edge-functions-reference)
5. [Validation Pipeline](#validation-pipeline)
6. [API Integration Patterns](#api-integration-patterns)
7. [Performance & Optimization](#performance--optimization)
8. [Development Guidelines](#development-guidelines)

---

## 🏛️ Architecture Overview

### High-Level Architecture

\`\`\`mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React UI + TailwindCSS]
        Router[React Router]
        Query[TanStack Query]
    end
    
    subgraph "API Gateway"
        Feed[Feed API]
        Auth[Auth API]
        Ingest[Ingest API]
    end
    
    subgraph "Processing Layer"
        Cron[Cron Scheduler]
        Validators[10+ Validators]
        Enrichers[6+ Enrichers]
        Intel[Intelligent Validator]
    end
    
    subgraph "Data Layer"
        Raw[(Raw Indicators<br/>65K records)]
        Dynamic[(Dynamic Raw<br/>Validation State)]
        Validated[(Validated Indicators<br/>Production Feed)]
        Cache[(Cache Tables)]
    end
    
    subgraph "External APIs"
        TI[Threat Intelligence<br/>AbuseIPDB, VT, OTX]
        GEO[Enrichment<br/>BGPView, RIPEstat]
        DOMAIN[Domain Validators<br/>URLScan, SafeBrowsing]
    end
    
    UI --> Router
    Router --> Query
    Query --> Feed
    Query --> Auth
    Query --> Ingest
    
    Feed --> Validated
    Ingest --> Raw
    
    Cron --> Validators
    Cron --> Enrichers
    
    Validators --> Dynamic
    Validators --> TI
    Validators --> DOMAIN
    
    Enrichers --> Dynamic
    Enrichers --> GEO
    
    Intel --> Dynamic
    Intel --> Validated
    
    Dynamic --> Cache
\`\`\`

### Data Flow - Indicator Processing

\`\`\`mermaid
sequenceDiagram
    participant Source as Ingest Source
    participant Raw as raw_indicators
    participant Backfill as Backfill Process
    participant Dynamic as dynamic_raw_indicators
    participant Validators as Validator Pool
    participant Intel as Intelligent Validator
    participant Valid as validated_indicators
    participant Cache as Cache Layer
    participant Feed as Feed API
    
    Source->>Raw: Fetch indicators
    Note over Raw: 65,742 records
    
    Backfill->>Raw: Aggregate by indicator+kind
    Backfill->>Dynamic: Insert with sources array
    Note over Dynamic: source_count, confidence
    
    loop Every 1-5 minutes
        Validators->>Dynamic: Fetch unvalidated
        Validators->>Validators: Check external APIs
        Validators->>Dynamic: Update validator fields
        Note over Dynamic: abuse_ch_checked, otx_checked, etc.
    end
    
    Intel->>Dynamic: Fetch validated candidates
    Intel->>Intel: Calculate advanced score
    Intel->>Intel: Consensus voting
    Intel->>Valid: Promote if score >= threshold
    
    Valid->>Cache: Hourly snapshot
    Feed->>Cache: Serve from cache
    Feed-->>Client: Return indicators
\`\`\`

---

## 🗄️ Database Schema

### Core Tables

#### `raw_indicators` (65,742 records)
Primary ingestion table for all sources.

\`\`\`sql
CREATE TABLE raw_indicators (
  id BIGSERIAL PRIMARY KEY,
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ipv4', 'domain')),
  source TEXT NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE INDEX idx_raw_indicators_active 
ON raw_indicators(indicator, kind) 
WHERE removed_at IS NULL;
\`\`\`

**RLS Policy:**
- Super admin: Full access
- Tenant members: Read-only

#### `dynamic_raw_indicators` (1,949 records)
Aggregated indicators with validation state.

\`\`\`sql
CREATE TABLE dynamic_raw_indicators (
  id BIGSERIAL PRIMARY KEY,
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  sources TEXT[] NOT NULL,
  source_count INTEGER DEFAULT 1,
  
  -- Validator flags (10+ validators)
  abuse_ch_checked BOOLEAN DEFAULT FALSE,
  abuse_ch_is_fp BOOLEAN,
  abuseipdb_checked BOOLEAN DEFAULT FALSE,
  abuseipdb_score INTEGER,
  abuseipdb_in_blacklist BOOLEAN,
  safebrowsing_checked BOOLEAN DEFAULT FALSE,
  safebrowsing_score INTEGER,
  safebrowsing_verdict TEXT,
  otx_checked BOOLEAN DEFAULT FALSE,
  otx_score INTEGER,
  otx_verdict TEXT,
  virustotal_checked BOOLEAN DEFAULT FALSE,
  virustotal_score INTEGER,
  virustotal_malicious BOOLEAN,
  urlscan_checked BOOLEAN DEFAULT FALSE,
  urlscan_score INTEGER,
  urlscan_malicious BOOLEAN,
  honeydb_checked BOOLEAN DEFAULT FALSE,
  honeydb_in_blacklist BOOLEAN,
  honeydb_threat_score INTEGER,
  neutrinoapi_checked BOOLEAN DEFAULT FALSE,
  neutrinoapi_in_blocklist BOOLEAN,
  neutrinoapi_host_reputation_score INTEGER,
  neutrinoapi_is_proxy BOOLEAN,
  neutrinoapi_is_vpn BOOLEAN,
  neutrinoapi_is_hosting BOOLEAN,
  censys_checked BOOLEAN DEFAULT FALSE,
  censys_score INTEGER,
  censys_malicious BOOLEAN,
  cloudflare_urlscan_checked BOOLEAN DEFAULT FALSE,
  cloudflare_urlscan_score INTEGER,
  cloudflare_urlscan_malicious BOOLEAN,
  cloudflare_urlscan_categories TEXT[],
  cloudflare_urlscan_verdict TEXT,
  
  -- Whitelist
  whitelisted BOOLEAN DEFAULT FALSE,
  whitelist_source TEXT,
  
  first_validated TIMESTAMPTZ DEFAULT NOW(),
  last_validated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(indicator, kind)
);
\`\`\`

#### `validated_indicators` (45 records → target: 10K+)
Production-ready threat feed.

\`\`\`sql
CREATE TABLE validated_indicators (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  threat_type TEXT,  -- phishing, malware, botnet, etc.
  country TEXT,
  asn TEXT,
  last_validated TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (indicator, kind)
);
\`\`\`

### Multi-Tenancy Schema

#### `tenants`
\`\`\`sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('mssp', 'enterprise', 'research')),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### `tenant_members`
\`\`\`sql
CREATE TABLE tenant_members (
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);
\`\`\`

#### `customers`
\`\`\`sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### `feed_tokens`
\`\`\`sql
CREATE TABLE feed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  type TEXT NOT NULL CHECK (type IN ('ipv4', 'domain')),
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID REFERENCES customers(id),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### Enrichment Tables

#### `bgpview_enrichment`
\`\`\`sql
CREATE TABLE bgpview_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator TEXT NOT NULL,
  kind TEXT DEFAULT 'ipv4',
  asn BIGINT,
  asn_name TEXT,
  asn_description TEXT,
  country_code TEXT,
  prefix TEXT,
  cidr INTEGER,
  ptr_record TEXT,
  raw_response JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE(indicator, kind)
);
\`\`\`

#### `otx_enrichment`
\`\`\`sql
CREATE TABLE otx_enrichment (
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  pulses_count INTEGER DEFAULT 0,
  authors_count INTEGER DEFAULT 0,
  score INTEGER,
  verdict TEXT,  -- malicious, suspicious, clean
  country TEXT,
  asn TEXT,
  tags TEXT[],
  reasons TEXT[],
  latest_pulse TIMESTAMPTZ,
  pulse_info JSONB,
  passive_dns JSONB,
  malware_samples JSONB,
  url_list JSONB,
  raw_otx JSONB,
  refreshed_at TIMESTAMPTZ DEFAULT NOW(),
  ttl_seconds INTEGER DEFAULT 86400,
  PRIMARY KEY (indicator, kind)
);
\`\`\`

### Cache Tables

#### `validated_indicators_cache`
\`\`\`sql
CREATE TABLE validated_indicators_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator TEXT NOT NULL,
  kind TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  threat_type TEXT,
  country TEXT,
  asn TEXT,
  last_validated TIMESTAMPTZ NOT NULL,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  snapshot_hour INTEGER DEFAULT EXTRACT(HOUR FROM NOW()),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cache_snapshot 
ON validated_indicators_cache(snapshot_hour, kind);
\`\`\`

**Purpose:** Serve feed API senza query pesanti su `validated_indicators`

### Quota Tracking Tables

#### `abuseipdb_quota`
\`\`\`sql
CREATE TABLE abuseipdb_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  daily_limit INTEGER DEFAULT 1000,
  used_count INTEGER DEFAULT 0,
  remaining_count INTEGER GENERATED ALWAYS AS (daily_limit - used_count) STORED,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

#### `censys_monthly_usage`
\`\`\`sql
CREATE TABLE censys_monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,  -- First day of month
  api_calls_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

---

## 🔐 Authentication & Authorization

### User Roles System

**Role Hierarchy:**
1. **Super Admin** (`is_super_admin()`)
   - User ID: `6a251925-6da6-4e88-a4c2-a5624308fe8e`
   - Full database access
   - Manage tenants, sources, validators

2. **Tenant Admin** (`tenant_members.role = 'admin'`)
   - Manage tenant users
   - Create/manage customers
   - Generate feed tokens

3. **Analyst** (`tenant_members.role = 'analyst'`)
   - View indicators
   - Manual ingest
   - View logs

4. **Viewer** (`tenant_members.role = 'viewer'`)
   - Read-only access
   - Download feeds

### RLS Policy Patterns

**Super Admin Full Access:**
\`\`\`sql
CREATE POLICY "super_admin_full_access"
ON table_name FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
\`\`\`

**Tenant Member Access:**
\`\`\`sql
CREATE POLICY "tenant_members_view"
ON table_name FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = table_name.tenant_id
    AND user_id = auth.uid()
  )
);
\`\`\`

**Token-Based Feed Access (Bypass RLS):**
\`\`\`sql
-- Edge function usa service_role_key
-- Valida token in feed_tokens table
-- Nessuna RLS policy su feed API
\`\`\`

### Authentication Flow

\`\`\`mermaid
sequenceDiagram
    participant User
    participant UI
    participant Supabase Auth
    participant Database
    participant Edge Function
    
    User->>UI: Access /auth
    UI->>UI: Show login/signup form
    User->>UI: Submit credentials
    UI->>Supabase Auth: signUp() / signIn()
    Supabase Auth->>Supabase Auth: Auto-confirm (enabled)
    Supabase Auth->>Database: Create auth.users record
    
    alt First User
        Database->>Database: Trigger creates super admin
    else Subsequent Users
        Database->>Database: Default viewer role
    end
    
    Supabase Auth-->>UI: JWT token
    UI->>UI: Store in localStorage
    UI->>Database: Fetch user profile
    Database-->>UI: User + tenant + role
    UI->>UI: Redirect to /dashboard
    
    loop Authenticated Requests
        UI->>Edge Function: Request + JWT in header
        Edge Function->>Supabase Auth: Verify JWT
        Supabase Auth-->>Edge Function: User ID
        Edge Function->>Database: Query with RLS
        Database-->>Edge Function: Filtered data
        Edge Function-->>UI: Response
    end
\`\`\`

---

## ⚡ Edge Functions Reference

### Ingest Functions

#### `ingest`
**Purpose:** Fetch indicators from configured sources
**Schedule:** Every 6 hours via cron
**Quota Impact:** None (pulls from public sources)

\`\`\`typescript
// supabase/functions/ingest/index.ts
interface IngestResult {
  source_id: string;
  fetched: number;
  inserted: number;
  duplicates: number;
  errors: string[];
}
\`\`\`

#### `manual-ingest`
**Purpose:** Admin manual upload
**Auth:** Requires super admin JWT
**Payload:**
\`\`\`json
{
  "indicators": [
    {"indicator": "1.2.3.4", "kind": "ipv4", "source": "manual"}
  ]
}
\`\`\`

### Validation Functions (10+ Validators)

#### `abuse-ch-validator`
**API:** https://urlhaus-api.abuse.ch/v1/
**Quota:** Unlimited
**Logic:** Check false positive list

\`\`\`typescript
// Checks abuse_ch_fplist table
// Sets: abuse_ch_checked, abuse_ch_is_fp
\`\`\`

#### `abuseipdb-validator`
**API:** https://api.abuseipdb.com/api/v2/blacklist
**Quota:** 1000 calls/day
**Logic:** Check IP against blacklist (confidence >= 70)

\`\`\`typescript
// 1. Check daily quota
// 2. Fetch blacklist (1 API call)
// 3. Match local indicators
// Sets: abuseipdb_checked, abuseipdb_score, abuseipdb_in_blacklist
\`\`\`

#### `google-safebrowsing-validator`
**API:** https://safebrowsing.googleapis.com/v4/threatMatches:find
**Quota:** 10,000 calls/day
**Logic:** Batch check URLs (500 at a time)

\`\`\`typescript
// Threat types: MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE
// Sets: safebrowsing_checked, safebrowsing_score, safebrowsing_verdict
\`\`\`

#### `virustotal-validator`
**API:** https://www.virustotal.com/api/v3/
**Quota:** 500 calls/day (4 req/min)
**Logic:** Check domain/IP reputation

\`\`\`typescript
// Rate limit: 15 second delay between requests
// Sets: virustotal_checked, virustotal_score, virustotal_malicious
\`\`\`

#### `otx-validator`
**API:** https://otx.alienvault.com/api/v1/
**Quota:** Unlimited
**Logic:** Check pulses, reputation

\`\`\`typescript
// Sets: otx_checked, otx_score, otx_verdict
// Stores full data in otx_enrichment table
\`\`\`

#### `urlscan-validator`
**API:** https://urlscan.io/api/v1/
**Quota:** 1000 scans/day
**Logic:** Submit scan → poll results

\`\`\`typescript
// 1. Submit scan (POST /scan/)
// 2. Wait 30 seconds
// 3. Fetch results (GET /result/{uuid}/)
// Sets: urlscan_checked, urlscan_score, urlscan_malicious
\`\`\`

#### `cloudflare-urlscan-validator`
**API:** Cloudflare URL Scanner
**Quota:** 1000 scans/day
**Logic:** Submit scan via Cloudflare API

\`\`\`typescript
// Sets: cloudflare_urlscan_checked, cloudflare_urlscan_score,
//       cloudflare_urlscan_malicious, cloudflare_urlscan_categories
\`\`\`

#### `honeydb-validator`
**API:** https://honeydb.io/api/
**Quota:** Unlimited
**Logic:** Check against honeypot logs

\`\`\`typescript
// Sets: honeydb_checked, honeydb_in_blacklist, honeydb_threat_score
\`\`\`

#### `neutrinoapi-validator`
**API:** https://www.neutrinoapi.com/
**Quota:** 5000 calls/day
**Logic:** IP blocklist + host reputation

\`\`\`typescript
// Sets: neutrinoapi_checked, neutrinoapi_in_blocklist,
//       neutrinoapi_host_reputation_score, neutrinoapi_is_proxy,
//       neutrinoapi_is_vpn, neutrinoapi_is_hosting
\`\`\`

#### `censys-validator`
**API:** https://search.censys.io/api
**Quota:** 100 calls/month
**Logic:** Check certificate transparency logs

\`\`\`typescript
// Ultra-conservative usage
// Sets: censys_checked, censys_score, censys_malicious
\`\`\`

### Enrichment Functions

#### `bgpview-enrich`
**API:** https://api.bgpview.io/
**Purpose:** ASN, BGP prefix, PTR records

#### `cloudflare-radar-enrich`
**API:** Cloudflare Radar API
**Purpose:** IP geolocation, ASN info

#### `ripestat-enrich`
**API:** https://stat.ripestat.net/
**Purpose:** Whois, abuse contacts, geolocation

#### `abuseipdb-enrich`
**API:** https://api.abuseipdb.com/api/v2/check
**Purpose:** Detailed IP report (separate from validator)

### Intelligent Validation

#### `intelligent-validator`
**Schedule:** Every 5 minutes
**Purpose:** Consensus-based promotion to `validated_indicators`

**Algorithm:**
\`\`\`typescript
function calculateAdvancedScore(indicator, votes) {
  let score = 50; // Base score
  
  // Count positive votes
  const positiveVotes = votes.filter(v => v.is_malicious).length;
  const totalVotes = votes.length;
  
  score += (positiveVotes / totalVotes) * 30;
  
  // High-confidence validators boost
  if (indicator.abuseipdb_in_blacklist && indicator.abuseipdb_score > 80) {
    score += 15;
  }
  
  // Suspicious TLD penalty (for domains)
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top'];
  if (indicator.kind === 'domain' && suspiciousTLDs.some(tld => indicator.indicator.endsWith(tld))) {
    score += 10;
  }
  
  // Whitelist override
  if (indicator.whitelisted) {
    return 0; // Do not promote
  }
  
  // Multiple sources boost
  if (indicator.source_count >= 3) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

// Promotion logic
if (score >= 75 || (score >= 65 && indicator.confidence >= 85)) {
  await promoteToValidated(indicator);
}
\`\`\`

### Utility Functions

#### `backfill-indicators`
Migrates `raw_indicators` → `dynamic_raw_indicators`

#### `snapshot-cache`
Populates `validated_indicators_cache` for fast feed serving

#### `daily-delta`
Calculates daily added/removed indicator counts

#### `source-health-check`
Monitors ingest source availability

---

## 🔄 Validation Pipeline

### Pipeline Stages

\`\`\`mermaid
graph LR
    A[Raw Indicators] --> B[Backfill Process]
    B --> C[Dynamic Raw Indicators]
    C --> D{Validators Pool}
    
    D --> E[Abuse.ch Check]
    D --> F[AbuseIPDB Check]
    D --> G[Google SafeBrowsing]
    D --> H[VirusTotal]
    D --> I[OTX AlienVault]
    D --> J[URLScan]
    D --> K[HoneyDB]
    D --> L[NeutrinoAPI]
    D --> M[Censys]
    D --> N[Cloudflare Scanner]
    
    E --> O[Update Validator Fields]
    F --> O
    G --> O
    H --> O
    I --> O
    J --> O
    K --> O
    L --> O
    M --> O
    N --> O
    
    O --> P[Intelligent Validator]
    P --> Q{Score >= Threshold?}
    Q -->|Yes| R[Validated Indicators]
    Q -->|No| C
    
    R --> S[Cache Snapshot]
    S --> T[Feed API]
\`\`\`

### Cron Schedule

\`\`\`sql
-- Backfill domains (priority)
*/1 * * * *  -- Every 1 minute, 5000 domains/batch

-- Backfill IPv4
*/3 * * * *  -- Every 3 minutes, 2000 IPv4s/batch

-- Validators (run every 5-15 minutes)
*/5 * * * *  -- OTX, HoneyDB, Abuse.ch
*/10 * * * * -- Google SafeBrowsing, URLScan
*/15 * * * * -- VirusTotal, AbuseIPDB, NeutrinoAPI
*/30 * * * * -- Censys (low quota)

-- Intelligent validator
*/5 * * * *  -- Promote validated indicators

-- Enrichment
*/15 * * * * -- BGPView, Cloudflare Radar, RIPEstat

-- Ingest
0 */6 * * *  -- Fetch from sources every 6 hours

-- Maintenance
0 2 * * *    -- Daily delta calculation
0 3 * * *    -- Cache snapshot
0 4 * * *    -- Cleanup expired cache entries
\`\`\`

---

## 🚀 Performance & Optimization

### Database Indexes

\`\`\`sql
-- Critical indexes for feed API
CREATE INDEX idx_validated_indicators_kind ON validated_indicators(kind);
CREATE INDEX idx_validated_indicators_confidence ON validated_indicators(confidence DESC);
CREATE INDEX idx_validated_cache_kind_snapshot ON validated_indicators_cache(kind, snapshot_hour);

-- Optimization for backfill
CREATE INDEX idx_raw_indicators_active ON raw_indicators(indicator, kind) WHERE removed_at IS NULL;
CREATE INDEX idx_dynamic_sources_confidence ON dynamic_raw_indicators(source_count DESC, confidence DESC) WHERE whitelisted = false;

-- Validator queries
CREATE INDEX idx_dynamic_validated ON dynamic_raw_indicators(last_validated DESC) WHERE confidence >= 50 AND whitelisted = false;
\`\`\`

### Materialized Views

\`\`\`sql
-- Pre-aggregated validator stats
CREATE MATERIALIZED VIEW validator_stats_mv AS
SELECT 
  'otx' as validator_name,
  COUNT(*) FILTER (WHERE otx_checked = true) as checked_count,
  COUNT(*) FILTER (WHERE otx_score > 50) as positive_count,
  AVG(otx_score) FILTER (WHERE otx_checked = true) as avg_score
FROM dynamic_raw_indicators
UNION ALL
-- ... other validators

-- Refresh every 15 minutes via cron
REFRESH MATERIALIZED VIEW CONCURRENTLY validator_stats_mv;
\`\`\`

### Caching Strategy

**Level 1: Database Cache**
- `validated_indicators_cache` table
- Refreshed every hour
- Serves 99% of feed API requests

**Level 2: Edge Function Memory**
\`\`\`typescript
const feedCache = new Map<string, CachedFeed>();

function getCachedFeed(type: string, ttl: number = 300000) {
  const cached = feedCache.get(type);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
}
\`\`\`

**Level 3: CDN (Lovable Platform)**
- `Cache-Control: public, max-age=300` header
- 5-minute cache at edge locations

### Query Optimization

**Before (slow):**
\`\`\`sql
SELECT * FROM validated_indicators 
WHERE kind = 'ipv4' AND confidence >= 70
ORDER BY last_validated DESC;
-- 2.5s query time
\`\`\`

**After (fast):**
\`\`\`sql
SELECT * FROM validated_indicators_cache
WHERE kind = 'ipv4' AND snapshot_hour = EXTRACT(HOUR FROM NOW());
-- 50ms query time
\`\`\`

---

## 👨‍💻 Development Guidelines

### Code Style

\`\`\`typescript
// Use TypeScript strict mode
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// Prefer functional components
export const Component = ({ prop }: Props) => {
  const [state, setState] = useState<Type>(initial);
  return <div>{state}</div>;
};

// Use custom hooks for logic reuse
const useIndicators = (kind: 'ipv4' | 'domain') => {
  return useQuery({
    queryKey: ['indicators', kind],
    queryFn: () => fetchIndicators(kind)
  });
};
\`\`\`

### Testing Strategy

\`\`\`typescript
// Unit tests (Vitest)
describe('calculateAdvancedScore', () => {
  it('should return 0 for whitelisted indicators', () => {
    const indicator = { whitelisted: true };
    expect(calculateAdvancedScore(indicator, [])).toBe(0);
  });
});

// Integration tests (Playwright)
test('feed API returns valid JSON', async ({ page }) => {
  const response = await page.goto('/functions/v1/feed?type=ipv4');
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data).toHaveProperty('indicators');
});
\`\`\`

### Commit Convention

\`\`\`bash
feat: Add Censys validator integration
fix: Resolve rate limit error in VirusTotal validator
perf: Optimize feed API query with cache table
docs: Update API reference for feed endpoints
refactor: Extract validator logic into shared utility
\`\`\`

### Branch Strategy

\`\`\`
main (protected)
  ├── develop
  │   ├── feature/add-ipv6-support
  │   ├── feature/graphql-api
  │   └── bugfix/fix-cache-invalidation
  └── hotfix/critical-security-patch
\`\`\`

---

## 🔗 External Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Query**: https://tanstack.com/query/latest
- **shadcn/ui**: https://ui.shadcn.com/
- **TailwindCSS**: https://tailwindcss.com/docs

---

**Last Updated**: 2025-10-05
