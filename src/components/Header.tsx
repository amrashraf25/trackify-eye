import { Bell, User, Sun, Moon, Check, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface HeaderProps {
  title: string;
}

const Header = ({ title }: HeaderProps) => {
  const { user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  type HeaderNotification = Tables<"notifications"> | Tables<"doctor_notifications">;
  const supportsNotifications = role === "student" || role === "doctor";

  const notificationQueryKey = ["header-notifications", role, user?.id];

  // Fetch notifications for students and doctors
  const { data: notifications = [] } = useQuery<HeaderNotification[]>({
    queryKey: notificationQueryKey,
    queryFn: async () => {
      if (!user?.id || !supportsNotifications) return [];

      if (role === "doctor") {
        const { data, error } = await supabase
          .from("doctor_notifications")
          .select("*")
          .eq("doctor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) return [];
        return data;
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) return [];
      return data;
    },
    enabled: !!user?.id && supportsNotifications,
    refetchInterval: 15000,
  });

  // Realtime subscription for students and doctors
  useEffect(() => {
    if (!supportsNotifications || !user?.id) return;

    const tableName = role === "doctor" ? "doctor_notifications" : "notifications";

    const channel = supabase
      .channel(`header-notifications-${role}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName,
          ...(role === "doctor" ? { filter: `doctor_id=eq.${user.id}` } : {}),
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationQueryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supportsNotifications, role, user?.id, queryClient]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Fetch avatar
  const { data: avatarUrl } = useQuery({
    queryKey: ["my-avatar", user?.id, role],
    queryFn: async () => {
      if (role === "student") {
        const { data } = await supabase.from("students").select("avatar_url").eq("user_id", user?.id).single();
        return data?.avatar_url || null;
      }
      const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user?.id).single();
      return data?.avatar_url || null;
    },
    enabled: !!user?.id,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (!supportsNotifications) return;

      if (role === "doctor") {
        await supabase.from("doctor_notifications").update({ is_read: true }).eq("id", id);
        return;
      }

      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!supportsNotifications) return;

      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length === 0) return;

      if (role === "doctor") {
        await supabase.from("doctor_notifications").update({ is_read: true }).in("id", unreadIds);
        return;
      }

      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    },
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-16 glass border-b border-border/50 flex items-center justify-between px-6 transition-colors duration-300 relative z-20">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </motion.div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl transition-all"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl hover:bg-secondary/80"
            onClick={() => setShowNotifs(!showNotifs)}
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1 pulse-ring">
                {unreadCount}
              </span>
            )}
          </Button>

          {/* Notification Dropdown */}
          <AnimatePresence>
            {showNotifs && role === "student" && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl border border-border/50 shadow-xl overflow-hidden bg-card"
              >
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                  <h3 className="font-bold text-foreground text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-primary h-7"
                      onClick={() => markAllRead.mutate()}
                    >
                      <Check className="w-3 h-3 mr-1" /> Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notif: any) => (
                      <div
                        key={notif.id}
                        onClick={() => !notif.is_read && markAsRead.mutate(notif.id)}
                        className={`p-4 border-b border-border/20 transition-colors cursor-pointer ${
                          notif.is_read ? "opacity-60" : "bg-primary/5 hover:bg-primary/10"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            notif.type === "behavior_warning" ? "bg-destructive/10" : "bg-primary/10"
                          }`}>
                            <Bell className={`w-4 h-4 ${
                              notif.type === "behavior_warning" ? "text-destructive" : "text-primary"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                              {format(new Date(notif.created_at), "MMM dd, yyyy • HH:mm")}
                            </p>
                          </div>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3 ml-1 pl-3 border-l border-border/50">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.user_metadata?.full_name || user?.email?.split("@")[0]}</p>
            {role && (
              <Badge className="text-[10px] capitalize bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {role}
              </Badge>
            )}
          </div>
          <Avatar className="w-9 h-9 rounded-xl border border-primary/20">
            <AvatarImage src={avatarUrl || undefined} className="object-cover rounded-xl" />
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary text-xs font-bold">
              {user?.user_metadata?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || <User className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
};

export default Header;
