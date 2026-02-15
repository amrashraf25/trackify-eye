import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { User, Bell, Shield, Palette, Plus, Users as UsersIcon } from "lucide-react";
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

const Settings = () => {
  const { user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState("profile");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "student" });
  const [creating, setCreating] = useState(false);

  const isAdmin = role === "admin";

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "security", label: "Security", icon: Shield },
    ...(isAdmin ? [{ id: "users", label: "User Management", icon: UsersIcon }] : []),
  ];

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

    // Sign up the new user
    const { data, error } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: newUser.full_name },
      },
    });

    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    // Assign role if user was created
    if (data.user) {
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: data.user.id,
        role: newUser.role as any,
      });
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <section.icon className="w-5 h-5" />
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {activeSection === "profile" && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Profile Settings</h3>
              <div className="flex items-start gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{user?.user_metadata?.full_name || "User"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">Role: {role || "Loading..."}</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "appearance" && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Appearance</h3>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-foreground">Dark Mode</p>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark theme</p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </div>
            </div>
          )}

          {activeSection === "notifications" && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Notification Preferences</h3>
              <div className="space-y-4">
                {[
                  { title: "Email Notifications", desc: "Receive alerts via email", defaultOn: true },
                  { title: "Push Notifications", desc: "Receive push notifications on desktop", defaultOn: true },
                  { title: "Incident Alerts", desc: "Get notified about security incidents", defaultOn: true },
                  { title: "Weekly Reports", desc: "Receive weekly summary reports", defaultOn: false },
                ].map((item) => (
                  <div key={item.title} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.defaultOn} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "security" && (
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Security</h3>
              <Button variant="outline">Change Password</Button>
            </div>
          )}

          {activeSection === "users" && isAdmin && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">User Management</h3>
                <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="w-4 h-4 mr-2" />Create User</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create New User Account</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Full Name *</Label><Input value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} /></div>
                      <div><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                      <div><Label>Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" /></div>
                      <div><Label>Role</Label>
                        <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="doctor">Doctor</SelectItem>
                            <SelectItem value="dean">Dean</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateUser} className="w-full" disabled={creating}>
                        {creating ? "Creating..." : "Create Account"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-sm text-muted-foreground">
                Create accounts for students, doctors, deans, and other admins. Users will receive a confirmation email.
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Settings;
