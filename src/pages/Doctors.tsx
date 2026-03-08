import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, BookOpen, Users, Stethoscope, Plus, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Doctors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState("");
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState({ full_name: "", email: "", password: "" });
  const [addingDoctor, setAddingDoctor] = useState(false);
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const canManage = role === "admin" || role === "dean";

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "doctor").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses = [], refetch: refetchCourses } = useQuery({
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

  const assignCourse = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor || !selectedCourseToAssign) throw new Error("Select a course");
      const { error } = await supabase.from("courses").update({ doctor_id: selectedDoctor.id }).eq("id", selectedCourseToAssign);
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
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search doctors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {canManage && (
              <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Doctor</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input placeholder="Dr. John Doe" value={newDoctor.full_name} onChange={(e) => setNewDoctor({ ...newDoctor, full_name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" placeholder="doctor@institution.edu" value={newDoctor.email} onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input type="password" placeholder="Min 6 characters" value={newDoctor.password} onChange={(e) => setNewDoctor({ ...newDoctor, password: e.target.value })} />
                    </div>
                    <Button onClick={handleAddDoctor} disabled={addingDoctor} className="w-full">
                      {addingDoctor ? "Creating..." : "Create Doctor Account"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No doctors found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDoctors.map((doctor) => (
                <div
                  key={doctor.id}
                  onClick={() => setSelectedDoctorId(doctor.id)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${
                    selectedDoctor?.id === doctor.id
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-secondary/50 hover:bg-secondary border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {doctor.avatar_url ? (
                        <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{doctor.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{doctor.email} • {getDoctorCourses(doctor.id).length} courses</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedDoctor ? (
            <>
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {selectedDoctor.avatar_url ? (
                      <img src={selectedDoctor.avatar_url} alt={selectedDoctor.full_name || ""} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{selectedDoctor.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedDoctor.email}</p>
                    <Badge className="mt-1 capitalize">{selectedDoctor.role}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs">Assigned Courses</span>
                    </div>
                    <p className="text-2xl font-semibold text-foreground">{getDoctorCourses(selectedDoctor.id).length}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Role</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground capitalize">{selectedDoctor.role}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Assigned Courses</h3>
                  {canManage && (
                    <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Link2 className="w-4 h-4 mr-2" />Assign Course</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Assign Course to {selectedDoctor.full_name}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Select Course</Label>
                            <Select value={selectedCourseToAssign} onValueChange={setSelectedCourseToAssign}>
                              <SelectTrigger><SelectValue placeholder="Choose a course..." /></SelectTrigger>
                              <SelectContent>
                                {getUnassignedCourses().map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.course_code})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={() => assignCourse.mutate()} disabled={!selectedCourseToAssign} className="w-full">
                            Assign
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {getDoctorCourses(selectedDoctor.id).length > 0 ? (
                  <div className="space-y-3">
                    {getDoctorCourses(selectedDoctor.id).map((course) => (
                      <div key={course.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium text-foreground">{course.name}</p>
                            <p className="text-xs text-muted-foreground">{course.course_code} • {course.credits} credits • {course.semester}</p>
                          </div>
                        </div>
                        {canManage && (
                          <Button size="sm" variant="ghost" className="text-destructive text-xs h-7"
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
              </div>
            </>
          ) : (
            <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground">
              Select a doctor to view details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Doctors;
