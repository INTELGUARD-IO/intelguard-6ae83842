import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseQuery, supabaseRPC } from "../_shared/supabase-rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CF_RADAR_TOKEN = Deno.env.get("CF_RADAR_TOKEN")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const BATCH_SIZE = 1000;

interface CloudflareResponse {
  success: boolean;
  result?: any;
  errors?: any[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON secret or authentication
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("authorization");
    
    if (cronSecret !== CRON_SECRET && !authHeader) {
      console.error("❌ Unauthorized: Missing CRON secret or auth header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();
    console.log("🚀 Starting Cloudflare Radar Top 100K domains sync...");

    // Log audit start
    const auditLog = await supabaseQuery(
      SUPABASE_URL,
      SERVICE_KEY,
      "system_audit_logs",
      "POST",
      {
        operation_name: "cloudflare_radar_domains_sync",
        operation_type: "validator",
        status: "started",
        description: "Syncing Top 100K domains from Cloudflare Radar"
      }
    );
    const auditLogId = auditLog?.[0]?.id;

    // Clean expired domains
    console.log("🧹 Cleaning expired domains...");
    await supabaseRPC(SUPABASE_URL, SERVICE_KEY, "clean_expired_cf_radar_domains");

    // Download Top 100K domains from Cloudflare Radar
    console.log("📥 Downloading Top 100K domains from Cloudflare Radar...");
    const response = await fetch(
      `${CLOUDFLARE_API}/radar/datasets/ranking_top_100000`,
      {
        headers: {
          "Authorization": `Bearer ${CF_RADAR_TOKEN}`,
          "Accept": "text/plain",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API error (${response.status}): ${errorText}`);
    }

    const domainsText = await response.text();
    const domains = domainsText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"));

    console.log(`✅ Downloaded ${domains.length} domains`);

    // Batch insert domains
    let totalInserted = 0;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      const domainRecords = batch.map((domain, idx) => ({
        domain,
        rank: i + idx + 1,
        bucket: "top_100000",
        expires_at: expiresAt,
      }));

      try {
        await supabaseQuery(
          SUPABASE_URL,
          SERVICE_KEY,
          "cloudflare_radar_top_domains",
          "POST",
          domainRecords,
          "?on_conflict=domain"
        );
        totalInserted += batch.length;
        console.log(`📦 Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} domains (Total: ${totalInserted})`);
      } catch (error) {
        console.error(`❌ Error inserting batch at index ${i}:`, error);
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Sync completed: ${totalInserted} domains synced in ${executionTime}ms`);

    // Update audit log
    if (auditLogId) {
      await supabaseQuery(
        SUPABASE_URL,
        SERVICE_KEY,
        "system_audit_logs",
        "PATCH",
        {
          status: "completed",
          execution_time_ms: executionTime,
          metadata: {
            domains_synced: totalInserted,
            total_domains: domains.length,
          },
        },
        `?id=eq.${auditLogId}`
      );
    }

    // Send email notification
    try {
      console.log("📧 Sending email notification...");
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "IntelGuard <onboarding@resend.dev>",
          to: ["admin@example.com"], // Replace with actual admin email
          subject: "✅ Cloudflare Radar - Top 100K Domains Synced",
          html: `
            <h1>Cloudflare Radar Domain Sync Completed</h1>
            <p>The Top 100K domains whitelist has been successfully synced.</p>
            <h3>Summary:</h3>
            <ul>
              <li><strong>Domains Synced:</strong> ${totalInserted}</li>
              <li><strong>Total Domains:</strong> ${domains.length}</li>
              <li><strong>Execution Time:</strong> ${executionTime}ms</li>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
            <p>The whitelist will expire in 7 days and will be automatically refreshed.</p>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error("❌ Failed to send email:", await emailResponse.text());
      } else {
        console.log("✅ Email notification sent");
      }
    } catch (emailError) {
      console.error("❌ Error sending email:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        domains_synced: totalInserted,
        total_domains: domains.length,
        execution_time_ms: executionTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in cloudflare-radar-domains-sync:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});