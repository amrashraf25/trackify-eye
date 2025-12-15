import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import React from "react";

interface Incident {
  id: string;
  incident_type: string;
  room_number: string;
  detected_at: string;
  severity: string;
}

export const useIncidentNotifications = () => {
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel("incident-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "incidents",
        },
        (payload) => {
          const incident = payload.new as Incident;
          
          // Prevent duplicate notifications
          if (processedIds.current.has(incident.id)) {
            return;
          }
          processedIds.current.add(incident.id);

          // Show toast notification
          toast.error(
            `New Incident: ${incident.incident_type}`,
            {
              description: `Detected in Room ${incident.room_number}`,
              duration: 8000,
              icon: React.createElement(AlertTriangle, { className: "w-5 h-5 text-primary" }),
            }
          );

          // Play notification sound
          try {
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.5;
            audio.play().catch(() => {
              // Audio autoplay may be blocked
            });
          } catch {
            // Ignore audio errors
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
