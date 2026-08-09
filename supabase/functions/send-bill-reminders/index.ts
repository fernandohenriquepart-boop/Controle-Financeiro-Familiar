// Edge Function: roda numa agenda (Cron Jobs do Supabase, não é chamada pelo
// app) e manda push notification pras contas a pagar/receber que estão perto
// de vencer ou já venceram, pra todos os aparelhos inscritos da família.
//
// Deploy: supabase functions deploy send-bill-reminders
// Secrets necessários (supabase secrets set / Dashboard → Edge Functions →
// Manage secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (ex: mailto:seuemail@exemplo.com). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// já vêm automaticamente.
// Agendamento: Dashboard → Edge Functions → send-bill-reminders → Cron,
// ex: todo dia às 08:00 (horário do servidor é UTC).
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REMINDER_HORIZON_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@example.com";

    // DEBUG temporário — remover depois de confirmar o tamanho das chaves.
    console.log(
      "VAPID debug — public length:",
      vapidPublicKey?.length,
      "public preview:",
      JSON.stringify(vapidPublicKey?.slice(0, 6) + "..." + vapidPublicKey?.slice(-6)),
      "| private length:",
      vapidPrivateKey?.length,
      "private preview:",
      JSON.stringify(vapidPrivateKey?.slice(0, 6) + "..." + vapidPrivateKey?.slice(-6))
    );

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + REMINDER_HORIZON_DAYS);
    const horizonStr = horizon.toISOString().slice(0, 10);

    // Contas pendentes vencendo até o horizonte (ou já vencidas) que ainda
    // não geraram um aviso — reminder_sent_at marca isso, pra não repetir
    // todo dia.
    const { data: bills, error: billsError } = await admin
      .from("bills")
      .select("id, household_id, description, due_date, type")
      .eq("status", "pending")
      .is("reminder_sent_at", null)
      .lte("due_date", horizonStr);
    if (billsError) throw billsError;

    let sent = 0;
    for (const bill of bills ?? []) {
      const { data: subs, error: subsError } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("household_id", bill.household_id);
      if (subsError) throw subsError;

      if (subs && subs.length > 0) {
        const dueDate = new Date(bill.due_date + "T00:00:00");
        const overdue = dueDate < today;
        const label = bill.type === "payable" ? "a pagar" : "a receber";
        const title = overdue ? "Conta atrasada" : "Conta perto de vencer";
        const body = `${bill.description} (${label}) — ${overdue ? "venceu" : "vence"} em ${dueDate.toLocaleDateString("pt-BR")}`;
        const payload = JSON.stringify({ title, body, url: "/" });

        for (const sub of subs) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
            sent++;
          } catch (pushError) {
            const statusCode = (pushError as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              // Inscrição expirou/foi revogada no navegador — limpa pra não tentar de novo.
              await admin.from("push_subscriptions").delete().eq("id", sub.id);
            } else {
              console.error("send-bill-reminders push error", bill.id, sub.id, pushError);
            }
          }
        }
      }

      await admin.from("bills").update({ reminder_sent_at: new Date().toISOString() }).eq("id", bill.id);
    }

    return new Response(
      JSON.stringify({ success: true, billsProcessed: (bills ?? []).length, notificationsSent: sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-bill-reminders error:", error);
    return new Response(JSON.stringify({ error: String((error as Error)?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
