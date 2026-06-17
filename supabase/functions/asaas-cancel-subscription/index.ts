import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) throw new Error("Unauthorized");

    const { data: subRecord, error: dbError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (dbError || !subRecord) {
      throw new Error("Assinatura não encontrada");
    }

    if (subRecord.asaas_subscription_id) {
      const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
      if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY is not set");
      const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com/api/v3";

      const subRes = await fetch(`${asaasApiUrl}/subscriptions/${subRecord.asaas_subscription_id}`, {
        method: "DELETE",
        headers: {
          "access_token": ASAAS_API_KEY,
        },
      });

      const subData = await subRes.json();
      if (!subRes.ok) {
        console.error("Erro ao cancelar Asaas Subscription:", subData);
        throw new Error(subData.errors?.[0]?.description || "Erro ao cancelar assinatura no Asaas");
      }
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        subscription_status: "CANCELLED",
      })
      .eq("id", subRecord.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in asaas-cancel-subscription:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
