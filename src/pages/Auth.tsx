import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, Shield, User, Stethoscope, BookOpen } from "lucide-react";
import { toast } from "sonner";
import AnimatedBackground from "@/components/AnimatedBackground";
import owlMascot from "@/assets/owl_mascot.png";
import { motion, AnimatePresence } from "framer-motion";

const demoAccounts = [
  { role: "Admin", email: "admin@trackify.com", password: "admin123", icon: Shield, color: "text-destructive", bg: "bg-destructive/10" },
  { role: "Dean", email: "dean@trackify.com", password: "dean123", icon: BookOpen, color: "text-accent", bg: "bg-accent/10" },
  { role: "Doctor", email: "doctor@trackify.com", password: "doctor123", icon: Stethoscope, color: "text-primary", bg: "bg-primary/10" },
  { role: "Student", email: "student@trackify.com", password: "student123", icon: User, color: "text-emerald-500", bg: "bg-emerald-500/10" },
];

// Aperture blade component
const ApertureOverlay = ({ size, top, left }: { size: string; top: string; left: string }) => {
  const bladeCount = 6;
  const angles = Array.from({ length: bladeCount }, (_, i) => (360 / bladeCount) * i);

  return (
    <div
      className="absolute rounded-full overflow-hidden pointer-events-none"
      style={{ width: size, height: size, top, left }}
    >
      <motion.svg viewBox="0 0 100 100" className="w-full h-full">
        {angles.map((angle, i) => {
          const rad = (a: number) => (a * Math.PI) / 180;
          const cx = 50, cy = 50, R = 46, r = 4;
          const openP1 = `${cx + R * Math.cos(rad(angle - 8))} ${cy + R * Math.sin(rad(angle - 8))}`;
          const openP2 = `${cx + R * Math.cos(rad(angle + 8))} ${cy + R * Math.sin(rad(angle + 8))}`;
          const openP3 = `${cx + R * Math.cos(rad(angle))} ${cy + R * Math.sin(rad(angle))}`;
          const openPoints = `${openP1}, ${openP2}, ${openP3}`;
          const closedP1 = `${cx + R * Math.cos(rad(angle - 28))} ${cy + R * Math.sin(rad(angle - 28))}`;
          const closedP2 = `${cx + R * Math.cos(rad(angle + 28))} ${cy + R * Math.sin(rad(angle + 28))}`;
          const closedP3 = `${cx + r * Math.cos(rad(angle))} ${cy + r * Math.sin(rad(angle))}`;
          const closedPoints = `${closedP1}, ${closedP2}, ${closedP3}`;

          return (
            <motion.polygon
              key={i}
              fill="hsl(220 15% 13%)"
              stroke="hsl(220 10% 22%)"
              strokeWidth="0.8"
              animate={{
                points: [openPoints, openPoints, closedPoints, closedPoints, openPoints],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 3,
              }}
            />
          );
        })}
      </motion.svg>
    </div>
  );
};

