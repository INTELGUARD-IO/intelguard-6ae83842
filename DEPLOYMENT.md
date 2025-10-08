# INTELGUARD Deployment Guide

## Prerequisites

1. **Vercel Account** with project connected
2. **Supabase Integration** configured
3. **Environment Variables** set:
   - `CRON_SECRET` - Your generated secret for CRON protection
   - `GOOGLE_SAFE_BROWSING_API_KEY` - Google Safe Browsing API key
   - `OTX_API_KEY` - AlienVault OTX API key
   - `ABUSEIPDB_API_KEY` - AbuseIPDB API key
   - All Supabase variables (auto-configured)

## Deployment Steps

### 1. Initialize Database

Run the SQL script in Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the content from `scripts/01-init-feed-sources.sql`
4. Execute the script
5. Verify: You should see ~70+ feed sources inserted

### 2. Create Superadmin User

After signing up your first user, promote them to superadmin:

\`\`\`sql
-- In Supabase SQL Editor
UPDATE profiles 
SET role = 'superadmin' 
WHERE email = 'your-email@example.com';
\`\`\`

### 3. Deploy to Vercel

\`\`\`bash
# Push to GitHub (if not already done)
git add .
git commit -m "Initial INTELGUARD deployment"
git push origin main

# Or deploy directly
vercel --prod
\`\`\`

### 4. Configure Vercel CRON Jobs

The CRON jobs are already configured in `vercel.json`:

- **Feed Fetcher**: Runs every 30 seconds
- **Deduplication**: Runs every 5 minutes
- **Validation**: Runs every minute

Vercel will automatically set these up on deployment.

### 5. Verify CRON Jobs

Check CRON job status:

1. Go to your deployed app: `https://your-app.vercel.app`
2. Login as superadmin
3. Navigate to **Dashboard > Feeds**
4. Check "Last Fetch" timestamps
5. Monitor the CRON status cards

### 6. Manual Testing

Test individual components:

**Test Feed Fetching:**
\`\`\`bash
curl -X POST https://your-app.vercel.app/api/admin/feeds/trigger \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
\`\`\`

**Test Validation:**
\`\`\`bash
curl -X POST https://your-app.vercel.app/api/cron/validate \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
\`\`\`

## System Architecture

### Data Flow

\`\`\`
Feed Sources (70+)
    ↓ (CRON: 30s)
Raw Indicators (raw_indicators table)
    ↓ (CRON: 5min)
Ingest Buffer (deduplication)
    ↓ (CRON: 1min)
Validation Engine (consensus voting)
    ↓
Dynamic Indicators (validated_indicators table)
    ↓
Dashboard (real-time display)
\`\`\`

### Validation Pipeline

1. **Priority Queue**: Indicators sorted by:
   - Seen in 3+ feeds (Priority 1)
   - New indicators < 24h (Priority 2)
   - Partial validations (Priority 3)
   - Old indicators > 7d (Priority 4)

2. **Rate Limiter**: Intelligent quota management
   - Tier 1: High quota validators (Google, OTX)
   - Tier 2: Medium quota (AbuseIPDB, URLScan)
   - Tier 3: Low quota (VirusTotal, HoneyDB)

3. **Consensus Engine**: Weighted voting
   - Tier 1 validators: 3 points
   - Tier 2 validators: 2 points
   - Tier 3 validators: 1 point
   - Threshold: 6 points = malicious

## Monitoring

### Dashboard Metrics

- **Total Raw Indicators**: All indicators from feeds
- **Validated Indicators**: Confirmed malicious
- **Active Feeds**: Currently fetching
- **Validation Rate**: Indicators/minute

### CRON Job Health

Monitor in Dashboard > Feeds:
- Last run timestamp
- Success/failure status
- Error messages

## Troubleshooting

### CRON Jobs Not Running

1. Check Vercel deployment logs
2. Verify `CRON_SECRET` is set correctly
3. Check Vercel CRON dashboard

### No Indicators Appearing

1. Check feed sources are active: `SELECT * FROM feed_sources WHERE is_active = true`
2. Manually trigger fetch: Use admin panel
3. Check CRON job logs

### Validation Not Working

1. Verify API keys are set correctly
2. Check rate limiter status: `SELECT * FROM validator_status`
3. Check quota usage: `SELECT * FROM abuseipdb_quota`

### Database Performance

If queries are slow:

\`\`\`sql
-- Add indexes (if not already present)
CREATE INDEX IF NOT EXISTS idx_raw_indicators_created 
  ON raw_indicators(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_buffer_value 
  ON ingest_buffer(value);

CREATE INDEX IF NOT EXISTS idx_validated_indicators_confidence 
  ON validated_indicators(confidence_score DESC);
\`\`\`

## Security Considerations

1. **Row Level Security (RLS)**: Enabled on all tables
2. **Multi-tenancy**: Customers see only their data
3. **API Protection**: All CRON endpoints require `CRON_SECRET`
4. **Rate Limiting**: Built-in quota management

## Scaling

### Current Limits

- **Feed Sources**: 70+ active feeds
- **Fetch Rate**: Every 30 seconds
- **Validation Rate**: 10 indicators/minute
- **API Calls**: ~500-1000/day per validator

### To Scale Up

1. **Increase validation rate**: Modify `BATCH_SIZE` in validation orchestrator
2. **Add more validators**: Implement additional validators in `lib/validators/`
3. **Optimize deduplication**: Use PostgreSQL UPSERT for better performance
4. **Add caching**: Implement Redis for frequently accessed data

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Review CRON job status in dashboard
4. Contact support at vercel.com/help
