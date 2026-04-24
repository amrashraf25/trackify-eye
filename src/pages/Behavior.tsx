import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, User, TrendingDown, TrendingUp, Plus, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import SendBehaviorAlert from "@/components/SendBehaviorAlert";

const LOCAL_API = "http://localhost:3001";

const negativeActions = [
  { name: "Smoking during lecture", change: -15 },
  { name: "Disrespectful behavior", change: -10 },
  { name: "Skipping class", change: -5 },
  { name: "Using phone in class", change: -5 },
  { name: "Cheating", change: -20 },
  { name: "Fighting", change: -25 },
  { name: "Sleeping in class", change: -5 },
];

const positiveActions = [
  { name: "Writing notes", change: 5 },
  { name: "Participating in class", change: 5 },
  { name: "Helping classmates", change: 10 },
  { name: "Excellent homework", change: 5 },
  { name: "Leadership in project", change: 10 },
];

const weeks = Array.from({ length: 16 }, (_, i) => i + 1);

const Behavior = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"positive" | "negative">("negative");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("none");
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [recordWeek, setRecordWeek] = useState<string>("1");
  const [notes, setNotes] = useState("");

  const { data: students = [] } = useQuery({
    queryKey: ["behavior-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_scores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["behavior-courses"],
    queryFn: async () => {
      // No status filter — courses table has no status column in local-api
      const { data, error } = await supabase.from("courses").select("id, name, code");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch behavior logs for selected student via local-api analytics
  const { data: behaviorProfile } = useQuery({
    queryKey: ["behavior-profile", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const r = await fetch(`${LOCAL_API}/api/analytics/student/${selectedStudentId}/behavior`);
      return r.ok ? r.json() : null;
    },
    enabled: !!selectedStudentId,
  });

  // Fetch raw behavior logs per student (from behavior_logs table via REST)
  const { data: allRecords = [] } = useQuery({
    queryKey: ["behavior-all-records", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("id, student_id, course_id, week_number, behavior_type, severity, started_at, duration_sec, notes")
        .eq("student_id", selectedStudentId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      // Normalize shape to match what the UI expects
      return (data ?? []).map((record: any) => ({
        id: record.id,
        student_id: record.student_id,
        course_id: record.course_id,
        week_number: record.week_number ?? 1,
        action_type: record.severity === "low" ? "positive" : "negative",
        action_name: record.behavior_type,
        score_change: record.severity === "critical" ? -20 : record.severity === "high" ? -10 : record.severity === "medium" ? -5 : -2,
        notes: record.notes,
        created_at: record.started_at,
      }));
    },
    enabled: !!selectedStudentId,
  });

  const recordBehavior = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId || !selectedAction) throw new Error("Select a student and action");
      const actions = actionType === "positive" ? positiveActions : negativeActions;
      const action = actions.find((a) => a.name === selectedAction);
      if (!action) throw new Error("Invalid action");

      // Map action change to severity for behavior_logs
      const absDelta = Math.abs(action.change);
      const severity = absDelta >= 20 ? "critical" : absDelta >= 10 ? "high" : absDelta >= 5 ? "medium" : "low";

      // Insert into behavior_logs (the real local-api table)
      const { error } = await supabase.from("behavior_logs").insert({
        student_id: selectedStudentId,
        course_id: selectedCourse !== "none" ? selectedCourse : null,
        behavior_type: action.name,
        severity,
        week_number: parseInt(recordWeek),
        notes: (notes || null) as string | null,
        frame_count: 1,
        confidence: 1.0,
      });
      if (error) throw error;

      // Update behavior score in behavior_scores
      const currentScore = getScore(selectedStudentId);
      const newScore = Math.min(100, Math.max(0, currentScore + action.change));
      await supabase.from("behavior_scores").upsert({
        student_id: selectedStudentId,
        score: newScore,
        updated_at: new Date().toISOString(),
      }, { onConflict: "student_id" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["behavior-scores"] });
      queryClient.invalidateQueries({ queryKey: ["behavior-all-records"] });
      queryClient.invalidateQueries({ queryKey: ["behavior-profile"] });
      toast.success("Behavior recorded");
      setDialogOpen(false);
      setSelectedAction("");
      setNotes("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getScore = (studentId: string) => scores.find((s) => s.student_id === studentId)?.score ?? 100;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-destructive";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-destructive";
  };

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.student_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowBehaviorStudents = students.filter((s) => getScore(s.id) < 60);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Group records by week
  const getWeekRecords = (week: number) => allRecords.filter((r) => r.week_number === week);
  const activeWeekRecords = getWeekRecords(activeWeek);

  // Get week summary stats
  const getWeekSummary = (week: number) => {
    const records = getWeekRecords(week);
    const positive = records.filter((r) => r.action_type === "positive").length;
    const negative = records.filter((r) => r.action_type === "negative").length;
    const totalChange = records.reduce((sum, r) => sum + r.score_change, 0);
    return { positive, negative, totalChange, total: records.length };
  };

  return (
    <MainLayout title="Behavior Tracking">
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-br from-slate-50 via-amber-50/50 to-slate-100 dark:from-[hsl(228,35%,8%)] dark:via-[hsl(225,30%,6%)] dark:to-[hsl(230,35%,7%)]"
        >
          <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-25" style={{
            backgroundImage: "linear-gradient(hsl(38 92% 50% / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(38 92% 50% / 0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-amber-500/8 blur-[80px] pointer-events-none" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 font-bold">AI Monitoring</span>
                  <h1 className="text-xl font-black text-foreground tracking-tight">Behavior Tracking</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">{students.length} students · {lowBehaviorStudents.length} at risk</p>
                </div>
              </div>

              {/* Risk summary pills */}
              <div className="flex items-center gap-2">
                {[
                  { label: "Excellent", count: students.filter(s => getScore(s.id) >= 80).length, cls: "bg-emerald-500/12 border-emerald-500/25 text-emerald-400" },
                  { label: "Average", count: students.filter(s => getScore(s.id) >= 60 && getScore(s.id) < 80).length, cls: "bg-amber-500/12 border-amber-500/25 text-amber-400" },
                  { label: "At Risk", count: lowBehaviorStudents.length, cls: "bg-red-500/12 border-red-500/25 text-red-400" },
                ].map(pill => (
                  <div key={pill.label} className={`px-3 py-2 rounded-xl border text-xs font-semibold ${pill.cls}`}>
                    <span className="font-black text-base tabular-nums mr-1">{pill.count}</span>
                    {pill.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="lg:col-span-1 space-y-4">
          {lowBehaviorStudents.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 border border-destructive/20 rounded-2xl p-3 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-foreground">
                <span className="font-bold">{lowBehaviorStudents.length}</span> student(s) below 60% — needs attention
              </p>
            </motion.div>
          )}

          <div className="glass rounded-2xl p-4 border border-border/50">
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-11 rounded-xl bg-secondary/40 border-white/[0.08]" />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredStudents.map((student, idx) => {
                const score = getScore(student.id);
                const riskLevel = score >= 80 ? "low" : score >= 60 ? "medium" : "high";
                const riskColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
                const initials = student.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      selectedStudentId === student.id
                        ? "bg-primary/10 ring-1 ring-primary/30 shadow-[0_0_12px_hsl(217_91%_60%/0.1)]"
                        : "bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border-2"
                          style={{ borderColor: `${riskColor}40` }}>
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold"
                              style={{ background: `${riskColor}20`, color: riskColor }}>
                              {initials}
                            </div>
                          )}
                        </div>
                        {/* Risk indicator dot */}
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
                          style={{ background: riskColor, boxShadow: `0 0 6px ${riskColor}80` }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{student.full_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{student.student_code}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black tabular-nums" style={{ color: riskColor }}>{score}%</span>
                        <p className="text-[8px] uppercase tracking-wider font-bold" style={{ color: riskColor, opacity: 0.7 }}>
                          {riskLevel === "high" ? "AT RISK" : riskLevel === "medium" ? "CAUTION" : "GOOD"}
                        </p>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden mt-2">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ delay: 0.1 + idx * 0.02, duration: 0.6 }}
                        style={{ background: `linear-gradient(90deg, ${riskColor}aa, ${riskColor})`, boxShadow: `0 0 6px ${riskColor}50` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Week Timeline & Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedStudent ? (
            <>
              {/* Student Header + Record Button */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-primary/20">
                      {selectedStudent.avatar_url ? (
                        <img src={selectedStudent.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <User className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{selectedStudent.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedStudent.student_code}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className={`text-3xl font-bold ${getScoreColor(getScore(selectedStudent.id))}`}>{getScore(selectedStudent.id)}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Score</p>
                    {behaviorProfile && (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {behaviorProfile.history?.phone    > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">Phone ×{behaviorProfile.history.phone}</span>}
                        {behaviorProfile.history?.sleeping > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Sleep ×{behaviorProfile.history.sleeping}</span>}
                        {behaviorProfile.history?.talking  > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Talk ×{behaviorProfile.history.talking}</span>}
                        {behaviorProfile.history?.fighting > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Fight ×{behaviorProfile.history.fighting}</span>}
                        {behaviorProfile.history?.cheating > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Cheat ×{behaviorProfile.history.cheating}</span>}
                      </div>
                    )}
                    {getScore(selectedStudent.id) < 60 && (
                      <SendBehaviorAlert
                        studentId={selectedStudent.id}
                        studentName={selectedStudent.full_name}
                        score={getScore(selectedStudent.id)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Week Navigation */}
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-primary" />
                    16-Week Timeline
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setActiveWeek(Math.max(1, activeWeek - 1))} disabled={activeWeek === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-bold text-foreground min-w-[70px] text-center">Week {activeWeek}</span>
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setActiveWeek(Math.min(16, activeWeek + 1))} disabled={activeWeek === 16}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Week pills */}
                <div className="grid grid-cols-8 gap-1.5 mb-4">
                  {weeks.map((w) => {
                    const summary = getWeekSummary(w);
                    const hasRecords = summary.total > 0;
                    const isActive = w === activeWeek;
                    return (
                      <button
                        key={w}
                        onClick={() => setActiveWeek(w)}
                        className={`relative p-2 rounded-lg text-xs font-bold transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-glow-primary"
                            : hasRecords
                            ? summary.totalChange >= 0
                              ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                            : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                        }`}
                      >
                        W{w}
                        {hasRecords && !isActive && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Week Summary */}
                {(() => {
                  const summary = getWeekSummary(activeWeek);
                  return (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-secondary/30 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-foreground">{summary.total}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Records</p>
                      </div>
                      <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-emerald-500">+{summary.positive}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Positive</p>
                      </div>
                      <div className="bg-destructive/10 rounded-xl p-3 text-center">
                        <p className="text-lg font-bold text-destructive">{summary.negative}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Negative</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Week Records */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {activeWeekRecords.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-8 text-muted-foreground"
                      >
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No behavior records for Week {activeWeek}</p>
                      </motion.div>
                    ) : (
                      activeWeekRecords.map((record, i) => (
                        <motion.div
                          key={record.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-3 text-sm p-3 rounded-xl bg-secondary/30"
                        >
                          {record.action_type === "positive" ? (
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <TrendingUp className="w-4 h-4 text-emerald-500" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                              <TrendingDown className="w-4 h-4 text-destructive" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground capitalize">{record.action_name?.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className={record.score_change > 0 ? "text-emerald-500" : "text-destructive"}>
                                {record.score_change > 0 ? "+" : ""}{record.score_change}pts
                              </span>
                              {" • "}{record.created_at ? format(new Date(record.created_at), "MMM dd, HH:mm") : "—"}
                            </p>
                            {record.notes && <p className="text-xs text-muted-foreground/70 mt-1 italic">{record.notes}</p>}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Record Behavior Button */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 h-12 text-sm font-semibold">
                    <Plus className="w-5 h-5 mr-2" />Record Behavior for {selectedStudent.full_name}
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass">
                  <DialogHeader>
                    <DialogTitle>Record Behavior — {selectedStudent.full_name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Type</Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          size="sm"
                          variant={actionType === "negative" ? "destructive" : "outline"}
                          onClick={() => { setActionType("negative"); setSelectedAction(""); }}
                          className="flex-1"
                        >
                          <TrendingDown className="w-4 h-4 mr-1" />Negative
                        </Button>
                        <Button
                          size="sm"
                          variant={actionType === "positive" ? "default" : "outline"}
                          onClick={() => { setActionType("positive"); setSelectedAction(""); }}
                          className="flex-1"
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />Positive
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Action</Label>
                      <Select value={selectedAction} onValueChange={setSelectedAction}>
                        <SelectTrigger><SelectValue placeholder="Select action..." /></SelectTrigger>
                        <SelectContent>
                          {(actionType === "positive" ? positiveActions : negativeActions).map((a) => (
                            <SelectItem key={a.name} value={a.name}>
                              {a.name} ({a.change > 0 ? "+" : ""}{a.change}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Course (optional)</Label>
                      <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No course</SelectItem>
                          {courses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Week</Label>
                      <Select value={recordWeek} onValueChange={setRecordWeek}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {weeks.map((w) => (
                            <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." />
                    </div>
                    <Button onClick={() => recordBehavior.mutate()} disabled={!selectedAction} className="w-full rounded-xl">
                      Submit
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
              <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Select a student to view their weekly behavior</p>
              <p className="text-xs mt-1">Track behavior across all 16 weeks of the semester</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </MainLayout>
  );
};

export default Behavior;
