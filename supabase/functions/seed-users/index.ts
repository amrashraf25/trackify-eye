import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const usersToCreate = [
    { email: "admin@trackify.com", password: "admin123", role: "admin", full_name: "System Admin" },
    { email: "student@trackify.com", password: "student123", role: "student", full_name: "Demo Student" },
    { email: "doctor@trackify.com", password: "doctor123", role: "doctor", full_name: "Demo Doctor" },
    { email: "dean@trackify.com", password: "dean123", role: "dean", full_name: "Demo Dean" },
  ];

  const results = [];

  for (const userData of usersToCreate) {
    // Check if user already exists by listing users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === userData.email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: userData.password });
      results.push({ email: userData.email, status: "updated" });
    } else {
      // Create new user - auto confirm
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { full_name: userData.full_name },
      });

      if (createError || !newUser?.user) {
        results.push({ email: userData.email, status: "error", error: createError?.message });
        continue;
      }
      userId = newUser.user.id;
      results.push({ email: userData.email, status: "created" });
    }

    // Upsert profile
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
    });

    // Assign role in user_roles table (delete old then insert)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: userData.role as "admin" | "dean" | "doctor" | "student",
    });
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
