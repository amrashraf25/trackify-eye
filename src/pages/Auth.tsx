import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, Shield, User, Stethoscope, BookOpen, Eye, Scan, Brain } from "lucide-react";
import { toast } from "sonner";
import trackifyLogo from "@/assets/trackify_logo.jfif";
import AnimatedBackground from "@/components/AnimatedBackground";
import { motion } from "framer-motion";

const demoAccounts = [
  { role: "Admin", email: "admin@trackify.com", password: "admin123", icon: Shield, color: "text-destructive", bg: "bg-destructive/10" },
  { role: "Dean", email: "dean@trackify.com", password: "dean123", icon: BookOpen, color: "text-accent", bg: "bg-accent/10" },
  { role: "Doctor", email: "doctor@trackify.com", password: "doctor123", icon: Stethoscope, color: "text-primary", bg: "bg-primary/10" },
  { role: "Student", email: "student@trackify.com", password: "student123", icon: User, color: "text-emerald-500", bg: "bg-emerald-500/10" },
];

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter both email and password");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Logged in successfully");
    }
    setLoading(false);
  };

  const handleQuickLogin = (acc: typeof demoAccounts[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Decorative glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-4 relative z-10">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src={trackifyLogo} alt="Trackify" className="w-20 h-20 rounded-2xl object-cover ring-2 ring-primary/30 shadow-glow-primary" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-neon-cyan rounded-lg flex items-center justify-center animate-pulse">
                <Brain className="w-3.5 h-3.5 text-background" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-1">Trackify</h1>
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Scan className="w-4 h-4" />
            AI-Powered Classroom Monitoring
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass border-border/50 shadow-glow-primary/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-lg font-bold text-foreground">Welcome Back</CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Sign in to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground text-xs uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@institution.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground text-xs uppercase tracking-wider">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 rounded-xl"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity font-semibold" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Demo Accounts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass border-border/50">
            <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Demo Accounts — Click to fill
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              {demoAccounts.map((acc, index) => {
                const Icon = acc.icon;
                return (
                  <motion.button
                    key={acc.role}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    onClick={() => handleQuickLogin(acc)}
                    className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-secondary/50 transition-all text-left group hover-lift"
                  >
                    <div className={`w-8 h-8 rounded-lg ${acc.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${acc.color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{acc.role}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{acc.password}</p>
                    </div>
                  </motion.button>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Features row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground/60 uppercase tracking-wider pt-2"
        >
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />Face Detection</span>
          <span className="flex items-center gap-1"><Scan className="w-3 h-3" />Behavior AI</span>
          <span className="flex items-center gap-1"><Brain className="w-3 h-3" />Smart Analytics</span>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
