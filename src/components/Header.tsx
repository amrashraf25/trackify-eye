import { Bell, User, Sun, Moon, Check, AlertTriangle, Smartphone, MessageCircle, Shield, Activity, CheckCircle2 } from "lucide-react";
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
  const [notifFilter, setNotifFilter] = useState<"all" | "attendance" | "behavior" | "system">("all");

  const getNotifCategory = (type?: string): "attendance" | "behavior" | "system" => {
    if (type?.includes("attendance")) return "attendance";
    if (type?.includes("behavior") || type?.includes("warning")) return "behavior";
    return "system";
  };

  const getNotifIcon = (type?: string) => {
    if (type?.includes("behavior")) return { icon: Shield, cls: "bg-amber-500/15 text-amber-400" };
    if (type?.includes("attendance")) return { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400" };
    if (type?.includes("warning")) return { icon: AlertTriangle, cls: "bg-red-500/15 text-red-400" };
    return { icon: Bell, cls: "bg-primary/15 text-primary" };
  };

  const filteredNotifications = notifFilter === "all"
    ? notifications
    : notifications.filter((n) => getNotifCategory((n as any).type) === notifFilter);

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
    <header className="h-16 border-b border-border/50 flex items-center justify-between px-6 transition-colors duration-300 relative z-20 bg-background/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
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
        {supportsNotifications && (
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
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.18, type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 top-12 w-[360px] sm:w-[420px] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
                  style={{ background: "hsl(225 25% 9%)" }}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-sm">
                          {role === "doctor" ? "Doctor Alerts" : "Notifications"}
                        </h3>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[11px] text-primary h-7 px-2 hover:bg-primary/10"
                          onClick={() => markAllRead.mutate()}
                        >
                          <Check className="w-3 h-3 mr-1" /> Mark all read
                        </Button>
                      )}
                    </div>

                    {/* Category filter tabs */}
                    <div className="flex gap-1">
                      {([
                        { key: "all" as const, label: "All", count: notifications.length },
                        { key: "attendance" as const, label: "Attendance", count: notifications.filter(n => getNotifCategory((n as any).type) === "attendance").length },
                        { key: "behavior" as const, label: "Behavior", count: notifications.filter(n => getNotifCategory((n as any).type) === "behavior").length },
                        { key: "system" as const, label: "System", count: notifications.filter(n => getNotifCategory((n as any).type) === "system").length },
                      ]).map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setNotifFilter(tab.key)}
                          className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                            notifFilter === tab.key
                              ? "bg-primary/15 text-primary border border-primary/25"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                          }`}
                        >
                          {tab.label}
                          {tab.count > 0 && (
                            <span className="ml-1 opacity-60">({tab.count})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notification list */}
                  <div className="max-h-[420px] overflow-y-auto">
                    {filteredNotifications.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <div className="w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-3">
                          <Bell className="w-5 h-5 opacity-30" />
                        </div>
                        <p className="text-sm font-medium">No notifications</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {notifFilter !== "all" ? `No ${notifFilter} notifications` : "You're all caught up!"}
                        </p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif, idx) => {
                        const { icon: NotifIcon, cls: iconCls } = getNotifIcon((notif as any).type);

                        return (
                          <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            onClick={() => !notif.is_read && markAsRead.mutate(notif.id)}
                            className={`group px-4 py-3.5 border-b border-white/[0.04] transition-all cursor-pointer ${
                              notif.is_read
                                ? "opacity-50 hover:opacity-70"
                                : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconCls}`}>
                                <NotifIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-semibold text-foreground truncate">{notif.title}</p>
                                  {!notif.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 shadow-[0_0_6px_hsl(217_91%_60%/0.5)]" />
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground/50">
                                    {format(new Date(notif.created_at), "MMM dd • HH:mm")}
                                  </span>
                                  <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    getNotifCategory((notif as any).type) === "behavior"
                                      ? "bg-amber-500/10 text-amber-400"
                                      : getNotifCategory((notif as any).type) === "attendance"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-primary/10 text-primary"
                                  }`}>
                                    {getNotifCategory((notif as any).type)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {filteredNotifications.length > 0 && (
                    <div className="p-3 border-t border-white/[0.06] text-center">
                      <button className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
                        View all notifications
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
