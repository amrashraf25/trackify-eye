import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, BookOpen, Users, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const Doctors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

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

  return (
    <MainLayout title="Doctors">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search doctors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{doctor.full_name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">{doctor.email}</p>
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
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
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
                      <span className="text-xs">Courses</span>
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
                <h3 className="text-lg font-semibold text-foreground mb-4">Assigned Courses</h3>
                {getDoctorCourses(selectedDoctor.id).length > 0 ? (
                  <div className="space-y-3">
                    {getDoctorCourses(selectedDoctor.id).map((course) => (
                      <div key={course.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{course.name}</p>
                          <p className="text-xs text-muted-foreground">{course.course_code} • {course.credits} credits • {course.semester}</p>
                        </div>
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
