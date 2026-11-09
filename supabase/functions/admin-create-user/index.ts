// Supabase Edge Function: admin-create-user
// Deploy dengan: supabase functions deploy admin-create-user
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, password, fullName, role, nip, department, phone } = await req.json();

    if (!email || !password || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: "Email, password, fullName, and role are required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        role,
        nip: nip?.trim() || "-",
        department: department?.trim() || "Sekolah Rakyat Terintegerasi 1 Sumedang",
      },
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: authError?.message || "Failed to create user in auth" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const initials = fullName
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((part: string) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SR";

    const { error: profileError } = await supabaseClient.from("profiles").upsert({
      id: authData.user.id,
      full_name: fullName.trim(),
      email: email.trim(),
      role,
      nip: nip?.trim() || "-",
      phone: phone?.trim() || "",
      department: department?.trim() || "Sekolah Rakyat Terintegerasi 1 Sumedang",
      avatar_initials: initials,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
