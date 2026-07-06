// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Preços calculados server-side — nunca confiar no valor enviado pelo cliente
const PLANS = {
  monthly: { name: 'Mensal', value: 7.90, cycle: 'MONTHLY' as const },
  yearly:  { name: 'Anual',  value: 59.90, cycle: 'YEARLY' as const },
} as const;

interface ReqPayload {
  planId?: 'monthly' | 'yearly';
  trialDays?: number;
  trialEndDate?: string;
  userName: string;
  userEmail: string;
  userCpfCnpj?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const payload: ReqPayload = await req.json();
    const {
      planId = 'monthly',
      trialDays = 14,
      trialEndDate,
      userName,
      userEmail,
      userCpfCnpj,
    } = payload;

    const planConfig = PLANS[planId] || PLANS.monthly;
    const { name: planName, value: price, cycle } = planConfig;

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      throw new Error("ASAAS_API_KEY is not set");
    }

    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com/api/v3";

    const resolvedTrialEndDate = trialEndDate
      || (() => {
        const d = new Date();
        d.setDate(d.getDate() + trialDays);
        return d.toISOString().split("T")[0];
      })();

    let { data: subRecord } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let asaasCustomerId = subRecord?.asaas_customer_id;

    if (!asaasCustomerId) {
      const customerRes = await fetch(`${asaasApiUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          name: userName || "Cliente E3 Flow",
          email: userEmail || user.email,
          cpfCnpj: userCpfCnpj || undefined,
        }),
      });

      const customerData = await customerRes.json();
      if (!customerRes.ok) {
        console.error("Erro Asaas Customer:", customerData);
        throw new Error(customerData.errors?.[0]?.description || "Erro ao criar cliente no Asaas");
      }
      asaasCustomerId = customerData.id;

      if (!subRecord) {
        const { data: newSub } = await supabase
          .from("subscriptions")
          .insert({
            user_id: user.id,
            asaas_customer_id: asaasCustomerId,
            subscription_status: "TRIAL",
            subscription_plan: planName,
            subscription_cycle: cycle,
            trial_end_date: resolvedTrialEndDate,
          })
          .select()
          .single();
        subRecord = newSub;
      } else {
        await supabase
          .from("subscriptions")
          .update({ asaas_customer_id: asaasCustomerId })
          .eq("id", subRecord.id);
      }
    }

    const subRes = await fetch(`${asaasApiUrl}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED",
        value: price,
        nextDueDate: resolvedTrialEndDate,
        cycle,
        description: `Assinatura E3 Flow - ${planName} (trial de ${trialDays} dias)`,
      }),
    });

    const subData = await subRes.json();
    if (!subRes.ok) {
      console.error("Erro Asaas Subscription:", subData);
      throw new Error(subData.errors?.[0]?.description || "Erro ao criar assinatura no Asaas");
    }

await supabase
      .from("subscriptions")
      .update({
        asaas_subscription_id: subData.id,
        subscription_plan: planName,
        subscription_cycle: cycle,
        subscription_status: "TRIAL",
        trial_end_date: resolvedTrialEndDate,
        subscription_due_date: resolvedTrialEndDate,
      })
      .eq("user_id", user.id);

    // Buscar a primeira cobrança gerada para a assinatura para obter a invoiceUrl real do Asaas
    let checkoutUrl = "";
    try {
      const paymentsRes = await fetch(`${asaasApiUrl}/subscriptions/${subData.id}/payments?limit=1`, {
        method: "GET",
        headers: {
          "access_token": ASAAS_API_KEY,
        },
      });

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        const firstPayment = paymentsData.data?.[0];
        if (firstPayment?.invoiceUrl) {
          checkoutUrl = firstPayment.invoiceUrl;
          console.log("Invoice URL obtida com sucesso:", checkoutUrl);
        } else {
          console.warn("Nenhuma cobrança encontrada para a assinatura:", subData.id);
        }
      } else {
        const errText = await paymentsRes.text();
        console.error("Erro ao buscar cobranças do Asaas:", errText);
      }
    } catch (err) {
      console.error("Erro ao fazer requisição de cobranças:", err);
    }

    // Fallback caso a busca de cobranças falhe ou não tenha gerado a fatura a tempo
    if (!checkoutUrl) {
      const isSandbox = asaasApiUrl.includes('sandbox');
      checkoutUrl = isSandbox
        ? `https://sandbox.asaas.com/checkout/${subData.id}`
        : `https://www.asaas.com/checkout/${subData.id}`;
      console.log("Usando URL de fallback para checkout:", checkoutUrl);
    }

    return new Response(JSON.stringify({
      invoiceUrl: checkoutUrl,
      subscriptionId: subData.id,
      trialEndDate: resolvedTrialEndDate,
      cycle,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in asaas-checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
