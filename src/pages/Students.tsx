import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, BookOpen, Plus, AlertTriangle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Users } from "lucide-react";

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

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["student-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: behaviorScores = [] } = useQuery({
    queryKey: ["student-behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_scores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || filteredStudents[0];

  const getStudentCourses = (studentId: string) => {
    const courseIds = enrollments.filter((e) => e.student_id === studentId).map((e) => e.course_id);
    return courses.filter((c) => courseIds.includes(c.id));
  };

  const getScore = (studentId: string) => behaviorScores.find((s) => s.student_id === studentId)?.score ?? 100;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-destructive";
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
              <p>No students found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student) => {
                const studentCourses = getStudentCourses(student.id);
                const score = getScore(student.id);
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
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.student_code} • Year {student.year_level} • {studentCourses.length} courses
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
                        <Badge variant={student.status === "active" ? "default" : "secondary"} className={student.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}>
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedStudent ? (
            <>
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    {selectedStudent.avatar_url ? (
                      <img src={selectedStudent.avatar_url} alt={selectedStudent.full_name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-primary" />
                    )}
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
                    <p className="text-xs text-muted-foreground mb-1">Behavior</p>
                    <p className={`text-xl font-semibold ${getScoreColor(getScore(selectedStudent.id))}`}>{getScore(selectedStudent.id)}%</p>
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

              {/* Enrolled Courses */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Enrolled Courses ({getStudentCourses(selectedStudent.id).length})
                </h4>
                <div className="space-y-3">
                  {getStudentCourses(selectedStudent.id).length > 0 ? (
                    getStudentCourses(selectedStudent.id).map((course) => (
                      <div key={course.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <BookOpen className="w-5 h-5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">{course.name}</p>
                          <p className="text-xs text-muted-foreground">{course.course_code} • {course.credits} credits</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enrolled in any courses</p>
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

export default Students;
