import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import {
  BookOpen, AlertTriangle, Users, TrendingUp, Stethoscope,
  ClipboardCheck, ChevronLeft, ChevronRight, TrendingDown, Plus,
  UserCheck, UserX, Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";

const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

const DeanDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [behaviorOpen, setBehaviorOpen] = useState(false);
  const [selectedDoctorForBehavior, setSelectedDoctorForBehavior] = useState("");
  const [behaviorAction, setBehaviorAction] = useState({ action_name: "", action_type: "negative", score_change: "-5", notes: "" });

  // Counts for metrics
  const { data: studentsCount = 0 } = useQuery({
    queryKey: ["dean-students-count"],
    queryFn: async () => {
      const { count } = await supabase.from("students").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: coursesCount = 0 } = useQuery({
    queryKey: ["dean-courses-count"],
    queryFn: async () => {
      const { count } = await supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "active");
      return count || 0;
    },
  });

  const { data: incidentsCount = 0 } = useQuery({
    queryKey: ["dean-incidents-count"],
    queryFn: async () => {
      const { count } = await supabase.from("incidents").select("*", { count: "exact", head: true }).eq("status", "active");
      return count || 0;
    },
  });

  // Doctors
  const { data: doctors = [] } = useQuery({
    queryKey: ["dean-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "doctor").order("full_name");
      if (error) return [];
      return data;
    },
  });

  // Courses for doctor attendance
  const { data: courses = [] } = useQuery({
    queryKey: ["dean-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("status", "active");
      if (error) return [];
      return data;
    },
  });

  // Doctor attendance records
  const { data: doctorAttendance = [] } = useQuery({
    queryKey: ["dean-doctor-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_attendance").select("*").order("date", { ascending: false });
      if (error) return [];
      return data;
    },
  });

  // Doctor behavior scores
  const { data: doctorBehaviorScores = [] } = useQuery({
    queryKey: ["dean-doctor-behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_behavior_scores").select("*");
      if (error) return [];
      return data;
    },
  });

  // Doctor behavior records
  const { data: doctorBehaviorRecords = [] } = useQuery({
    queryKey: ["dean-doctor-behavior-records"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_behavior_records").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) return [];
      return data;
    },
  });

  // Mark doctor attendance
  const markAttendance = useMutation({
    mutationFn: async ({ doctorId, courseId, status }: { doctorId: string; courseId: string; status: string }) => {
      // Check existing
      const { data: existing } = await supabase
        .from("doctor_attendance")
        .select("id, status")
        .eq("doctor_id", doctorId)
        .eq("week_number", selectedWeek)
        .eq("course_id", courseId)
        .maybeSingle();

      if (existing) {
        if (existing.status === status) {
          const { error } = await supabase.from("doctor_attendance").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("doctor_attendance").update({ status, marked_by: user?.id }).eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("doctor_attendance").insert({
          doctor_id: doctorId,
          course_id: courseId,
          week_number: selectedWeek,
          status,
          marked_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dean-doctor-attendance"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Add doctor behavior record
  const addBehaviorRecord = useMutation({
    mutationFn: async () => {
      if (!selectedDoctorForBehavior || !behaviorAction.action_name) throw new Error("Select doctor and action");
      const scoreChange = parseInt(behaviorAction.score_change);
      if (isNaN(scoreChange)) throw new Error("Invalid score change");

      const { error } = await supabase.from("doctor_behavior_records").insert({
        doctor_id: selectedDoctorForBehavior,
        recorded_by: user?.id!,
        action_name: behaviorAction.action_name,
        action_type: behaviorAction.action_type,
        score_change: scoreChange,
        notes: behaviorAction.notes || null,
        week_number: selectedWeek,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dean-doctor-behavior-scores"] });
      queryClient.invalidateQueries({ queryKey: ["dean-doctor-behavior-records"] });
      toast.success("Behavior record added");
      setBehaviorOpen(false);
      setBehaviorAction({ action_name: "", action_type: "negative", score_change: "-5", notes: "" });
      setSelectedDoctorForBehavior("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getDoctorAttendanceForWeek = (doctorId: string, courseId: string) => {
    return doctorAttendance.find(
      (a) => a.doctor_id === doctorId && a.course_id === courseId && a.week_number === selectedWeek
    );
  };

  const getDoctorScore = (doctorId: string) => {
    const entry = doctorBehaviorScores.find((s: any) => s.doctor_id === doctorId);
    return entry ? (entry as any).score : 100;
  };

  const getScoreColor = (s: number) => s >= 80 ? "text-emerald-500" : s >= 60 ? "text-amber-500" : "text-destructive";
  const getProgressColor = (s: number) => s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-amber-500" : "bg-destructive";

  return (
    <MainLayout title="Dean Dashboard">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-neon-cyan/10 p-6 neon-border"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Welcome back, {user?.user_metadata?.full_name || "Dean"} 👋
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} across {coursesCount} courses.
            </p>
          </div>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Courses" value={coursesCount} icon={BookOpen} color="primary" index={0} linkTo="/courses" />
          <MetricCard title="Total Doctors" value={doctors.length} icon={Stethoscope} color="info" index={1} linkTo="/doctors" />
          <MetricCard title="Total Students" value={studentsCount} icon={Users} color="success" index={2} linkTo="/students" />
          <MetricCard title="Active Alerts" value={incidentsCount} icon={AlertTriangle} color="warning" index={3} linkTo="/alerts" />
        </div>

        {/* Doctor Attendance Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              Doctor Attendance
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={selectedWeek <= 1}
                onClick={() => setSelectedWeek((w) => w - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-bold text-foreground min-w-[60px] text-center">Week {selectedWeek}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={selectedWeek >= 16}
                onClick={() => setSelectedWeek((w) => w + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {doctors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No doctors found.</p>
          ) : (
            <div className="space-y-3">
              {doctors.map((doctor: any, i: number) => {
                const doctorCourses = courses.filter((c: any) => c.doctor_id === doctor.id);
                return (
                  <motion.div
                    key={doctor.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={doctor.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {doctor.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{doctor.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{doctorCourses.length} course{doctorCourses.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>

                    {doctorCourses.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-12">No courses assigned</p>
                    ) : (
                      <div className="space-y-2 pl-12">
                        {doctorCourses.map((course: any) => {
                          const record = getDoctorAttendanceForWeek(doctor.id, course.id);
                          return (
                            <div key={course.id} className="flex items-center justify-between">
                              <p className="text-xs text-foreground font-medium">{course.name} <span className="text-muted-foreground font-mono">({course.course_code})</span></p>
                              <div className="flex items-center gap-1">
                                {["present", "absent", "late"].map((status) => {
                                  const isActive = record?.status === status;
                                  const Icon = status === "present" ? UserCheck : status === "absent" ? UserX : Clock;
                                  const color = status === "present" ? "bg-emerald-500/20 text-emerald-500 ring-emerald-500/40" :
                                    status === "absent" ? "bg-destructive/20 text-destructive ring-destructive/40" :
                                    "bg-amber-500/20 text-amber-500 ring-amber-500/40";
                                  return (
                                    <button
                                      key={status}
                                      onClick={() => markAttendance.mutate({ doctorId: doctor.id, courseId: course.id, status })}
                                      className={`p-1.5 rounded-lg transition-all ${isActive ? `${color} ring-1` : "text-muted-foreground hover:bg-secondary/50"}`}
                                      title={status}
                                    >
                                      <Icon className="w-3.5 h-3.5" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Doctor Behavior Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-destructive" />
              Doctor Behavior Scores
            </h3>
            <Dialog open={behaviorOpen} onOpenChange={setBehaviorOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Plus className="w-4 h-4 mr-1" /> Record Behavior
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader><DialogTitle>Record Doctor Behavior</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Doctor</Label>
                    <Select value={selectedDoctorForBehavior} onValueChange={setSelectedDoctorForBehavior}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select doctor..." /></SelectTrigger>
                      <SelectContent>
                        {doctors.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action</Label>
                    <Input value={behaviorAction.action_name}
                      onChange={(e) => setBehaviorAction({ ...behaviorAction, action_name: e.target.value })}
                      placeholder="e.g. Late to class, Excellent teaching..."
                      className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select value={behaviorAction.action_type}
                        onValueChange={(v) => setBehaviorAction({ ...behaviorAction, action_type: v, score_change: v === "positive" ? "5" : "-5" })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">Positive</SelectItem>
                          <SelectItem value="negative">Negative</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Score Change</Label>
                      <Input type="number" value={behaviorAction.score_change}
                        onChange={(e) => setBehaviorAction({ ...behaviorAction, score_change: e.target.value })}
                        className="rounded-xl" />
                    </div>
                  </div>
                  <div>
                    <Label>Notes (optional)</Label>
                    <Textarea value={behaviorAction.notes}
                      onChange={(e) => setBehaviorAction({ ...behaviorAction, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="rounded-xl" />
                  </div>
                  <Button onClick={() => addBehaviorRecord.mutate()} className="w-full rounded-xl">
                    Submit Record
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {doctors.map((doctor: any, i: number) => {
              const score = getDoctorScore(doctor.id);
              const recentRecords = doctorBehaviorRecords.filter((r: any) => r.doctor_id === doctor.id).slice(0, 3);
              return (
                <motion.div
                  key={doctor.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={doctor.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {doctor.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{doctor.full_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="relative h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full ${getProgressColor(score)}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${getScoreColor(score)}`}>{score}%</span>
                      </div>
                    </div>
                  </div>
                  {recentRecords.length > 0 && (
                    <div className="mt-3 pl-12 space-y-1">
                      {recentRecords.map((r: any) => (
                        <div key={r.id} className="flex items-center gap-2 text-[10px]">
                          {r.action_type === "positive" ? (
                            <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-destructive shrink-0" />
                          )}
                          <span className="text-muted-foreground truncate">{r.action_name}</span>
                          <span className={r.score_change > 0 ? "text-emerald-500" : "text-destructive"}>
                            {r.score_change > 0 ? "+" : ""}{r.score_change}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Standard charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceChart />
          <BehaviorPieChart />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentCourses />
          <GradesComposition />
        </div>
      </div>
    </MainLayout>
  );
};

export default DeanDashboard;
