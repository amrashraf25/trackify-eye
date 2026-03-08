import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, User, TrendingDown, TrendingUp, Plus, History, AlertTriangle, Calendar, ChevronLeft, ChevronRight, Send } from "lucide-react";
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
      const { data, error } = await supabase.from("courses").select("*").eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL records for the selected student (for week timeline)
  const { data: allRecords = [] } = useQuery({
    queryKey: ["behavior-all-records", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const { data, error } = await supabase
        .from("behavior_records")
        .select("*")
        .eq("student_id", selectedStudentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStudentId,
  });

  const recordBehavior = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId || !selectedAction) throw new Error("Select a student and action");
      const actions = actionType === "positive" ? positiveActions : negativeActions;
      const action = actions.find((a) => a.name === selectedAction);
      if (!action) throw new Error("Invalid action");

      const { error } = await supabase.from("behavior_records").insert({
        student_id: selectedStudentId,
        course_id: selectedCourse !== "none" ? selectedCourse : null,
        recorded_by: user?.id!,
        action_type: actionType,
        action_name: action.name,
        score_change: action.change,
        notes: notes || null,
        week_number: parseInt(recordWeek),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["behavior-scores"] });
      queryClient.invalidateQueries({ queryKey: ["behavior-all-records"] });
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="lg:col-span-1 space-y-4">
          {lowBehaviorStudents.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-foreground">
                <span className="font-semibold">{lowBehaviorStudents.length}</span> student(s) below 60%
              </p>
            </div>
          )}

          <div className="glass rounded-2xl p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-secondary/50 border-border/50" />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredStudents.map((student) => {
                const score = getScore(student.id);
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      selectedStudentId === student.id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <User className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{student.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{student.student_code}</p>
                      </div>
                      <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
                    </div>
                    <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden mt-2">
                      <div className={`h-full rounded-full transition-all ${getProgressColor(score)}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
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
                            <p className="font-medium text-foreground">{record.action_name}</p>
                            <p className="text-xs text-muted-foreground">
                              <span className={record.score_change > 0 ? "text-emerald-500" : "text-destructive"}>
                                {record.score_change > 0 ? "+" : ""}{record.score_change}%
                              </span>
                              {" • "}{format(new Date(record.created_at), "MMM dd, HH:mm")}
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
    </MainLayout>
  );
};

export default Behavior;
