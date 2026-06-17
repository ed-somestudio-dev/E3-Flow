import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    let userEmail = "visitante@fluxopro.app.br";
    let userId = "Visitante (Não logado)";

    if (authHeader) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user && !userError && user.email) {
        userEmail = user.email;
        userId = user.id;
      }
    }

    const { subject, message, visitorEmail } = await req.json();

    if (visitorEmail) {
      userEmail = visitorEmail;
    }

    if (!subject || !message) {
      throw new Error("Subject and message are required");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // HTML Email template
    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Novo Chamado de Suporte</h2>
        <p><strong>Usuário:</strong> ${userEmail} (ID: ${userId})</p>
        <p><strong>Assunto:</strong> ${subject}</p>
        <hr />
        <p><strong>Mensagem:</strong></p>
        <p style="white-space: pre-wrap; background: #f4f4f5; padding: 15px; border-radius: 8px;">${message}</p>
      </div>
    `;

    // Usando o e-mail de contato do usuário na resposta (reply_to) e o domínio configurado no FROM
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "FluxoPro Suporte <contato@fluxopro.app.br>",
        to: ["suporte@fluxopro.app.br"],
        reply_to: userEmail,
        subject: `[Suporte] ${subject}`,
        html: htmlBody,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API Error:", data);
      throw new Error("Erro ao enviar e-mail via Resend");
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error sending support email:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
