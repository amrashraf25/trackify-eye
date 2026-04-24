// Right-panel detail view for a selected doctor: profile card, course assignment/removal, and edit/delete controls.
import { useEffect, useRef, useState } from "react";

// Use the Supabase project URL for storage uploads, falling back to local dev server
const API_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'http://localhost:3001';

// Upload an avatar image to Supabase Storage and return its public URL
async function uploadPhoto(file: File, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, fileName);
  const encodedName = fileName.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${API_URL}/storage/v1/object/avatars/${encodedName}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Photo upload failed: ${txt}`);
  }
  return `${API_URL}/storage/v1/object/public/avatars/${encodedName}`;
}
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, BookOpen, Link2, Trash2, Mail, GraduationCap, Award, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface DoctorDetailProps {
  doctor: any;
  doctorCourses: any[];
  assignableCourses: any[];
  allDoctors: any[];
  canManage: boolean;
}

const DoctorDetail = ({ doctor, doctorCourses, assignableCourses, allDoctors, canManage }: DoctorDetailProps) => {
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  // Revoke any existing object URL to prevent memory leaks before creating a new preview
  const clearPreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearPreviewUrl();
  }, []);

  // Set the selected course's doctor_id to this doctor, possibly reassigning it away from another doctor
  const assignCourse = useMutation({
    mutationFn: async () => {
      if (!selectedCourseToAssign) throw new Error("Select a course");
      const { data, error } = await supabase
        .from("courses")
        .update({ doctor_id: doctor.id })
        .eq("id", selectedCourseToAssign)
        .select("id")
        .single();
      if (error) throw new Error(error.message || "Permission denied — your account may need roles synced");
      if (!data) throw new Error("Update had no effect — run the latest migration in Supabase dashboard to fix role permissions");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course assigned successfully");
      setAssignOpen(false);
      setSelectedCourseToAssign("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Clear the doctor_id on the given course, making it unassigned
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

  // Unassign all courses then delete the doctor's profile record
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

  // Upload new avatar (if changed) then call the Edge Function to update the doctor's profile
  const updateDoctor = useMutation({
    mutationFn: async () => {
      if (!doctor?.id) throw new Error("Doctor not found");

      const trimmedName = editName.trim();
      if (!trimmedName) throw new Error("Doctor name is required");

      let avatar_url = doctor.avatar_url ?? null;

      if (editAvatarFile) {
        const ext = editAvatarFile.name.split(".").pop() || "jpg";
        const fileName = `doctors/${doctor.id}_${Date.now()}.${ext}`;
        avatar_url = await uploadPhoto(editAvatarFile, fileName);
      }

      const { data, error } = await supabase.functions.invoke("update-doctor-profile", {
        body: {
          doctor_id: doctor.id,
          full_name: trimmedName,
          avatar_url,
        },
      });

      if (error) throw new Error(error.message || "Failed to update doctor profile");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors-profiles"] });
      toast.success("Doctor profile updated");
      clearPreviewUrl();
      setEditAvatarFile(null);
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Seed the edit form with the current doctor data before showing the dialog
  const openEditDialog = () => {
    clearPreviewUrl();
    setEditAvatarFile(null);
    setEditName(doctor.full_name || "");
    setEditAvatarPreview(doctor.avatar_url || null);
    setEditOpen(true);
  };

  // Clean up any pending preview URL when the dialog is dismissed without saving
  const closeEditDialog = (open: boolean) => {
    if (!open) {
      clearPreviewUrl();
      setEditAvatarFile(null);
      setEditAvatarPreview(doctor.avatar_url || null);
    }
    setEditOpen(open);
  };

  // Validate file size and generate a local preview URL for the newly selected avatar
  const handleEditAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    clearPreviewUrl();
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setEditAvatarFile(file);
    setEditAvatarPreview(previewUrl);
  };

  // Sum credits across all assigned courses for the profile stat card
  const totalCredits = doctorCourses.reduce((sum, c) => sum + (c.credits || 0), 0);

  // Generate up to 2-letter initials for the avatar fallback
  const initials = (doctor.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      {/* -- Profile Card -- */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.07]"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        {/* Banner */}
        <div className="h-28 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(160 70% 6%), hsl(220 35% 7%))" }}>
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-25" style={{
            backgroundImage: "radial-gradient(circle, hsl(160 84% 39% / 0.25) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
          <div className="absolute -top-10 right-0 w-56 h-56 rounded-full bg-emerald-500/10 blur-[60px]" />
          <div className="absolute bottom-0 left-0 right-0 h-16"
            style={{ background: "linear-gradient(to top, hsl(225 25% 7%), transparent)" }} />
        </div>

        <div className="px-6 pb-6 -mt-12 relative">
          <div className="flex items-end gap-4 mb-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-22 h-22 rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  width: "5.5rem", height: "5.5rem",
                  background: "linear-gradient(135deg, hsl(160 84% 39% / 0.5), hsl(160 70% 20% / 0.5))",
                  boxShadow: "0 0 0 3px hsl(225 25% 7%), 0 0 0 5px hsl(160 84% 39% / 0.35), 0 8px 24px rgba(0,0,0,0.4)",
                }}>
                {doctor.avatar_url ? (
                  <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-white/90">{initials}</span>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2"
                style={{ borderColor: "hsl(225 25% 7%)", boxShadow: "0 0 8px hsl(160 84% 39% / 0.7)" }} />
            </div>

            {/* Name / email */}
            <div className="flex-1 pb-1 min-w-0">
              <h3 className="text-xl font-black text-white tracking-tight truncate">{doctor.full_name}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <Mail className="w-3 h-3 text-white/25 flex-shrink-0" />
                <span className="text-xs text-white/35 font-mono truncate">{doctor.email}</span>
              </div>
              <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg capitalize"
                style={{ background: "hsl(160 84% 39% / 0.12)", color: "hsl(160 84% 55%)", border: "1px solid hsl(160 84% 39% / 0.25)" }}>
                Doctor
              </span>
            </div>

            {/* Action buttons */}
            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <Dialog open={editOpen} onOpenChange={closeEditDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" onClick={openEditDialog}
                      className="rounded-xl h-9 w-9 border-white/[0.1] text-white/50 hover:text-white hover:bg-white/[0.06]">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass">
                    <DialogHeader><DialogTitle>Edit Doctor Profile</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="flex flex-col items-center gap-3">
                        <div onClick={() => editFileInputRef.current?.click()}
                          className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/[0.15] flex items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors overflow-hidden"
                          style={{ background: "hsl(225 25% 10%)" }}>
                          {editAvatarPreview ? (
                            <img src={editAvatarPreview} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            <div className="text-center">
                              <Upload className="w-6 h-6 text-white/25 mx-auto mb-1" />
                              <span className="text-[10px] text-white/25">Photo</span>
                            </div>
                          )}
                        </div>
                        <input ref={editFileInputRef} type="file" accept="image/*" onChange={handleEditAvatarSelect} className="hidden" />
                        <p className="text-[10px] text-white/30">Click to upload new photo</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Full Name</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Doctor name" className="rounded-xl" />
                      </div>
                      <Button onClick={() => updateDoctor.mutate()} disabled={updateDoctor.isPending} className="w-full rounded-xl"
                        style={{ background: "linear-gradient(135deg, hsl(160 84% 39%), hsl(160 70% 28%))" }}>
                        {updateDoctor.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-xl h-9 w-9 border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="w-3.5 h-3.5" />
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
              </div>
            )}
          </div>

          {/* 3D Stat Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <BookOpen className="w-4 h-4 text-primary" />, val: doctorCourses.length, label: "Courses", from: "hsl(217 91% 60% / 0.12)", border: "hsl(217 91% 60% / 0.2)" },
              { icon: <Award className="w-4 h-4 text-amber-400" />,   val: totalCredits,        label: "Credits",  from: "hsl(38 92% 50% / 0.12)",  border: "hsl(38 92% 50% / 0.2)" },
              { icon: <GraduationCap className="w-4 h-4 text-emerald-400" />, val: "Dr.", label: "Faculty", from: "hsl(160 84% 39% / 0.12)", border: "hsl(160 84% 39% / 0.2)" },
            ].map(({ icon, val, label, from, border }) => (
              <motion.div key={label} whileHover={{ y: -2, scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="relative overflow-hidden rounded-xl p-3.5"
                style={{ background: from, border: `1px solid ${border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                <div className="mb-2">{icon}</div>
                <p className="text-2xl font-black text-white tabular-nums">{val}</p>
                <p className="text-[10px] text-white/35 uppercase tracking-wider mt-0.5">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* -- Courses Card -- */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
          style={{ background: "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(217 91% 60% / 0.12)", boxShadow: "0 0 10px hsl(217 91% 60% / 0.2)" }}>
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/90">Assigned Courses</h3>
              <p className="text-[10px] text-white/30">{doctorCourses.length} active course{doctorCourses.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {canManage && (
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl text-xs gap-1.5 h-8"
                  style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))", boxShadow: "0 0 16px hsl(217 91% 60% / 0.3)" }}>
                  <Link2 className="w-3 h-3" />Assign
                </Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader><DialogTitle>Assign Course to {doctor.full_name}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {assignableCourses.length === 0 ? (
                    <div className="text-center py-6 rounded-xl border border-white/[0.06]" style={{ background: "hsl(225 25% 8%)" }}>
                      <BookOpen className="w-8 h-8 text-white/15 mx-auto mb-2" />
                      <p className="text-sm text-white/40">All courses are already assigned to this doctor.</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs mb-1.5 block">Select Course</Label>
                        <Select value={selectedCourseToAssign} onValueChange={setSelectedCourseToAssign}>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose a course..." /></SelectTrigger>
                          <SelectContent>
                            {assignableCourses.map((c) => {
                              const currentOwner = c.doctor_id
                                ? allDoctors.find((d: any) => d.id === c.doctor_id)
                                : null;
                              return (
                                <SelectItem key={c.id} value={c.id}>
                                  <span className="flex flex-col">
                                    <span>{c.name} ({c.course_code})</span>
                                    {currentOwner && (
                                      <span className="text-[10px] text-amber-400/70">Currently: {currentOwner.full_name}</span>
                                    )}
                                    {!currentOwner && (
                                      <span className="text-[10px] text-emerald-400/70">Unassigned</span>
                                    )}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {selectedCourseToAssign && (() => {
                          const course = assignableCourses.find((c) => c.id === selectedCourseToAssign);
                          const owner = course?.doctor_id ? allDoctors.find((d: any) => d.id === course.doctor_id) : null;
                          return owner ? (
                            <p className="text-[11px] text-amber-400/80 mt-1.5 flex items-center gap-1">
                              ⚠ This will reassign the course from <strong>{owner.full_name}</strong>
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <Button onClick={() => assignCourse.mutate()} disabled={!selectedCourseToAssign || assignCourse.isPending} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">
                        {assignCourse.isPending ? "Assigning..." : "Assign Course"}
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="p-4">
          {doctorCourses.length > 0 ? (
            <div className="space-y-2">
              {doctorCourses.map((course, i) => {
                const letter = (course.name || "?")[0].toUpperCase();
                const palette = ["hsl(217 91% 60%)", "hsl(160 84% 39%)", "hsl(38 92% 50%)", "hsl(263 70% 58%)", "hsl(340 75% 55%)"];
                const color = palette[i % palette.length];
                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.04 }}
                    whileHover={{ x: 2 }}
                    className="group flex items-center justify-between p-3 rounded-xl border border-white/[0.06] transition-all"
                    style={{ background: "hsl(225 25% 10%)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black text-white"
                        style={{ background: `${color}22`, border: `1px solid ${color}33` }}>
                        {letter}
                      </div>
                      <div>
                        <p className="font-semibold text-white/85 text-sm">{course.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/30 font-mono">{course.course_code}</span>
                          <span className="text-[8px] text-white/20">�</span>
                          <span className="text-[10px] text-white/30">{course.credits} cr</span>
                          {course.semester && (
                            <>
                              <span className="text-[8px] text-white/20">�</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: "hsl(225 25% 14%)", color: "hsl(225 15% 50%)" }}>{course.semester}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {canManage && (
                      <button
                        className="text-red-400/0 group-hover:text-red-400/70 hover:!text-red-400 text-xs font-medium transition-all px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                        onClick={() => unassignCourse.mutate(course.id)}>
                        Remove
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "hsl(225 25% 10%)" }}>
                <BookOpen className="w-5 h-5 text-white/15" />
              </div>
              <p className="text-sm text-white/35">No courses assigned yet</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default DoctorDetail;
