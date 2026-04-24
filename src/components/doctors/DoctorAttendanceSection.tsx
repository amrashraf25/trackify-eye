// Displays and manages attendance records for a single doctor across all their courses, with a week heatmap and inline marking.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, UserCheck, UserX, Clock, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";
import { toast } from "sonner";
import SendDoctorAttendanceAlert from "./SendDoctorAttendanceAlert";

// 16-week academic semester constant used for the heatmap grid
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

  // Toggle or set attendance status for a specific course + week combination
  const markAttendance = useMutation({
    mutationFn: async ({ courseId, weekNumber, status }: { courseId: string; weekNumber: number; status: string }) => {
      // Always fetch the latest record to avoid acting on stale React state
      const { data: freshAttendance } = await supabase
        .from("doctor_attendance")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("course_id", courseId)
        .eq("week_number", weekNumber);

      const existing = freshAttendance?.[0];

      if (existing) {
        if (existing.status === status) {
          // Clicking the same status again removes the record (toggle off)
          const { error } = await supabase.from("doctor_attendance").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          // Different status — update the existing record
          const { error } = await supabase.from("doctor_attendance").update({ status, marked_by: userId }).eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        // No existing record — insert a new one
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
      toast.success("Attendance updated");
    },
    onError: (err: any) => {
      console.error("Attendance error:", err);
      toast.error(err.message || "Failed to update attendance");
    },
  });

  // Apply course and week filters to the full attendance list
  const filteredRecords = selectedCourseId !== "all"
    ? attendance.filter((a) => a.course_id === selectedCourseId)
    : attendance;

  const weekFilteredRecords = selectedWeek !== "all"
    ? filteredRecords.filter((a) => a.week_number === parseInt(selectedWeek))
    : filteredRecords;

  // Use the most specific filter for the summary stats shown in the score card
  const statsRecords = selectedWeek !== "all" ? weekFilteredRecords : filteredRecords;
  const totalRecords = statsRecords.length;
  const presentCount = statsRecords.filter((a) => a.status === "present").length;
  const absentCount = statsRecords.filter((a) => a.status === "absent").length;
  const lateCount = statsRecords.filter((a) => a.status === "late").length;
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "hsl(225 25% 8%)" }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between"
        style={{ background: "linear-gradient(90deg, hsl(199 89% 48% / 0.07), transparent)" }}>
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(199 89% 48% / 0.15)", boxShadow: "0 0 12px hsl(199 89% 48% / 0.3)" }}>
            <ClipboardCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          {selectedCourseName ? `Attendance \u2014 ${selectedCourseName}` : "Attendance"}
        </h3>
        <div className="flex items-center gap-2">
          <SendDoctorAttendanceAlert doctorId={doctorId} doctorName={doctorName} attendanceRate={attendanceRate} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-white/25 hover:text-white/70 gap-1">
                <RotateCcw className="w-3 h-3" />Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Attendance</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete {selectedCourseName ? `attendance records for ${selectedCourseName}` : "all attendance records"} for <strong>{doctorName}</strong>.
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

      <div className="p-4 space-y-4">
        {/* Course filter pills */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />Filter by Course
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {["all", ...doctorCourses.map(c => c.id)].map((cid) => {
              const isAct = selectedCourseId === cid;
              const course = cid === "all" ? null : doctorCourses.find(c => c.id === cid);
              return (
                <button key={cid} onClick={() => setSelectedCourseId(cid)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    isAct ? "bg-sky-500 text-white shadow-[0_0_10px_hsl(199_89%_48%/0.4)]"
                           : "bg-white/[0.05] text-white/40 hover:bg-white/[0.09] hover:text-white/70"
                  }`}>
                  {cid === "all" ? "All" : course?.course_code || cid}
                </button>
              );
            })}
          </div>
        </div>

        {/* Week heatmap */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold mb-2">Week Heatmap</p>
          <div className="grid grid-cols-8 gap-1.5">
            {WEEKS.map((w) => {
              const weekRecs = selectedCourseId !== "all"
                ? attendance.filter(r => r.week_number === w && r.course_id === selectedCourseId)
                : attendance.filter(r => r.week_number === w);
              const hasAbsent = weekRecs.some(r => r.status === "absent");
              const hasLate = weekRecs.some(r => r.status === "late");
              const isActive = selectedWeek === String(w);
              const dotColor = weekRecs.length > 0 ? (hasAbsent ? "#ef4444" : hasLate ? "#f59e0b" : "#22c55e") : null;
              return (
                <motion.button key={w}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setSelectedWeek(isActive ? "all" : String(w))}
                  className="relative aspect-square rounded-lg text-[9px] font-black flex items-center justify-center transition-all"
                  style={{
                    background: isActive ? "hsl(217 91% 60%)"
                      : weekRecs.length > 0 ? (hasAbsent ? "#ef444422" : hasLate ? "#f59e0b22" : "#22c55e22")
                      : "hsl(225 20% 12%)",
                    color: isActive ? "#fff" : (dotColor ?? "hsl(218 11% 40%)"),
                    boxShadow: isActive ? "0 0 12px hsl(217 91% 60% / 0.6)" : (dotColor ? `0 0 6px ${dotColor}40` : "none"),
                  }}>
                  W{w}
                  {dotColor && !isActive && (
                    <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Score summary */}
        <div className="p-4 rounded-xl border border-white/[0.05]" style={{ background: "hsl(225 25% 6%)" }}>
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold mb-2">
            {selectedCourseName ? `${selectedCourseName} Rate` : selectedWeek !== "all" ? `Week ${selectedWeek} Rate` : "Overall Attendance Rate"}
          </p>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
              <motion.div className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${attendanceRate}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  background: attendanceRate >= 80 ? "#22c55e" : attendanceRate >= 60 ? "#f59e0b" : "#ef4444",
                  boxShadow: `0 0 8px ${attendanceRate >= 80 ? "#22c55e" : attendanceRate >= 60 ? "#f59e0b" : "#ef4444"}80`,
                }} />
            </div>
            <span className="text-xl font-black tabular-nums"
              style={{ color: attendanceRate >= 80 ? "#22c55e" : attendanceRate >= 60 ? "#f59e0b" : "#ef4444" }}>
              {attendanceRate}%
            </span>
          </div>
          <div className="flex gap-4 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-400"><UserCheck className="w-3 h-3" />{presentCount} Present</span>
            <span className="flex items-center gap-1 text-red-400"><UserX className="w-3 h-3" />{absentCount} Absent</span>
            <span className="flex items-center gap-1 text-amber-400"><Clock className="w-3 h-3" />{lateCount} Late</span>
          </div>
          {selectedCourseId === "all" && doctorCourses.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold">Per Course</p>
              {doctorCourses.map((course) => {
                let cr = attendance.filter((a: any) => a.course_id === course.id);
                if (selectedWeek !== "all") cr = cr.filter((a: any) => a.week_number === parseInt(selectedWeek));
                const cp = cr.filter((a: any) => a.status === "present").length;
                const ct = cr.length;
                const rate = ct > 0 ? Math.round((cp / ct) * 100) : 0;
                const cc = ct === 0 ? "hsl(218 11% 35%)" : rate >= 80 ? "#22c55e" : rate >= 60 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={course.id} className="flex items-center gap-3 p-2 rounded-lg border border-white/[0.04]" style={{ background: "hsl(225 25% 7%)" }}>
                    <span className="text-[10px] font-bold text-white/60 w-14 flex-shrink-0 font-mono">{course.course_code}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: cc }} />
                    </div>
                    <span className="text-[10px] font-black w-10 text-right flex-shrink-0" style={{ color: cc }}>
                      {ct > 0 ? `${rate}%` : "\u2014"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inline marking when course + week selected */}
        {selectedCourseId !== "all" && selectedWeek !== "all" && (
          <div className="p-4 rounded-xl border border-white/[0.06]" style={{ background: "hsl(225 25% 6%)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Week {selectedWeek}:</span>
                {(() => {
                  const rec = attendance.find((a: any) => a.course_id === selectedCourseId && a.week_number === parseInt(selectedWeek));
                  return rec ? (
                    <span className={`text-xs font-bold capitalize ${
                      rec.status === "present" ? "text-emerald-400" : rec.status === "absent" ? "text-red-400" : "text-amber-400"
                    }`}>{rec.status}</span>
                  ) : <span className="text-xs text-white/25 italic">Not marked</span>;
                })()}
              </div>
              <div className="flex items-center gap-1.5">
                {(["present", "absent", "late"] as const).map((status) => {
                  const rec = attendance.find((a: any) => a.course_id === selectedCourseId && a.week_number === parseInt(selectedWeek));
                  const isAct = rec?.status === status;
                  const Icon = status === "present" ? UserCheck : status === "absent" ? UserX : Clock;
                  const col = status === "present"
                    ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/30"
                    : status === "absent"
                    ? "text-red-400 bg-red-500/20 border-red-500/30"
                    : "text-amber-400 bg-amber-500/20 border-amber-500/30";
                  return (
                    <button key={status}
                      onClick={() => markAttendance.mutate({ courseId: selectedCourseId, weekNumber: parseInt(selectedWeek), status })}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${isAct ? col : "text-white/30 bg-white/[0.04] border-white/[0.07] hover:text-white/60"}`}>
                      <Icon className="w-3 h-3" />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {totalRecords === 0 && (
          <p className="text-xs text-white/25 text-center py-2">No attendance records yet</p>
        )}
      </div>
    </motion.div>
  );
};

export default DoctorAttendanceSection;
