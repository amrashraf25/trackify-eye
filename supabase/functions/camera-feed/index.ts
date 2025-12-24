import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, data } = body;

    console.log(`Camera feed action: ${action}`, data);

    // Handle different actions from the Python backend
    if (action === 'report_incident') {
      // Report an incident detected by the camera
      const { incident_type, room_number, severity, student_name, behavior } = data;
      
      const { data: incident, error } = await supabase
        .from('incidents')
        .insert({
          incident_type: incident_type || behavior || 'Unknown Incident',
          room_number: room_number || '101',
          severity: severity || 'medium',
          status: 'active',
          detected_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting incident:', error);
        throw error;
      }

      console.log('Incident reported:', incident);
      return new Response(JSON.stringify({ success: true, incident }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'phone_detected') {
      // Phone detection - create a phone incident
      const { room_number, student_name } = data;
      
      const { data: incident, error } = await supabase
        .from('incidents')
        .insert({
          incident_type: 'Phone Detected',
          room_number: room_number || '101',
          severity: 'low',
          status: 'active',
          detected_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting phone incident:', error);
        throw error;
      }

      console.log('Phone detected incident:', incident);
      return new Response(JSON.stringify({ success: true, incident }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_attendance') {
      // Update attendance from face recognition
      const { student_id, course_name, status } = data;
      
      const { data: attendance, error } = await supabase
        .from('attendance_records')
        .insert({
          student_id,
          course_name: course_name || 'General',
          status: status || 'present',
          date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting attendance:', error);
        throw error;
      }

      console.log('Attendance updated:', attendance);
      return new Response(JSON.stringify({ success: true, attendance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'behavior_alert') {
      // Behavior alert (sleeping, talking, etc.)
      const { room_number, behavior, student_name, severity } = data;
      
      const { data: incident, error } = await supabase
        .from('incidents')
        .insert({
          incident_type: behavior,
          room_number: room_number || '101',
          severity: severity || 'medium',
          status: 'active',
          detected_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting behavior alert:', error);
        throw error;
      }

      console.log('Behavior alert:', incident);
      return new Response(JSON.stringify({ success: true, incident }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in camera-feed function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
