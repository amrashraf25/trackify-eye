import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Bell } from "lucide-react";
import React from "react";
import { useAuth } from "@/hooks/useAuth";

interface DoctorNotification {
  id: string;
  doctor_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export const useDoctorNotifications = () => {
  const { user, role } = useAuth();
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only subscribe if user is a doctor
    if (!user || role !== "doctor") return;

    const channel = supabase
      .channel("doctor-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "doctor_notifications",
          filter: `doctor_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as DoctorNotification;

          // Prevent duplicate notifications
          if (processedIds.current.has(notification.id)) {
            return;
          }
          processedIds.current.add(notification.id);

          const isWarning =
            notification.type === "behavior_warning" ||
            notification.type === "attendance_warning";

          // Show toast notification
          if (isWarning) {
            toast.error(notification.title, {
              description: notification.message,
              duration: 8000,
              icon: React.createElement(AlertTriangle, {
                className: "w-5 h-5 text-destructive",
              }),
            });
          } else {
            toast.info(notification.title, {
              description: notification.message,
              duration: 6000,
              icon: React.createElement(Bell, {
                className: "w-5 h-5 text-primary",
              }),
            });
          }

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
  }, [user, role]);
};
