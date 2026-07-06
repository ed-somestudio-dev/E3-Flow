import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLANS = {
  monthly: { name: 'Mensal', value: 7.90, cycle: 'MONTHLY' as const },
  yearly:  { name: 'Anual',  value: 59.90, cycle: 'YEARLY' as const },
} as const;

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

    const payload = await req.json();
    const { planId } = payload;
    
    if (!planId || !PLANS[planId as keyof typeof PLANS]) {
      throw new Error("Plano inválido");
    }

    const planConfig = PLANS[planId as keyof typeof PLANS];
    const { name: planName, value: price, cycle } = planConfig;

    const { data: subRecords, error: dbError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const subRecord = subRecords?.[0];

    if (dbError || !subRecord) {
      throw new Error("Assinatura não encontrada");
    }

    // Se tem asaas_subscription_id, atualiza no Asaas
    if (subRecord.asaas_subscription_id) {
      const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
      if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY is not set");
      const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com/api/v3";

      // Usando POST conforme doc legado / comum do Asaas (ou PUT dependendo da versão)
      const subRes = await fetch(`${asaasApiUrl}/subscriptions/${subRecord.asaas_subscription_id}`, {
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          value: price,
          cycle: cycle,
          description: `Assinatura E3 Flow - ${planName} (${cycle})`,
          updatePendingPayments: true
        }),
      });

      const subData = await subRes.json();
      if (!subRes.ok) {
        console.error("Erro ao atualizar Asaas Subscription:", subData);
        throw new Error(subData.errors?.[0]?.description || "Erro ao atualizar assinatura no Asaas");
      }
    }

    // Atualiza o banco de dados
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        subscription_plan: planName,
        subscription_cycle: cycle,
      })
      .eq("id", subRecord.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, plan: planName, cycle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in asaas-update-subscription:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
