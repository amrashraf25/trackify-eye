import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { User, Bell, Shield, Palette, Plus, Users as UsersIcon, Mail, GraduationCap, Star, CheckCircle2, Moon, Sun, Settings2, Lock, KeyRound, ShieldCheck, BellRing, BellOff, FileText, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

// User settings page with Profile, Notifications, Appearance, and Security tabs; admins also see a User Management tab.
const Settings = () => {
  const { user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState("profile");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "student" });
  const [creating, setCreating] = useState(false);

  const isAdmin = role === "admin";
  const isStudent = role === "student";

  // Fetches the student record for the logged-in user (student role only) to display profile stats.
  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile-settings", user?.id],
    queryFn: async () => {
      if (!user?.id || !isStudent) return null;
      const { data } = await supabase.from("students").select("*").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id && isStudent,
  });

  // Fetches the student's behavior score once the student profile is loaded (depends on studentProfile.id).
  const { data: behaviorScore } = useQuery({
    queryKey: ["behavior-score-settings", studentProfile?.id],
    queryFn: async () => {
      if (!studentProfile?.id) return null;
      const { data } = await supabase.from("behavior_scores").select("*").eq("student_id", studentProfile.id).single();
      return data;
    },
    enabled: !!studentProfile?.id,
  });

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "security", label: "Security", icon: Shield },
    ...(isAdmin ? [{ id: "users", label: "User Management", icon: UsersIcon }] : []),
  ];

  // Creates a new user: calls supabase.auth.signUp then inserts their role into the user_roles table.
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error("Please fill all required fields");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: newUser.full_name } },
    });
    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }
    if (data.user) {
      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: data.user.id, role: newUser.role as any });
      if (roleError) {
        toast.error("User created but role assignment failed: " + roleError.message);
      } else {
        toast.success(`${newUser.role} account created for ${newUser.email}`);
      }
    }
    setNewUser({ email: "", password: "", full_name: "", role: "student" });
    setAddUserOpen(false);
    setCreating(false);
  };

  return (
    <MainLayout title="Settings">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/50 mb-6"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-primary/5 to-accent/10" />
        <div className="absolute inset-0" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 20h40M20 0v40' stroke='%23ffffff' stroke-opacity='0.03'/%3E%3C/svg%3E\")" }} />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px]" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-primary/10 rounded-full blur-[60px]" />
        <div className="relative z-10 p-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Settings2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400 mb-1">Configuration</p>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your account, preferences, and security</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl p-3 border border-border/50 h-fit">
          <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-semibold px-3 mb-2">Settings</p>
          <nav className="space-y-0.5">
            {sections.map((section, index) => (
              <motion.button
                key={section.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                  activeSection === section.id
                    ? "bg-gradient-to-r from-primary/20 to-accent/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  activeSection === section.id ? "bg-primary/20 text-primary" : "bg-secondary/50 group-hover:bg-secondary"
                }`}>
                  <section.icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-sm">{section.label}</span>
                {activeSection === section.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </motion.button>
            ))}
          </nav>
        </motion.div>

        <div className="lg:col-span-3 space-y-6">
          {activeSection === "profile" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Profile Hero Card */}
              <div className="relative overflow-hidden rounded-2xl border border-border/50">
                {/* Background gradient banner */}
                <div className="h-28 bg-gradient-to-r from-primary/30 via-accent/20 to-neon-cyan/20 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/60" />
                  <div className="absolute top-3 right-3 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 left-1/4 w-24 h-24 bg-accent/15 rounded-full blur-2xl" />
                </div>

                <div className="px-6 pb-6 -mt-12 relative">
                  {/* Avatar */}
                  <div className="relative w-fit mb-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-4 ring-background shadow-xl shadow-primary/20">
                      <span className="text-2xl font-black text-white">
                        {(user?.user_metadata?.full_name || user?.email || "U")
                          .split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-background" />
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{user?.user_metadata?.full_name || "User"}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5" />{user?.email}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {role && (
                          <span className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-lg border ${
                            role === "admin"   ? "bg-violet-500/10 text-violet-400 border-violet-500/25" :
                            role === "dean"    ? "bg-blue-500/10 text-blue-400 border-blue-500/25" :
                            role === "doctor"  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" :
                            "bg-amber-500/10 text-amber-400 border-amber-500/25"
                          }`}>
                            {role}
                          </span>
                        )}
                        {isStudent && studentProfile?.student_code && (
                          <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg border border-border/50">
                            {studentProfile.student_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Student Quick Stats */}
              {isStudent && (
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      label: "Behavior Score",
                      value: behaviorScore?.score ?? 100,
                      unit: "/100",
                      icon: Star,
                      color: (behaviorScore?.score ?? 100) >= 80 ? "text-emerald-400 bg-emerald-500/10" : (behaviorScore?.score ?? 100) >= 60 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10",
                    },
                    {
                      label: "Year Level",
                      value: studentProfile?.year_level ?? "—",
                      unit: "",
                      icon: GraduationCap,
                      color: "text-blue-400 bg-blue-500/10",
                    },
                    {
                      label: "Status",
                      value: studentProfile?.status === "active" ? "Active" : "Inactive",
                      unit: "",
                      icon: CheckCircle2,
                      color: studentProfile?.status === "active" ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground bg-muted/20",
                    },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                      className="glass rounded-2xl p-4 border border-border/50 hover:border-primary/30 transition-all"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <p className="text-lg font-bold text-foreground tabular-nums">
                        {stat.value}<span className="text-sm text-muted-foreground font-normal">{stat.unit}</span>
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Account Info Card */}
              <div className="glass rounded-2xl p-6 border border-border/50 space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Account Information</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between py-3 border-b border-border/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">Full Name</p>
                      <p className="text-xs text-muted-foreground">{user?.user_metadata?.full_name || "Not set"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">Read-only</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-border/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">Email</p>
                      <p className="text-xs text-muted-foreground font-mono">{user?.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">Verified</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Member Since</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === "appearance" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="glass rounded-2xl p-6 border border-border/50">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Theme</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Dark mode option */}
                  <button
                    onClick={() => theme !== "dark" && toggleTheme()}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left group ${
                      theme === "dark" ? "border-primary bg-primary/10" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 mb-3 flex items-center justify-center">
                      <Moon className="w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Dark</p>
                    <p className="text-xs text-muted-foreground">Deep dark with neon accents</p>
                    {theme === "dark" && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                  {/* Light mode option */}
                  <button
                    onClick={() => theme !== "light" && toggleTheme()}
                    className={`relative p-4 rounded-xl border-2 transition-all text-left group ${
                      theme === "light" ? "border-primary bg-primary/10" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-gradient-to-br from-gray-100 to-white mb-3 flex items-center justify-center">
                      <Sun className="w-6 h-6 text-amber-500" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Light</p>
                    <p className="text-xs text-muted-foreground">Clean light with subtle tones</p>
                    {theme === "light" && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === "notifications" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <BellRing className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Notification Preferences</h3>
                    <p className="text-xs text-muted-foreground">Choose how you want to be notified</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {[
                    { title: "Email Notifications", desc: "Receive alerts via email", defaultOn: true, icon: Mail, color: "text-blue-400 bg-blue-500/10" },
                    { title: "Push Notifications", desc: "Receive push notifications on desktop", defaultOn: true, icon: Bell, color: "text-violet-400 bg-violet-500/10" },
                    { title: "Incident Alerts", desc: "Get notified about security incidents", defaultOn: true, icon: ShieldCheck, color: "text-red-400 bg-red-500/10" },
                    { title: "Weekly Reports", desc: "Receive weekly summary reports", defaultOn: false, icon: FileText, color: "text-emerald-400 bg-emerald-500/10" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <Switch defaultChecked={item.defaultOn} />
                    </motion.div>
                  ))}
                </div>
              </div>
              {/* Quiet Hours */}
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <BellOff className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Quiet Hours</h3>
                    <p className="text-xs text-muted-foreground">Pause notifications during specific times</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div>
                    <p className="font-medium text-foreground text-sm">Enable Quiet Hours</p>
                    <p className="text-xs text-muted-foreground">10:00 PM – 7:00 AM</p>
                  </div>
                  <Switch defaultChecked={false} />
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === "security" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Password */}
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Password</h3>
                    <p className="text-xs text-muted-foreground">Update your account password</p>
                  </div>
                </div>
                <div className="space-y-3 max-w-md">
                  <div>
                    <Label className="text-xs text-muted-foreground">Current Password</Label>
                    <Input type="password" placeholder="••••••••" className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">New Password</Label>
                    <Input type="password" placeholder="Min 6 characters" className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
                    <Input type="password" placeholder="Repeat new password" className="rounded-xl mt-1" />
                  </div>
                  <Button className="rounded-xl bg-gradient-to-r from-primary to-accent mt-2">
                    <Lock className="w-4 h-4 mr-2" />Update Password
                  </Button>
                </div>
              </div>
              {/* Sessions */}
              <div className="glass rounded-2xl p-6 border border-border/50">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Active Sessions</h3>
                    <p className="text-xs text-muted-foreground">Manage where you're logged in</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 px-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Current Session</p>
                      <p className="text-xs text-muted-foreground">This browser · Active now</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold">Active</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeSection === "users" && isAdmin && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 border border-border/50">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <UsersIcon className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">User Management</h3>
                    <p className="text-xs text-muted-foreground">Create and manage user accounts</p>
                  </div>
                </div>
                <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-2" />Create User</Button>
                  </DialogTrigger>
                  <DialogContent className="glass border-border/50">
                    <DialogHeader><DialogTitle>Create New User Account</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label className="text-xs text-muted-foreground">Full Name *</Label><Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} className="rounded-xl mt-1" /></div>
                      <div><Label className="text-xs text-muted-foreground">Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="rounded-xl mt-1" /></div>
                      <div><Label className="text-xs text-muted-foreground">Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" className="rounded-xl mt-1" /></div>
                      <div><Label className="text-xs text-muted-foreground">Role</Label>
                        <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                          <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="doctor">Doctor</SelectItem>
                            <SelectItem value="dean">Dean</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateUser} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent" disabled={creating}>
                        {creating ? "Creating..." : "Create Account"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              {/* Role cards */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { role: "Student", desc: "Enrolled learners", icon: GraduationCap, color: "text-amber-400 bg-amber-500/10 border-amber-500/15" },
                  { role: "Doctor", desc: "Course instructors", icon: User, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/15" },
                  { role: "Dean", desc: "Department heads", icon: Star, color: "text-blue-400 bg-blue-500/10 border-blue-500/15" },
                  { role: "Admin", desc: "Full access", icon: Shield, color: "text-violet-400 bg-violet-500/10 border-violet-500/15" },
                ].map((r) => (
                  <div key={r.role} className={`flex items-center gap-3 p-3 rounded-xl border ${r.color}`}>
                    <r.icon className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{r.role}</p>
                      <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