// SVG Wing that expands to cover the screen
const OwlWingSVG = ({ side }: { side: "left" | "right" }) => (
  <svg
    viewBox="0 0 500 800"
    className="w-full h-full"
    style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
  >
    <path
      d="M500,400 Q500,100 350,50 Q200,0 100,100 Q0,200 0,400 Q0,600 100,700 Q200,800 350,750 Q500,700 500,400Z"
      fill="hsl(var(--background))"
    />
    {/* Feather detail lines */}
    <path d="M400,200 Q300,300 350,400 Q400,500 400,600" stroke="hsl(var(--primary) / 0.15)" strokeWidth="2" fill="none" />
    <path d="M350,150 Q250,280 300,400 Q350,520 350,650" stroke="hsl(var(--primary) / 0.1)" strokeWidth="1.5" fill="none" />
    <path d="M300,120 Q200,260 250,400 Q300,540 300,680" stroke="hsl(var(--primary) / 0.08)" strokeWidth="1" fill="none" />
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [transitionPhase, setTransitionPhase] = useState<
    "idle" | "fadeForm" | "flyToCenter" | "spreadWings" | "reveal"
  >("idle");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && transitionPhase === "idle") {
        navigate("/");
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate, transitionPhase]);

  // Sequencer for animation phases
  useEffect(() => {
    if (transitionPhase === "fadeForm") {
      const t = setTimeout(() => setTransitionPhase("flyToCenter"), 400);
      return () => clearTimeout(t);
    }
    if (transitionPhase === "flyToCenter") {
      const t = setTimeout(() => setTransitionPhase("spreadWings"), 700);
      return () => clearTimeout(t);
    }
    if (transitionPhase === "spreadWings") {
      const t = setTimeout(() => setTransitionPhase("reveal"), 800);
      return () => clearTimeout(t);
    }
    if (transitionPhase === "reveal") {
      const t = setTimeout(() => navigate("/"), 600);
      return () => clearTimeout(t);
    }
  }, [transitionPhase, navigate]);

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
      setLoading(false);
    } else {
      setTransitionPhase("fadeForm");
    }
  };

  const handleQuickLogin = (acc: typeof demoAccounts[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  const isAnimating = transitionPhase !== "idle";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <AnimatedBackground />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ===== TRANSITION OVERLAY ===== */}
      <AnimatePresence>
        {isAnimating && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Owl flying to center and growing */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
              initial={{ scale: 1, y: -80 }}
              animate={
                transitionPhase === "fadeForm"
                  ? { scale: 1.2, y: -40 }
                  : transitionPhase === "flyToCenter"
                  ? { scale: 2, y: 0 }
                  : transitionPhase === "spreadWings"
                  ? { scale: 2.5, y: 0, opacity: 1 }
                  : { scale: 3, y: 0, opacity: 0 }
              }
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Glow behind owl */}
              <motion.div
                className="absolute w-64 h-64 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
                  filter: "blur(30px)",
                }}
                animate={
                  transitionPhase === "flyToCenter" || transitionPhase === "spreadWings"
                    ? { scale: [1, 2, 3], opacity: [0.5, 0.8, 0] }
                    : { scale: 1, opacity: 0.3 }
                }
                transition={{ duration: 1.2 }}
              />
              <motion.img
                src={owlMascot}
                alt="Trackify Owl"
                className="w-40 h-40 object-contain relative z-10"
                style={{
                  filter: "drop-shadow(0 0 40px hsl(217 91% 60% / 0.5))",
                }}
                animate={
                  transitionPhase === "spreadWings"
                    ? { rotate: [0, -2, 2, 0] }
                    : {}
                }
                transition={{ duration: 0.4 }}
              />
            </motion.div>

            {/* Wings expanding from center to cover screen */}
            {(transitionPhase === "spreadWings" || transitionPhase === "reveal") && (
              <>
                {/* Left Wing */}
                <motion.div
                  className="absolute top-0 right-1/2 h-full"
                  style={{ width: "55%" }}
                  initial={{ x: "90%", scaleX: 0 }}
                  animate={
                    transitionPhase === "spreadWings"
                      ? { x: "0%", scaleX: 1 }
                      : { x: "0%", scaleX: 1 }
                  }
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <OwlWingSVG side="left" />
                </motion.div>

                {/* Right Wing */}
                <motion.div
                  className="absolute top-0 left-1/2 h-full"
                  style={{ width: "55%" }}
                  initial={{ x: "-90%", scaleX: 0 }}
                  animate={
                    transitionPhase === "spreadWings"
                      ? { x: "0%", scaleX: 1 }
                      : { x: "0%", scaleX: 1 }
                  }
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <OwlWingSVG side="right" />
                </motion.div>

                {/* Full background fill to ensure coverage */}
                <motion.div
                  className="absolute inset-0 bg-background"
                  initial={{ opacity: 0 }}
                  animate={
                    transitionPhase === "spreadWings"
                      ? { opacity: 0.6 }
                      : { opacity: 1 }
                  }
                  transition={{
                    duration: transitionPhase === "reveal" ? 0.5 : 0.6,
                    delay: transitionPhase === "spreadWings" ? 0.3 : 0,
                  }}
                />
              </>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* ===== MAIN CONTENT ===== */}
      <motion.div
        className="w-full max-w-md space-y-4 relative z-10"
        animate={isAnimating ? { opacity: 0, scale: 0.92, y: 20 } : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Owl Hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
          className="text-center mb-2"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="flex justify-center mb-3"
          >
            <div className="relative">
              <img
                src={owlMascot}
                alt="Trackify Owl"
                className="w-40 h-40 object-contain drop-shadow-[0_10px_30px_hsl(217_91%_60%/0.3)]"
              />
              <ApertureOverlay size="19%" top="29%" left="19%" />
              <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl scale-110" />
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold gradient-text mb-1"
          >
            Trackify
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-muted-foreground"
          >
            Smart Classroom Monitoring Platform
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
                <Button type="submit" className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity font-semibold" disabled={loading || isAnimating}>
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
          transition={{ delay: 0.5 }}
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
                    transition={{ delay: 0.6 + index * 0.1 }}
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
      </motion.div>
    </div>
  );
};

export default Auth;
