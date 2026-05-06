import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ── Link phone to existing email account ──
    if (action === "link_phone") {
      const { email, phone } = body;
      if (!email || !phone) return jsonResponse({ error: "Email and phone required" }, 400);

      const { data: phoneOwner } = await supabase
        .from("profiles").select("user_id").eq("phone", phone).maybeSingle();

      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const user = users.find((u: any) => u.email === email);
      if (!user) return jsonResponse({ error: "user_not_found" }, 404);

      if (phoneOwner && phoneOwner.user_id !== user.id) {
        return jsonResponse({ error: "phone_already_registered" }, 409);
      }

      await supabase.from("profiles").update({ phone }).eq("user_id", user.id);
      return jsonResponse({ success: true });
    }

    // ── Login with phone ──
    if (action === "login_with_phone") {
      const { phone, code } = body;
      if (!phone || !code) return jsonResponse({ error: "Phone and OTP code required" }, 400);

      const { data: otpValid, error: otpErr } = await supabase.rpc("verify_phone_otp", {
        _phone: phone, _code: code,
      });
      if (otpErr || !otpValid) return jsonResponse({ error: "invalid_otp" }, 401);

      const { data: profileData } = await supabase
        .from("profiles").select("user_id, banned_until").eq("phone", phone).maybeSingle();

      if (!profileData) return jsonResponse({ error: "no_account_for_phone" }, 404);

      if (profileData.banned_until && new Date(profileData.banned_until) > new Date()) {
        return jsonResponse({ error: "user_banned", banned_until: profileData.banned_until }, 403);
      }

      const { data: { user }, error: getUserErr } = await supabase.auth.admin.getUserById(profileData.user_id);
      if (getUserErr || !user) return jsonResponse({ error: "user_not_found" }, 404);

      const tempPass = `TMP-${crypto.randomUUID()}`;
      const { error: updateErr } = await supabase.auth.admin.updateUser(profileData.user_id, { password: tempPass });
      if (updateErr) return jsonResponse({ error: "failed_to_generate_session" }, 500);

      return jsonResponse({ success: true, email: user.email, temp_password: tempPass });
    }

    // ── Register with phone ──
    if (action === "register_with_phone") {
      const { phone, code, full_name } = body;
      if (!phone || !code || !full_name) return jsonResponse({ error: "Phone, code, and name required" }, 400);

      const { data: otpValid, error: otpErr } = await supabase.rpc("verify_phone_otp", {
        _phone: phone, _code: code,
      });
      if (otpErr || !otpValid) return jsonResponse({ error: "invalid_otp" }, 401);

      const { data: existing } = await supabase
        .from("profiles").select("user_id").eq("phone", phone).maybeSingle();
      if (existing) return jsonResponse({ error: "phone_already_registered" }, 409);

      const syntheticEmail = `${phone.replace(/\D/g, "")}@phone.medicare.local`;
      const tempPass = `TMP-${crypto.randomUUID()}`;

      const { error: createErr } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        password: tempPass,
        email_confirm: true,
        user_metadata: { full_name, phone },
      });
      if (createErr) return jsonResponse({ error: createErr.message }, 500);

      return jsonResponse({ success: true, email: syntheticEmail, temp_password: tempPass });
    }

    // ── Ban user ──
    if (action === "ban_user") {
      const { user_id, banned_until } = body;
      if (!user_id) return jsonResponse({ error: "user_id required" }, 400);

      await supabase.from("profiles").update({ banned_until: banned_until || null }).eq("user_id", user_id);

      // Also disable auth user if banning
      if (banned_until) {
        await supabase.auth.admin.updateUser(user_id, { ban_duration: "876000h" }); // ~100 years, we handle real expiry in app
      } else {
        await supabase.auth.admin.updateUser(user_id, { ban_duration: "none" });
      }

      return jsonResponse({ success: true });
    }

    // ── Delete user ──
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) return jsonResponse({ error: "user_id required" }, 400);

      // Delete profile and related data first
      await supabase.from("user_roles").delete().eq("user_id", user_id);
      await supabase.from("profiles").delete().eq("user_id", user_id);
      
      const { error } = await supabase.auth.admin.deleteUser(user_id);
      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
