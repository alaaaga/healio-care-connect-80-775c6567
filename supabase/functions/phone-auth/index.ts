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

    const { action, phone, code, full_name, email } = await req.json();

    // ── Link phone to existing email account ──
    if (action === "link_phone") {
      if (!email || !phone) {
        return jsonResponse({ error: "Email and phone required" }, 400);
      }

      // Check phone not already used by another account
      const { data: phoneOwner } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      // Find user by email
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
      if (!phone || !code) {
        return jsonResponse({ error: "Phone and OTP code required" }, 400);
      }

      const { data: otpValid, error: otpErr } = await supabase.rpc("verify_phone_otp", {
        _phone: phone, _code: code,
      });
      if (otpErr || !otpValid) {
        return jsonResponse({ error: "invalid_otp" }, 401);
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profileData) {
        return jsonResponse({ error: "no_account_for_phone" }, 404);
      }

      const { data: { user }, error: getUserErr } = await supabase.auth.admin.getUserById(profileData.user_id);
      if (getUserErr || !user) {
        return jsonResponse({ error: "user_not_found" }, 404);
      }

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: user.email!,
      });
      if (linkErr || !linkData) {
        return jsonResponse({ error: "failed_to_generate_session" }, 500);
      }

      return jsonResponse({
        success: true,
        email: user.email,
        token_hash: linkData.properties.hashed_token,
      });
    }

    // ── Register with phone ──
    if (action === "register_with_phone") {
      if (!phone || !code || !full_name) {
        return jsonResponse({ error: "Phone, code, and name required" }, 400);
      }

      const { data: otpValid, error: otpErr } = await supabase.rpc("verify_phone_otp", {
        _phone: phone, _code: code,
      });
      if (otpErr || !otpValid) {
        return jsonResponse({ error: "invalid_otp" }, 401);
      }

      // Check phone uniqueness
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();
      if (existing) {
        return jsonResponse({ error: "phone_already_registered" }, 409);
      }

      const syntheticEmail = `${phone.replace(/\D/g, "")}@phone.medicare.local`;
      const syntheticPassword = `Ph-${phone.replace(/\D/g, "")}-MC2026`;

      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { full_name, phone },
      });
      if (createErr) {
        return jsonResponse({ error: createErr.message }, 500);
      }

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: syntheticEmail,
      });
      if (linkErr || !linkData) {
        return jsonResponse({ error: "failed_to_generate_session" }, 500);
      }

      return jsonResponse({
        success: true,
        email: syntheticEmail,
        token_hash: linkData.properties.hashed_token,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
