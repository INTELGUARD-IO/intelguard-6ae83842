import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseQuery } from "../_shared/supabase-rest.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const BATCH_SIZE = 1000;

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
    console.log("🚀 Starting Cloudflare Radar domain validation...");

    // Log audit start
    const auditLog = await supabaseQuery(
      SUPABASE_URL,
      SERVICE_KEY,
      "system_audit_logs",
      "POST",
      {
        operation_name: "cloudflare_radar_domain_validation",
        operation_type: "validator",
        status: "started",
        description: "Validating domains against Cloudflare Radar Top 100K whitelist"
      }
    );
    const auditLogId = auditLog?.[0]?.id;

    // Get domains to validate from dynamic_raw_indicators
    console.log("📥 Fetching domains to validate...");
    const indicators = await supabaseQuery(
      SUPABASE_URL,
      SERVICE_KEY,
      "dynamic_raw_indicators",
      "GET",
      undefined,
      "?kind=eq.domain&select=id,indicator,confidence&limit=10000"
    );

    if (!indicators || indicators.length === 0) {
      console.log("ℹ️ No domains to validate");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No domains to validate",
          processed: 0,
          whitelisted: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Found ${indicators.length} domains to validate`);

    // Get whitelist domains
    console.log("📥 Fetching Cloudflare Radar Top 100K whitelist...");
    const whitelistDomains = await supabaseQuery(
      SUPABASE_URL,
      SERVICE_KEY,
      "cloudflare_radar_top_domains",
      "GET",
      undefined,
      "?select=domain&expires_at=gt." + new Date().toISOString()
    );

    if (!whitelistDomains || whitelistDomains.length === 0) {
      console.log("⚠️ No whitelist domains found. Run sync first.");
      return new Response(
        JSON.stringify({
          error: "No whitelist domains found. Run sync first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Loaded ${whitelistDomains.length} whitelist domains`);

    // Create whitelist set for fast lookup
    const whitelistSet = new Set(whitelistDomains.map((d: any) => d.domain));

    // Process indicators in batches
    let whitelistedCount = 0;
    let processedCount = 0;

    for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
      const batch = indicators.slice(i, i + BATCH_SIZE);
      
      for (const indicator of batch) {
        processedCount++;
        
        // Check if domain is in whitelist
        if (whitelistSet.has(indicator.indicator)) {
          // Update confidence to 0 (whitelist = not malicious)
          try {
            await supabaseQuery(
              SUPABASE_URL,
              SERVICE_KEY,
              "dynamic_raw_indicators",
              "PATCH",
              { confidence: 0 },
              `?id=eq.${indicator.id}`
            );
            whitelistedCount++;
            console.log(`✅ Whitelisted: ${indicator.indicator} (was confidence: ${indicator.confidence})`);
          } catch (error) {
            console.error(`❌ Error updating ${indicator.indicator}:`, error);
          }
        }
      }

      console.log(`📦 Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} domains (Total: ${processedCount}, Whitelisted: ${whitelistedCount})`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ Validation completed: ${processedCount} processed, ${whitelistedCount} whitelisted in ${executionTime}ms`);

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
            processed: processedCount,
            whitelisted: whitelistedCount,
            whitelist_size: whitelistDomains.length,
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
          subject: "✅ Cloudflare Radar - Domain Validation Completed",
          html: `
            <h1>Domain Validation Completed</h1>
            <p>Domains have been validated against the Cloudflare Radar Top 100K whitelist.</p>
            <h3>Summary:</h3>
            <ul>
              <li><strong>Domains Processed:</strong> ${processedCount}</li>
              <li><strong>Domains Whitelisted:</strong> ${whitelistedCount}</li>
              <li><strong>Whitelist Size:</strong> ${whitelistDomains.length}</li>
              <li><strong>Execution Time:</strong> ${executionTime}ms</li>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
            </ul>
            <p>Whitelisted domains have had their confidence score set to 0 (not malicious).</p>
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
        processed: processedCount,
        whitelisted: whitelistedCount,
        whitelist_size: whitelistDomains.length,
        execution_time_ms: executionTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in cloudflare-radar-domain-validator:", error);
    
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