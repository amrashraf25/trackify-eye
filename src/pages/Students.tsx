import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Filter, AlertTriangle, Clock, TrendingUp, User, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Students = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ full_name: "", email: "", student_code: "", year_level: "1", phone: "" });
  const { role } = useAuth();

  const { data: students = [], refetch } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["student-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*").order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || filteredStudents[0];

  const getStudentIncidents = (studentId: string) => {
    return incidents.filter((i) => i.student_id === studentId);
  };

  const handleAddStudent = async () => {
    if (!newStudent.full_name || !newStudent.student_code) {
      toast.error("Name and Student Code are required");
      return;
    }
    const { error } = await supabase.from("students").insert({
      full_name: newStudent.full_name,
      email: newStudent.email || null,
      student_code: newStudent.student_code,
      year_level: parseInt(newStudent.year_level),
      phone: newStudent.phone || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Student added successfully");
      setNewStudent({ full_name: "", email: "", student_code: "", year_level: "1", phone: "" });
      setAddOpen(false);
      refetch();
    }
  };

  const canManage = role === "admin" || role === "dean";

  return (
    <MainLayout title="Students">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {canManage && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Student</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Full Name *</Label><Input value={newStudent.full_name} onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })} /></div>
                    <div><Label>Student Code *</Label><Input value={newStudent.student_code} onChange={(e) => setNewStudent({ ...newStudent, student_code: e.target.value })} placeholder="e.g. STU001" /></div>
                    <div><Label>Email</Label><Input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} /></div>
                    <div><Label>Year Level</Label>
                      <Select value={newStudent.year_level} onValueChange={(v) => setNewStudent({ ...newStudent, year_level: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddStudent} className="w-full">Add Student</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No students found. {canManage && "Add your first student to get started."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => {
                const studentIncidents = getStudentIncidents(student.id);
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedStudent?.id === student.id
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-secondary/50 hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.student_code} • Year {student.year_level} • {studentIncidents.length} incidents
                          </p>
                        </div>
                      </div>
                      <Badge variant={student.status === "active" ? "default" : "secondary"} className={student.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}>
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Student Detail Panel */}
        <div className="space-y-4">
          {selectedStudent ? (
            <>
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedStudent.full_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedStudent.student_code}</p>
                    <Badge variant={selectedStudent.status === "active" ? "default" : "secondary"} className="mt-1">
                      {selectedStudent.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Year Level</p>
                    <p className="text-xl font-semibold text-foreground">{selectedStudent.year_level}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Incidents</p>
                    <p className="text-xl font-semibold text-foreground">{getStudentIncidents(selectedStudent.id).length}</p>
                  </div>
                </div>

                {selectedStudent.email && (
                  <div className="mt-4 text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="text-foreground">{selectedStudent.email}</span>
                  </div>
                )}
                {selectedStudent.phone && (
                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="text-foreground">{selectedStudent.phone}</span>
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border p-5">
                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Recent Incidents
                </h4>
                <div className="space-y-3">
                  {getStudentIncidents(selectedStudent.id).slice(0, 5).map((incident) => (
                    <div key={incident.id} className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-foreground">{incident.incident_type}</p>
                        <p className="text-xs text-muted-foreground">
                          Room {incident.room_number} • {new Date(incident.detected_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {getStudentIncidents(selectedStudent.id).length === 0 && (
                    <p className="text-sm text-muted-foreground">No incidents recorded</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card rounded-xl border border-border p-5 text-center text-muted-foreground">
              Select a student to view details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

// Add missing Users import
import { Users } from "lucide-react";

export default Students;
