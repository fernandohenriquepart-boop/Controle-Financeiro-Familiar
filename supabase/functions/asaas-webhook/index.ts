// Edge Function: recebe os webhooks da Asaas (pagamento confirmado, atrasado
// etc.) e atualiza households.plan_status. Chamada pela própria Asaas, não
// pelo app — por isso NÃO usa o JWT do Supabase pra autenticar, e sim um
// token compartilhado configurado no painel da Asaas.
//
// Deploy: supabase functions deploy asaas-webhook --no-verify-jwt
// Secret: ASAAS_WEBHOOK_TOKEN — defina o mesmo valor em
// Asaas → Integrações → Webhooks → "Token de autenticação".
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

// Eventos da Asaas: https://docs.asaas.com/docs/webhook-eventos
const STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_CONFIRMED: "active",
  PAYMENT_RECEIVED: "active",
  PAYMENT_OVERDUE: "past_due",
  PAYMENT_DELETED: "canceled",
  PAYMENT_REFUNDED: "canceled",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");
    if (expectedToken && receivedToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Token inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const event = body?.event;
    const subscriptionId = body?.payment?.subscription;
    const newStatus = STATUS_BY_EVENT[event];

    // Evento que a gente não trata (ex: PAYMENT_CREATED) — responde 200 mesmo
    // assim, senão a Asaas fica reenviando.
    if (!newStatus || !subscriptionId) {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await admin
      .from("households")
      .update({ plan_status: newStatus })
      .eq("asaas_subscription_id", subscriptionId);
    if (error) throw error;

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("asaas-webhook error:", error);
    return new Response(JSON.stringify({ error: String((error as Error)?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
