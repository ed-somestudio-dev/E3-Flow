import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    
    // Check webhook token if configured (Asaas sends it in a header, usually "asaas-access-token" or in the payload depending on webhook config)
    const asaasToken = req.headers.get("asaas-access-token");
    if (ASAAS_WEBHOOK_TOKEN && asaasToken !== ASAAS_WEBHOOK_TOKEN) {
      console.warn("Invalid webhook token");
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const event = payload.event;
    const payment = payload.payment;
    
    if (!payment || !payment.subscription) {
      console.log("Not a subscription payment event, ignoring");
      return new Response("OK", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const subscriptionId = payment.subscription;

    let newStatus = null;
    let dueDate = payment.dueDate; // Use payment due date as a reference or next due date?
    // In Asaas, payment events usually tell us about a specific charge.
    
    // Mapeamento de status
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      newStatus = "RECEIVED";
    } else if (event === "PAYMENT_OVERDUE") {
      newStatus = "OVERDUE";
    } else if (event === "PAYMENT_DELETED") {
      newStatus = "CANCELLED";
    } else if (event === "PAYMENT_REFUNDED") {
      newStatus = "INACTIVE";
    }

    if (newStatus) {
      // Update subscription status
      const { error } = await supabase
        .from("subscriptions")
        .update({
          subscription_status: newStatus,
          subscription_due_date: dueDate,
        })
        .eq("asaas_subscription_id", subscriptionId);

      if (error) {
        console.error("Error updating subscription:", error);
        throw error;
      }
      console.log(`Updated subscription ${subscriptionId} to ${newStatus}`);
    } else {
      console.log(`Event ${event} ignored for subscription ${subscriptionId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
