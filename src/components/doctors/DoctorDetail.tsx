import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, BookOpen, Users, Link2, Trash2 } from "lucide-react";
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

  return (
    <>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-primary/20">
            {doctor.avatar_url ? (
              <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground">{doctor.full_name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{doctor.email}</p>
            <Badge className="mt-1 capitalize text-[10px] bg-primary/10 text-primary">{doctor.role}</Badge>
          </div>
          {canManage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <BookOpen className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-wider">Assigned Courses</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{doctorCourses.length}</p>
          </div>
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-wider">Role</span>
            </div>
            <p className="text-lg font-bold text-foreground capitalize">{doctor.role}</p>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">Assigned Courses</h3>
          {canManage && (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl"><Link2 className="w-4 h-4 mr-2" />Assign Course</Button>
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
                  <Button onClick={() => assignCourse.mutate()} disabled={!selectedCourseToAssign} className="w-full rounded-xl">Assign</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {doctorCourses.length > 0 ? (
          <div className="space-y-2">
            {doctorCourses.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{course.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{course.course_code} • {course.credits} credits • {course.semester}</p>
                  </div>
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost" className="text-destructive text-xs h-7 rounded-lg hover:bg-destructive/10"
                    onClick={() => unassignCourse.mutate(course.id)}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No courses assigned</p>
        )}
      </motion.div>
    </>
  );
};

export default DoctorDetail;
