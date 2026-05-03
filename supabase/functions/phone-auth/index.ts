import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, phone, code, full_name, email, password } = await req.json();

    if (action === "link_phone") {
      // Link phone number to existing email account
      if (!email || !phone) {
        return new Response(JSON.stringify({ error: "Email and phone required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find user by email
      const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const user = users.find((u: any) => u.email === email);
      if (!user) {
        return new Response(JSON.stringify({ error: "user_not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile with phone
      await supabase.from("profiles").update({ phone }).eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "login_with_phone") {
      // After OTP verified, find user by phone and generate session
      if (!phone || !code) {
        return new Response(JSON.stringify({ error: "Phone and OTP code required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify OTP
      const { data: otpValid, error: otpErr } = await supabase.rpc("verify_phone_otp", {
        _phone: phone, _code: code,
      });
      if (otpErr || !otpValid) {
        return new Response(JSON.stringify({ error: "invalid_otp" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find profile by phone
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profileData) {
        // No account linked to this phone — need to register first
        return new Response(JSON.stringify({ error: "no_account_for_phone" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate magic link / sign in on behalf
      // Use admin to generate a session token
      const { data: { user }, error: getUserErr } = await supabase.auth.admin.getUserById(profileData.user_id);
      if (getUserErr || !user) {
        return new Response(JSON.stringify({ error: "user_not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate a link for the user (magic link approach)
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: user.email!,
      });

      if (linkErr || !linkData) {
        return new Response(JSON.stringify({ error: "failed_to_generate_session" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return the token hash so client can verify the OTP to get a session
      const properties = linkData.properties;

      return new Response(JSON.stringify({
        success: true,
        email: user.email,
        token_hash: properties.hashed_token,
        // The client will call supabase.auth.verifyOtp with this
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "register_with_phone") {
      // Register a new account with phone + name, using a synthetic email
      if (!phone || !code || !full_name) {
        return new Response(JSON.stringify({ error: "Phone, code, and name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify OTP
      const { data: otpValid, error: otpErr } = await supabase.rpc("verify_phone_otp", {
        _phone: phone, _code: code,
      });
      if (otpErr || !otpValid) {
        return new Response(JSON.stringify({ error: "invalid_otp" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if phone already linked
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "phone_already_registered" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user with synthetic email
      const syntheticEmail = `${phone.replace(/\D/g, "")}@phone.medicare.local`;
      const syntheticPassword = `Ph-${phone.replace(/\D/g, "")}-MC2026`;

      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { full_name, phone },
      });

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate session
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: syntheticEmail,
      });

      if (linkErr || !linkData) {
        return new Response(JSON.stringify({ error: "failed_to_generate_session" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        email: syntheticEmail,
        token_hash: linkData.properties.hashed_token,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
