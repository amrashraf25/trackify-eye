import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, UserCheck, UserX, Clock, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import SendDoctorAttendanceAlert from "./SendDoctorAttendanceAlert";

const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

interface DoctorAttendanceSectionProps {
  doctorId: string;
  doctorName: string;
  doctorCourses: any[];
  userId?: string;
}

const DoctorAttendanceSection = ({ doctorId, doctorName, doctorCourses, userId }: DoctorAttendanceSectionProps) => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");

  const { data: attendance = [] } = useQuery({
    queryKey: ["doctor-attendance-records", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_attendance")
        .select("*")
        .eq("doctor_id", doctorId);
      if (error) return [];
      return data;
    },
  });

  const markAttendance = useMutation({
    mutationFn: async ({ courseId, weekNumber, status }: { courseId: string; weekNumber: number; status: string }) => {
      const existing = attendance.find(
        (a) => a.course_id === courseId && a.week_number === weekNumber
      );

      if (existing) {
        if (existing.status === status) {
          const { error } = await supabase.from("doctor_attendance").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("doctor_attendance").update({ status, marked_by: userId }).eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("doctor_attendance").insert({
          doctor_id: doctorId,
          course_id: courseId,
          week_number: weekNumber,
          status,
          marked_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-attendance-records", doctorId] });
    },
  });

  // Filter records
  const filteredRecords = selectedCourseId !== "all"
    ? attendance.filter((a) => a.course_id === selectedCourseId)
    : attendance;

  const weekFilteredRecords = selectedWeek !== "all"
    ? filteredRecords.filter((a) => a.week_number === parseInt(selectedWeek))
    : filteredRecords;

  // Stats
  const totalRecords = filteredRecords.length;
  const presentCount = filteredRecords.filter((a) => a.status === "present").length;
  const absentCount = filteredRecords.filter((a) => a.status === "absent").length;
  const lateCount = filteredRecords.filter((a) => a.status === "late").length;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  const selectedCourseName = selectedCourseId !== "all"
    ? doctorCourses.find(c => c.id === selectedCourseId)?.name
    : null;

  const progressColor = attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-destructive";
  const scoreColor = attendanceRate >= 80 ? "text-emerald-500" : attendanceRate >= 60 ? "text-amber-500" : "text-destructive";

  const handleReset = async () => {
    if (selectedCourseId !== "all") {
      await supabase.from("doctor_attendance").delete().eq("doctor_id", doctorId).eq("course_id", selectedCourseId);
    } else {
      await supabase.from("doctor_attendance").delete().eq("doctor_id", doctorId);
    }
    queryClient.invalidateQueries({ queryKey: ["doctor-attendance-records", doctorId] });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          {selectedCourseName ? `Attendance — ${selectedCourseName}` : "Attendance"}
        </h3>
        <div className="flex items-center gap-2">
          <SendDoctorAttendanceAlert doctorId={doctorId} doctorName={doctorName} attendanceRate={attendanceRate} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-xl">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Attendance</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete {selectedCourseName ? `attendance records for ${selectedCourseName}` : "all attendance records"} for <strong>{doctorName}</strong>. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Course filter */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter by Course</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant={selectedCourseId === "all" ? "default" : "outline"} className="rounded-lg text-xs h-7 px-2" onClick={() => setSelectedCourseId("all")}>
            All
          </Button>
          {doctorCourses.map((c) => (
            <Button key={c.id} size="sm" variant={selectedCourseId === c.id ? "default" : "outline"} className="rounded-lg text-xs h-7 px-2" onClick={() => setSelectedCourseId(c.id)}>
              {c.course_code}
            </Button>
          ))}
        </div>
      </div>

      {/* Week filter */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {WEEKS.map((w) => {
          const weekRecords = selectedCourseId !== "all"
            ? attendance.filter((r) => r.week_number === w && r.course_id === selectedCourseId)
            : attendance.filter((r) => r.week_number === w);
          const hasPresent = weekRecords.some(r => r.status === "present");
          const hasAbsent = weekRecords.some(r => r.status === "absent");
          const hasLate = weekRecords.some(r => r.status === "late");
          const isActive = selectedWeek === String(w);
          const bgClass = isActive
            ? "ring-2 ring-primary bg-primary/20 text-primary"
            : weekRecords.length > 0
              ? hasAbsent
                ? "bg-destructive/20 text-destructive"
                : hasLate
                  ? "bg-amber-500/20 text-amber-500"
                  : "bg-emerald-500/20 text-emerald-500"
              : "bg-secondary/40 text-muted-foreground";
          return (
            <button
              key={w}
              onClick={() => setSelectedWeek(isActive ? "all" : String(w))}
              className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${bgClass}`}
            >
              W{w}
            </button>
          );
        })}
      </div>

      {/* Score display */}
      <div className="flex items-center gap-4 mb-5 p-4 bg-secondary/30 rounded-xl">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {selectedCourseName ? `${selectedCourseName} Rate` : selectedWeek !== "all" ? `Week ${selectedWeek} Rate` : "Overall Attendance Rate"}
          </p>
          <div className="flex items-center gap-3">
            <div className="relative h-2 flex-1 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${attendanceRate}%` }} />
            </div>
            <span className={`text-xl font-bold ${scoreColor}`}>{attendanceRate}%</span>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><UserCheck className="w-3 h-3 text-emerald-500" /> {presentCount} Present</span>
            <span className="flex items-center gap-1"><UserX className="w-3 h-3 text-destructive" /> {absentCount} Absent</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> {lateCount} Late</span>
          </div>
        </div>
      </div>

      {/* Per-week attendance marking (when a specific course + week is selected) */}
      {selectedCourseId !== "all" && selectedWeek !== "all" && (
        <div className="mb-4 p-4 bg-secondary/20 border border-border/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Week {selectedWeek} Status:</span>
              {(() => {
                const record = attendance.find(
                  (a) => a.course_id === selectedCourseId && a.week_number === parseInt(selectedWeek)
                );
                return record ? (
                  <span className={`text-xs font-bold capitalize ${
                    record.status === "present" ? "text-emerald-500"
                    : record.status === "absent" ? "text-destructive"
                    : "text-amber-500"
                  }`}>
                    {record.status}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Not marked</span>
                );
              })()}
            </div>
            <div className="flex items-center gap-1.5">
              {(["present", "absent", "late"] as const).map((status) => {
                const record = attendance.find(
                  (a) => a.course_id === selectedCourseId && a.week_number === parseInt(selectedWeek)
                );
                const isActive = record?.status === status;
                const Icon = status === "present" ? UserCheck : status === "absent" ? UserX : Clock;
                const activeClass = status === "present"
                  ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40"
                  : status === "absent"
                  ? "bg-destructive/20 text-destructive ring-1 ring-destructive/40"
                  : "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/40";
                return (
                  <button
                    key={status}
                    onClick={() => markAttendance.mutate({ courseId: selectedCourseId, weekNumber: parseInt(selectedWeek), status })}
                    className={`p-2 rounded-lg transition-all ${isActive ? activeClass : "text-muted-foreground hover:bg-secondary/50"}`}
                    title={status.charAt(0).toUpperCase() + status.slice(1)}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {weekFilteredRecords.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {weekFilteredRecords.map((record: any) => {
            const course = doctorCourses.find(c => c.id === record.course_id);
            return (
              <div key={record.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl hover:bg-secondary/40 transition-colors">
                {record.status === "present" ? (
                  <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : record.status === "absent" ? (
                  <UserX className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize">{record.status}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Week {record.week_number ?? "—"} • {course?.course_code ?? "Unknown"} • {new Date(record.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {selectedCourseId !== "all" || selectedWeek !== "all" ? "No attendance records for this filter" : "No attendance records yet"}
        </p>
      )}
    </motion.div>
  );
};

export default DoctorAttendanceSection;
