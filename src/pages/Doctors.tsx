import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, User, BookOpen, Users, Stethoscope, Plus, Link2, Trash2,
  ChevronLeft, ChevronRight, UserCheck, UserX, Clock, TrendingUp, TrendingDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Doctor List */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search doctors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-secondary/50 border-border/50" />
            </div>
            {canManage && (
              <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90"><Plus className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent className="glass">
                  <DialogHeader><DialogTitle>Add New Doctor</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Full Name</Label><Input placeholder="Dr. John Doe" value={newDoctor.full_name} onChange={(e) => setNewDoctor({ ...newDoctor, full_name: e.target.value })} className="rounded-xl" /></div>
                    <div><Label>Email</Label><Input type="email" placeholder="doctor@institution.edu" value={newDoctor.email} onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })} className="rounded-xl" /></div>
                    <div><Label>Password</Label><Input type="password" placeholder="Min 6 characters" value={newDoctor.password} onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })} className="rounded-xl" /></div>
                    <Button onClick={handleAddDoctor} disabled={addingDoctor} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">
                      {addingDoctor ? "Creating..." : "Create Doctor Account"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <DoctorList
            doctors={filteredDoctors}
            selectedDoctorId={selectedDoctor?.id}
            onSelect={setSelectedDoctorId}
            getDoctorCourses={getDoctorCourses}
          />
        </div>

        {/* Right: Doctor Detail */}
        <div className="lg:col-span-2 space-y-6">
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
            <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
              Select a doctor to view details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Doctors;
