import { useState, useEffect, useRef } from "react";
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

// Aperture blade component for the camera lens eye
const ApertureOverlay = ({ size, top, left, closing, angry }: { size: string; top: string; left: string; closing?: boolean; angry?: boolean }) => {
  const bladeCount = 6;
  const angles = Array.from({ length: bladeCount }, (_, i) => (360 / bladeCount) * i);
  const bladeColor = angry ? "hsl(0 80% 40%)" : "hsl(220 15% 13%)";
  const strokeColor = angry ? "hsl(0 70% 55%)" : "hsl(220 10% 22%)";

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
              fill={bladeColor}
              stroke={strokeColor}
              strokeWidth="0.8"
              animate={
                closing
                  ? { points: [openPoints, closedPoints] }
                  : { points: [openPoints, openPoints, closedPoints, closedPoints, openPoints] }
              }
              transition={
                closing
                  ? { duration: 0.4, ease: "easeInOut" }
                  : { duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }
              }
            />
          );
        })}
      </motion.svg>
    </div>
  );
};

const EyeGlow = ({ size, top, left, angry }: { size: string; top: string; left: string; angry?: boolean }) => {
  const baseHue = angry ? "0" : "200";
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, top, left }}
    >
      <motion.div
        className="w-full h-full rounded-full"
        animate={{
          opacity: [0.7, 1, 0.7],
          scale: [0.95, 1.05, 0.95],
          background: `radial-gradient(circle, hsl(${baseHue} 100% 60% / 0.6) 0%, hsl(${baseHue} 100% 50% / 0.3) 40%, transparent 70%)`,
          boxShadow: `0 0 12px 4px hsl(${baseHue} 100% 60% / 0.3)`,
        }}
        transition={{ duration: angry ? 0.3 : 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};
const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [transitionPhase, setTransitionPhase] = useState<
    "idle" | "hold" | "flying" | "reveal"
  >("idle");
  const isTransitioning = useRef(false);
  const [errorFlash, setErrorFlash] = useState(false);

  // Synthesize a whoosh sound using Web Audio API
  const playWhoosh = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const duration = 1.2;

      // White noise buffer
      const bufferSize = ctx.sampleRate * duration;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      // Bandpass filter sweeps frequency upward for the "whoosh"
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.5;
      filter.frequency.setValueAtTime(200, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + duration * 0.5);
      filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + duration);

      // Volume envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + duration * 0.15);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + duration * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + duration);
    } catch (e) {
      // Silently fail if audio isn't available
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && !isTransitioning.current) {
        navigate("/");
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Animation phase sequencer
  useEffect(() => {
    if (transitionPhase === "hold") {
      const t = setTimeout(() => setTransitionPhase("flying"), 220);
      return () => clearTimeout(t);
    }

    if (transitionPhase === "flying") {
      playWhoosh();
      const t = setTimeout(() => setTransitionPhase("reveal"), 1300);
      return () => clearTimeout(t);
    }

    if (transitionPhase === "reveal") {
      const t = setTimeout(() => navigate("/"), 180);
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
    isTransitioning.current = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      isTransitioning.current = false;
      // Flash eyes red
      setErrorFlash(true);
      setTimeout(() => setErrorFlash(false), 1500);
    } else {
      // Start cinematic transition while keeping auth background visible
      setTransitionPhase("hold");
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
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="absolute left-1/2 top-1/2 flex items-center justify-center"
              style={{ x: "-50%", y: "-50%" }}
              initial={{ scale: 1, y: -190, opacity: 1, rotate: 0 }}
              animate={
                transitionPhase === "flying"
                  ? { scale: [1, 1.15, 1.3, 8], y: [-190, -60, 0, 0], opacity: [1, 1, 1, 0], rotate: [0, -3, 2, 0] }
                  : transitionPhase === "reveal"
                    ? { scale: 8, y: 0, opacity: 0, rotate: 0 }
                    : { scale: 1, y: -190, opacity: 1, rotate: 0 }
              }
              transition={{
                duration: 1.4,
                ease: [0.16, 1, 0.3, 1],
                times: [0, 0.25, 0.45, 1],
              }}
            >
              {/* Pulsing glow ring */}
              <motion.div
                className="absolute w-72 h-72 rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(200 100% 65% / 0.5) 0%, hsl(220 80% 55% / 0.15) 45%, transparent 70%)",
                  filter: "blur(30px)",
                }}
                animate={
                  transitionPhase === "flying"
                    ? { scale: [0.8, 1.6, 3.5], opacity: [0.7, 0.5, 0] }
                    : { scale: 0.8, opacity: 0.5 }
                }
                transition={{ duration: 1.4, ease: "easeOut" }}
              />
              {/* Secondary outer glow ring */}
              <motion.div
                className="absolute w-[28rem] h-[28rem] rounded-full"
                style={{
                  background: "radial-gradient(circle, hsl(260 80% 60% / 0.2) 0%, transparent 60%)",
                  filter: "blur(50px)",
                }}
                animate={
                  transitionPhase === "flying"
                    ? { scale: [0.6, 1.2, 4], opacity: [0.4, 0.3, 0] }
                    : { scale: 0.6, opacity: 0.3 }
                }
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.05 }}
              />
              {/* Owl image with dynamic glow */}
              <motion.img
                src={owlMascot}
                alt="Trackify Owl Flying"
                className="w-44 h-44 object-contain relative z-10"
                animate={
                  transitionPhase === "flying"
                    ? { filter: [
                        "drop-shadow(0 0 30px hsl(200 100% 60% / 0.4))",
                        "drop-shadow(0 0 60px hsl(200 100% 60% / 0.7)) drop-shadow(0 0 120px hsl(260 80% 60% / 0.4))",
                        "drop-shadow(0 0 80px hsl(200 100% 60% / 0.9)) drop-shadow(0 0 160px hsl(260 80% 60% / 0.5))",
                      ] }
                    : { filter: "drop-shadow(0 0 30px hsl(200 100% 60% / 0.4))" }
                }
                transition={{ duration: 1.4, ease: "easeOut" }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MAIN CONTENT ===== */}
      <motion.div
        className="w-full max-w-md space-y-4 relative z-10"
        animate={
          isAnimating
            ? { opacity: 1, scale: 1, y: 0, filter: "blur(2px)" }
            : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
        }
        transition={{ duration: 0.5, ease: "easeOut" }}
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
              {/* Left eye: Camera aperture that closes on sign-in */}
              <ApertureOverlay
                size="21%"
                top="27%"
                left="22%"
                closing={transitionPhase === "flying"}
                angry={errorFlash}
              />
              {/* Right eye: Glowing eye */}
              <EyeGlow size="17%" top="27%" left="53%" angry={errorFlash} />
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
                  {loading && !isAnimating ? (
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
