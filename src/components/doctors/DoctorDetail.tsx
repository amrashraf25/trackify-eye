import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, BookOpen, Users, Link2, Trash2, Mail, GraduationCap, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface DoctorDetailProps {
  doctor: any;
  doctorCourses: any[];
  unassignedCourses: any[];
  canManage: boolean;
}

const DoctorDetail = ({ doctor, doctorCourses, unassignedCourses, canManage }: DoctorDetailProps) => {
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState("");
  const queryClient = useQueryClient();

  const assignCourse = useMutation({
    mutationFn: async () => {
      if (!selectedCourseToAssign) throw new Error("Select a course");
      const { error } = await supabase.from("courses").update({ doctor_id: doctor.id }).eq("id", selectedCourseToAssign);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-courses"] });
      toast.success("Course assigned successfully");
      setAssignOpen(false);
      setSelectedCourseToAssign("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unassignCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("courses").update({ doctor_id: null }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-courses"] });
      toast.success("Course unassigned");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteDoctor = useMutation({
    mutationFn: async () => {
      await supabase.from("courses").update({ doctor_id: null }).eq("doctor_id", doctor.id);
      const { error } = await supabase.from("profiles").delete().eq("id", doctor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-courses"] });
      toast.success("Doctor deleted successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalCredits = doctorCourses.reduce((sum, c) => sum + (c.credits || 0), 0);

  return (
    <>
      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-border/30">
        {/* Gradient banner */}
        <div className="h-24 bg-gradient-to-r from-primary/20 via-accent/15 to-primary/10 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
        </div>

        <div className="px-6 pb-6 -mt-10 relative">
          <div className="flex items-end gap-4 mb-5">
            <div className="w-20 h-20 rounded-2xl bg-card border-4 border-card flex items-center justify-center overflow-hidden shadow-xl ring-2 ring-primary/20">
              {doctor.avatar_url ? (
                <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 pb-1">
              <h3 className="text-xl font-bold text-foreground">{doctor.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">{doctor.email}</span>
              </div>
            </div>
            {canManage && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-xl border-destructive/20 text-destructive/70 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40 shrink-0 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>{doctor.full_name}</strong>? Their courses will be unassigned.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteDoctor.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/15 rounded-xl p-3.5">
              <BookOpen className="w-4 h-4 text-primary mb-1.5" />
              <p className="text-2xl font-bold text-foreground">{doctorCourses.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Courses</p>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/15 rounded-xl p-3.5">
              <Award className="w-4 h-4 text-accent mb-1.5" />
              <p className="text-2xl font-bold text-foreground">{totalCredits}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Credits</p>
            </div>
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/15 rounded-xl p-3.5">
              <GraduationCap className="w-4 h-4 text-emerald-500 mb-1.5" />
              <p className="text-2xl font-bold text-foreground capitalize">{doctor.role}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Role</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Courses Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border/30 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Assigned Courses</h3>
              <p className="text-[10px] text-muted-foreground">{doctorCourses.length} active course{doctorCourses.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {canManage && (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 text-xs gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />Assign
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader><DialogTitle>Assign Course to {doctor.full_name}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Course</Label>
                    <Select value={selectedCourseToAssign} onValueChange={setSelectedCourseToAssign}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose a course..." /></SelectTrigger>
                      <SelectContent>
                        {unassignedCourses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.course_code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => assignCourse.mutate()} disabled={!selectedCourseToAssign} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">Assign</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {doctorCourses.length > 0 ? (
          <div className="space-y-2">
            {doctorCourses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.04 }}
                className="group flex items-center justify-between p-3.5 bg-secondary/20 border border-border/20 rounded-xl hover:bg-secondary/30 hover:border-border/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{course.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{course.course_code}</span>
                      <span className="text-[8px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-muted-foreground">{course.credits} credits</span>
                      <span className="text-[8px] text-muted-foreground">•</span>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 border-border/30">{course.semester}</Badge>
                    </div>
                  </div>
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost"
                    className="text-destructive/50 text-xs h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => unassignCourse.mutate(course.id)}>
                    Remove
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-secondary/30 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-5 h-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No courses assigned</p>
            <p className="text-[10px] text-muted-foreground mt-1">Assign courses to get started</p>
          </div>
        )}
      </motion.div>
    </>
  );
};

export default DoctorDetail;
