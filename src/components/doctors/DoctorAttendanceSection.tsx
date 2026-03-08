import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, ChevronLeft, ChevronRight, UserCheck, UserX, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const queryClient = useQueryClient();

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
    mutationFn: async ({ courseId, status }: { courseId: string; status: string }) => {
      const existing = attendance.find(
        (a) => a.course_id === courseId && a.week_number === selectedWeek
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
          week_number: selectedWeek,
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

  const getRecord = (courseId: string) =>
    attendance.find((a) => a.course_id === courseId && a.week_number === selectedWeek);

  // Calculate attendance stats
  const totalRecords = attendance.length;
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Attendance
          <span className="text-xs font-normal text-muted-foreground ml-1">({attendanceRate}% overall)</span>
        </h3>
        <div className="flex items-center gap-2">
          <SendDoctorAttendanceAlert doctorId={doctorId} doctorName={doctorName} attendanceRate={attendanceRate} />
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

      {doctorCourses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No courses assigned</p>
      ) : (
        <div className="space-y-3">
          {doctorCourses.map((course) => {
            const record = getRecord(course.id);
            return (
              <div key={course.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">{course.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{course.course_code}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["present", "absent", "late"] as const).map((status) => {
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
                        onClick={() => markAttendance.mutate({ courseId: course.id, status })}
                        className={`p-2 rounded-lg transition-all ${isActive ? activeClass : "text-muted-foreground hover:bg-secondary/50"}`}
                        title={status.charAt(0).toUpperCase() + status.slice(1)}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly summary */}
      <div className="flex gap-1.5 mt-4 flex-wrap">
        {WEEKS.map((w) => {
          const weekRecords = attendance.filter((a) => a.week_number === w);
          const allPresent = weekRecords.length > 0 && weekRecords.every((r) => r.status === "present");
          const hasAbsent = weekRecords.some((r) => r.status === "absent");
          const hasLate = weekRecords.some((r) => r.status === "late");
          const bgClass = w === selectedWeek
            ? "ring-2 ring-primary bg-primary/20 text-primary"
            : allPresent
            ? "bg-emerald-500/20 text-emerald-500"
            : hasAbsent
            ? "bg-destructive/20 text-destructive"
            : hasLate
            ? "bg-amber-500/20 text-amber-500"
            : "bg-secondary/40 text-muted-foreground";
          return (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${bgClass}`}
            >
              W{w}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DoctorAttendanceSection;
