// Edge Function: convida um novo membro para a MESMA família (household) de
// quem chama, usando o service_role key (nunca exposto ao navegador) para
// criar o convite com os metadados que o trigger handle_new_user() usa para
// não criar uma família nova e vazia.
// Deploy: supabase functions deploy invite-member
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente "do chamador" (JWT do usuário) — só para descobrir quem é e seu papel.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await callerClient
      .from("profiles")
      .select("household_id, role")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar membros." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, fullName } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-mail é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só aqui usa o service_role — cria o usuário já com os metadados que o
    // trigger handle_new_user() lê para juntar à família certa, como membro.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_household_id: profile.household_id,
        invited_role: "member",
        full_name: fullName || undefined,
      },
    });
    if (inviteError) throw inviteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("invite-member function error:", error);
    return new Response(JSON.stringify({ error: String((error as Error)?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
