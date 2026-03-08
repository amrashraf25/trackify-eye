import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, User, TrendingDown, TrendingUp, Plus, History, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
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

  const { data: history = [] } = useQuery({
    queryKey: ["behavior-history", selectedStudentId, selectedWeek],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      let query = supabase
        .from("behavior_records")
        .select("*")
        .eq("student_id", selectedStudentId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (selectedWeek !== "all") {
        query = query.eq("week_number", parseInt(selectedWeek));
      }
      const { data, error } = await query;
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["behavior-scores"] });
      queryClient.invalidateQueries({ queryKey: ["behavior-history"] });
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

  return (
    <MainLayout title="Behavior Tracking">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Alert for low behavior */}
          {lowBehaviorStudents.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{lowBehaviorStudents.length} student(s)</span> have behavior score below 60%
              </p>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredStudents.map((student) => {
                const score = getScore(student.id);
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedStudentId === student.id ? "bg-primary/10 border border-primary/30" : "bg-secondary/50 hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">{student.student_code}</p>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getProgressColor(score)}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedStudent ? (
            <>
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedStudent.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedStudent.student_code}</p>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <p className={`text-4xl font-bold ${getScoreColor(getScore(selectedStudent.id))}`}>{getScore(selectedStudent.id)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Behavior Score</p>
                  <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden mt-2">
                    <div className={`h-full rounded-full transition-all ${getProgressColor(getScore(selectedStudent.id))}`} style={{ width: `${getScore(selectedStudent.id)}%` }} />
                  </div>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full"><Plus className="w-4 h-4 mr-2" />Record Behavior</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Behavior - {selectedStudent.full_name}</DialogTitle>
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
                        <Label>Notes (optional)</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." />
                      </div>
                      <Button onClick={() => recordBehavior.mutate()} disabled={!selectedAction} className="w-full">
                        Submit
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* History */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  Behavior History
                </h4>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No behavior records yet</p>
                  ) : (
                    history.map((record) => (
                      <div key={record.id} className="flex items-start gap-3 text-sm p-2 rounded-lg bg-secondary/30">
                        {record.action_type === "positive" ? (
                          <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{record.action_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {record.score_change > 0 ? "+" : ""}{record.score_change}% • {format(new Date(record.created_at), "MMM dd, yyyy HH:mm")}
                          </p>
                          {record.notes && <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card rounded-xl border border-border p-5 text-center text-muted-foreground">
              Select a student to view behavior details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Behavior;
