import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardCheck, UserCheck, UserX, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Overall stats
  const totalRecords = attendance.length;
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          Attendance
          <span className="text-xs font-normal text-muted-foreground ml-1">({attendanceRate}% overall)</span>
        </h3>
        <SendDoctorAttendanceAlert doctorId={doctorId} doctorName={doctorName} attendanceRate={attendanceRate} />
      </div>

      {doctorCourses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No courses assigned</p>
      ) : (
        <div className="space-y-4">
          {doctorCourses.map((course, i) => (
            <CourseAttendanceCard
              key={course.id}
              course={course}
              attendance={attendance.filter((a) => a.course_id === course.id)}
              onMark={(weekNumber, status) => markAttendance.mutate({ courseId: course.id, weekNumber, status })}
              index={i}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

interface CourseAttendanceCardProps {
  course: any;
  attendance: any[];
  onMark: (weekNumber: number, status: string) => void;
  index: number;
}

const CourseAttendanceCard = ({ course, attendance, onMark, index }: CourseAttendanceCardProps) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const record = attendance.find((a) => a.week_number === selectedWeek);
  const coursePresentCount = attendance.filter((a) => a.status === "present").length;
  const courseTotal = attendance.length;
  const courseRate = courseTotal > 0 ? Math.round((coursePresentCount / courseTotal) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
      className="bg-secondary/20 border border-border/30 rounded-xl overflow-hidden"
    >
      {/* Course header */}
      <div className="flex items-center justify-between p-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{course.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{course.course_code} • {courseRate}% attendance</p>
          </div>
        </div>
        <Select value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(parseInt(v))}>
          <SelectTrigger className="w-[100px] h-8 rounded-lg text-xs bg-secondary/50 border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKS.map((w) => {
              const weekRecord = attendance.find((a) => a.week_number === w);
              const dot = weekRecord
                ? weekRecord.status === "present" ? "🟢" : weekRecord.status === "absent" ? "🔴" : "🟡"
                : "";
              return (
                <SelectItem key={w} value={String(w)}>
                  Week {w} {dot}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Attendance marking for selected week */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Week {selectedWeek}:</span>
          {record ? (
            <span className={`text-xs font-bold capitalize ${
              record.status === "present" ? "text-emerald-500"
              : record.status === "absent" ? "text-destructive"
              : "text-amber-500"
            }`}>
              {record.status}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Not marked</span>
          )}
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
                onClick={() => onMark(selectedWeek, status)}
                className={`p-2 rounded-lg transition-all ${isActive ? activeClass : "text-muted-foreground hover:bg-secondary/50"}`}
                title={status.charAt(0).toUpperCase() + status.slice(1)}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Mini week overview */}
      <div className="px-4 pb-3 flex gap-1 flex-wrap">
        {WEEKS.map((w) => {
          const weekRecord = attendance.find((a) => a.week_number === w);
          const isSelected = w === selectedWeek;
          const bgClass = isSelected
            ? "ring-1 ring-primary bg-primary/20 text-primary"
            : weekRecord
              ? weekRecord.status === "present"
                ? "bg-emerald-500/15 text-emerald-500"
                : weekRecord.status === "absent"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-amber-500/15 text-amber-500"
              : "bg-secondary/30 text-muted-foreground";
          return (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              className={`w-6 h-6 rounded text-[8px] font-bold transition-all ${bgClass}`}
            >
              {w}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DoctorAttendanceSection;
