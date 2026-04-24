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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error("Unauthorized");

    const { data: callerRole } = await supabaseAdmin.rpc("get_user_role", { _user_id: caller.id });
    if (!callerRole || !["admin", "dean"].includes(callerRole)) {
      throw new Error("Only admins and deans can update doctor profiles");
    }

    const { doctor_id, full_name, avatar_url } = await req.json();

    if (!doctor_id) throw new Error("Doctor ID is required");

    const { data: doctorProfile, error: doctorError } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", doctor_id)
      .eq("role", "doctor")
      .maybeSingle();

    if (doctorError) throw doctorError;
    if (!doctorProfile) throw new Error("Doctor profile not found");

    const updates: Record<string, string | null> = {};

    if (typeof full_name === "string") {
      const trimmed = full_name.trim();
      if (!trimmed) throw new Error("Doctor name is required");
      updates.full_name = trimmed;
    }

    if (avatar_url === null || typeof avatar_url === "string") {
      updates.avatar_url = avatar_url || null;
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No profile changes provided");
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", doctor_id)
      .eq("role", "doctor");

    if (updateError) throw updateError;

    if (updates.full_name) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(doctor_id, {
        user_metadata: { full_name: updates.full_name },
      });

      if (authUpdateError) throw authUpdateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
