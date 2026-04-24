import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Plus, Stethoscope, User, Lock, Mail, Sparkles, BookOpen, Users
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import DoctorList from "@/components/doctors/DoctorList";
import DoctorDetail from "@/components/doctors/DoctorDetail";
import DoctorAttendanceSection from "@/components/doctors/DoctorAttendanceSection";
import DoctorBehaviorSection from "@/components/doctors/DoctorBehaviorSection";

// Faculty directory page: lists all doctors, shows a detail panel with course assignments, and lets admins/deans add new doctor accounts.
const Doctors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState({ full_name: "", email: "", password: "" });
  const [addingDoctor, setAddingDoctor] = useState(false);
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  // canManage: admin and dean can add/edit doctors; isDean: dean sees attendance and behavior sections.
  const canManage = role === "admin" || role === "dean";
  const isDean = role === "dean";

  // Fetches all user profiles with role = "doctor".
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "doctor").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetches all courses to determine doctor assignments and show course stats.
  const { data: courses = [] } = useQuery({
    queryKey: ["doctor-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*");
      if (error) throw error;
      return data;
    },
  });

  const filteredDoctors = doctors.filter((d) =>
    (d.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || filteredDoctors[0];
  const getDoctorCourses = (doctorId: string) => courses.filter((c) => c.doctor_id === doctorId);
  const getAssignableCourses = (doctorId: string) => courses.filter((c) => c.doctor_id !== doctorId);

  // Creates a new doctor account via the "create-doctor" Supabase Edge Function (requires elevated privileges).
  const handleAddDoctor = async () => {
    if (!newDoctor.full_name || !newDoctor.email || !newDoctor.password) {
      toast.error("All fields are required");
      return;
    }
    if (newDoctor.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setAddingDoctor(true);
    try {
      const response = await supabase.functions.invoke("create-doctor", {
        body: { full_name: newDoctor.full_name, email: newDoctor.email, password: newDoctor.password },
      });
      if (response.error) throw new Error(response.error.message || "Failed to create doctor");
      const result = response.data;
      if (result?.error) throw new Error(result.error);
      toast.success("Doctor account created successfully");
      setNewDoctor({ full_name: "", email: "", password: "" });
      setAddDoctorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["doctors-profiles"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create doctor");
    } finally {
      setAddingDoctor(false);
    }
  };

  return (
    <MainLayout title="Doctors">
      <div className="space-y-5">

        {/* -------------- HERO HEADER -------------- */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.07]"
          style={{ background: "linear-gradient(135deg, hsl(160 70% 5%), hsl(220 35% 5%))" }}
        >
          {/* Grid pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{
            backgroundImage: "linear-gradient(hsl(160 84% 39% / 0.12) 1px, transparent 1px), linear-gradient(90deg, hsl(160 84% 39% / 0.12) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }} />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-primary/8 blur-[60px] pointer-events-none" />

          <div className="relative z-10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/80 font-bold">Faculty Directory</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">All Doctors</h1>
              <p className="text-sm text-white/35 mt-0.5">{doctors.length} registered faculty � {courses.length} courses</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "Faculty",  value: doctors.length,  icon: <Stethoscope className="w-3 h-3" />, col: "from-emerald-500/25 to-emerald-500/5 border-emerald-500/25 text-emerald-400" },
                { label: "Courses",  value: courses.length,  icon: <BookOpen className="w-3 h-3" />,    col: "from-primary/25 to-primary/5 border-primary/25 text-primary" },
              ].map(({ label, value, icon, col }) => (
                <div key={label} className={`px-4 py-2.5 rounded-xl bg-gradient-to-b ${col} border text-center min-w-[72px]`} style={{ backdropFilter: "blur(12px)" }}>
                  <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
                  <p className="text-xl font-black tabular-nums leading-none">{value}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">{label}</p>
                </div>
              ))}
              {canManage && (
                <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl h-12 px-5 font-semibold"
                      style={{ background: "linear-gradient(135deg, hsl(160 84% 39%), hsl(160 70% 30%))", boxShadow: "0 0 24px hsl(160 84% 39% / 0.35)" }}>
                      <Plus className="w-4 h-4 mr-2" />Add Doctor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-emerald-400" />
                        Add New Doctor
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="flex items-center gap-1.5 text-xs mb-1.5"><User className="w-3 h-3" />Full Name</Label>
                        <Input placeholder="Dr. John Doe" value={newDoctor.full_name} onChange={(e) => setNewDoctor({ ...newDoctor, full_name: e.target.value })} className="rounded-xl" />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1.5 text-xs mb-1.5"><Mail className="w-3 h-3" />Email</Label>
                        <Input type="email" placeholder="doctor@institution.edu" value={newDoctor.email} onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })} className="rounded-xl" />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1.5 text-xs mb-1.5"><Lock className="w-3 h-3" />Password</Label>
                        <Input type="password" placeholder="Min 6 characters" value={newDoctor.password} onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })} className="rounded-xl" />
                      </div>
                      <Button onClick={handleAddDoctor} disabled={addingDoctor} className="w-full rounded-xl"
                        style={{ background: "linear-gradient(135deg, hsl(160 84% 39%), hsl(160 70% 30%))", boxShadow: "0 0 16px hsl(160 84% 39% / 0.3)" }}>
                        {addingDoctor ? "Creating..." : "Create Doctor Account"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </motion.div>

        {/* -------------- MAIN GRID -------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

          {/* -- LEFT: Doctor List -- */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="sticky top-6 self-start"
          >
            <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
              style={{ background: "hsl(225 25% 7%)" }}>
              {/* Panel header */}
              <div className="px-4 py-3 border-b border-white/[0.06]"
                style={{ background: "linear-gradient(90deg, hsl(160 84% 39% / 0.08), transparent)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "hsl(160 84% 39% / 0.15)", boxShadow: "0 0 12px hsl(160 84% 39% / 0.3)" }}>
                    <Stethoscope className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white/90">Faculty</h3>
                    <p className="text-[10px] text-white/30">{doctors.length} doctor{doctors.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                  <Input
                    placeholder="Search doctors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-xl text-xs border-white/[0.08]"
                    style={{ background: "hsl(225 25% 10%)" }}
                  />
                </div>
              </div>
              {/* List */}
              <div className="p-3">
                <DoctorList
                  doctors={filteredDoctors}
                  selectedDoctorId={selectedDoctor?.id}
                  onSelect={setSelectedDoctorId}
                  getDoctorCourses={getDoctorCourses}
                />
              </div>
            </div>
          </motion.div>

          {/* -- RIGHT: Doctor Detail -- */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-5"
          >
            {selectedDoctor ? (
              <>
                <DoctorDetail
                  doctor={selectedDoctor}
                  doctorCourses={getDoctorCourses(selectedDoctor.id)}
                  assignableCourses={getAssignableCourses(selectedDoctor.id)}
                  allDoctors={doctors}
                  canManage={canManage}
                />
                {isDean && (
                  <>
                    <DoctorAttendanceSection
                      doctorId={selectedDoctor.id}
                      doctorName={selectedDoctor.full_name || "Doctor"}
                      doctorCourses={getDoctorCourses(selectedDoctor.id)}
                      userId={user?.id}
                    />
                    <DoctorBehaviorSection
                      doctorId={selectedDoctor.id}
                      doctorName={selectedDoctor.full_name || "Doctor"}
                      userId={user?.id}
                      doctorCourses={getDoctorCourses(selectedDoctor.id)}
                    />
                  </>
                )}
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-24 rounded-2xl border border-white/[0.06]"
                style={{ background: "hsl(225 25% 7%)" }}
              >
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "hsl(160 84% 39% / 0.1)", boxShadow: "0 0 32px hsl(160 84% 39% / 0.15)" }}>
                  <Stethoscope className="w-10 h-10 text-emerald-400/40" />
                </div>
                <h3 className="text-lg font-semibold text-white/80 mb-1">Select a Doctor</h3>
                <p className="text-sm text-white/30 max-w-xs text-center">
                  Choose a doctor from the panel on the left to view their profile, courses and records.
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Doctors;
