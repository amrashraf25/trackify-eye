import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Plus, Stethoscope, User, Lock, Mail
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

const Doctors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState({ full_name: "", email: "", password: "" });
  const [addingDoctor, setAddingDoctor] = useState(false);
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = role === "admin" || role === "dean";
  const isDean = role === "dean";

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "doctor").order("full_name");
      if (error) throw error;
      return data;
    },
  });

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
  const getUnassignedCourses = () => courses.filter((c) => !c.doctor_id);

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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Doctor List Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4 xl:col-span-3"
        >
          <div className="rounded-2xl border border-border/30 bg-card overflow-hidden sticky top-6">
            {/* Panel header */}
            <div className="p-4 border-b border-border/20 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Faculty</h3>
                    <p className="text-[10px] text-muted-foreground">{doctors.length} doctor{doctors.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                {canManage && (
                  <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 h-8 w-8 p-0">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Stethoscope className="w-5 h-5 text-primary" />
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
                        <Button onClick={handleAddDoctor} disabled={addingDoctor} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20">
                          {addingDoctor ? "Creating..." : "Create Doctor Account"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-secondary/30 border-border/30 text-xs placeholder:text-muted-foreground/60 focus:bg-secondary/50"
                />
              </div>
            </div>

            {/* Doctor list */}
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

        {/* Right: Doctor Detail */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {selectedDoctor ? (
            <>
              <DoctorDetail
                doctor={selectedDoctor}
                doctorCourses={getDoctorCourses(selectedDoctor.id)}
                unassignedCourses={getUnassignedCourses()}
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
              className="rounded-2xl border border-border/20 bg-card p-16 text-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/20 flex items-center justify-center mx-auto mb-5">
                <Stethoscope className="w-10 h-10 text-primary/30" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Select a Doctor</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Choose a doctor from the panel to view their profile, courses, attendance, and behavior records.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Doctors;
