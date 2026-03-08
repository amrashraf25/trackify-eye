import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, BookOpen, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

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
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-secondary/50 border-border/50" />
            </div>
            {canManage && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90"><Plus className="w-4 h-4 mr-2" />Add Student</Button>
                </DialogTrigger>
                <DialogContent className="glass">
                  <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Full Name *</Label><Input value={newStudent.full_name} onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })} className="rounded-xl" /></div>
                    <div><Label>Student Code *</Label><Input value={newStudent.student_code} onChange={(e) => setNewStudent({ ...newStudent, student_code: e.target.value })} placeholder="e.g. STU001" className="rounded-xl" /></div>
                    <div><Label>Email</Label><Input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} className="rounded-xl" /></div>
                    <div><Label>Phone</Label><Input value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} className="rounded-xl" /></div>
                    <div><Label>Year Level</Label>
                      <Select value={newStudent.year_level} onValueChange={(v) => setNewStudent({ ...newStudent, year_level: v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddStudent} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">Add Student</Button>
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
            <div className="space-y-2">
              {filteredStudents.map((student, index) => {
                const studentCourses = getStudentCourses(student.id);
                const score = getScore(student.id);
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedStudent?.id === student.id
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{student.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {student.student_code} • Year {student.year_level} • {studentCourses.length} courses
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
                        <Badge variant={student.status === "active" ? "default" : "secondary"} className={`text-[10px] ${student.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}`}>
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedStudent ? (
            <>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-primary/20">
                    {selectedStudent.avatar_url ? (
                      <img src={selectedStudent.avatar_url} alt={selectedStudent.full_name} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{selectedStudent.full_name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{selectedStudent.student_code}</p>
                    <Badge variant={selectedStudent.status === "active" ? "default" : "secondary"} className="mt-1 text-[10px]">
                      {selectedStudent.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Year Level</p>
                    <p className="text-xl font-bold text-foreground">{selectedStudent.year_level}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Behavior</p>
                    <p className={`text-xl font-bold ${getScoreColor(getScore(selectedStudent.id))}`}>{getScore(selectedStudent.id)}%</p>
                  </div>
                </div>

                {selectedStudent.email && (
                  <div className="mt-4 text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="text-foreground font-mono text-xs">{selectedStudent.email}</span>
                  </div>
                )}
                {selectedStudent.phone && (
                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="text-foreground font-mono text-xs">{selectedStudent.phone}</span>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5">
                <h4 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Enrolled Courses ({getStudentCourses(selectedStudent.id).length})
                </h4>
                <div className="space-y-2">
                  {getStudentCourses(selectedStudent.id).length > 0 ? (
                    getStudentCourses(selectedStudent.id).map((course) => (
                      <div key={course.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                        <BookOpen className="w-5 h-5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-foreground text-sm">{course.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{course.course_code} • {course.credits} credits</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enrolled in any courses</p>
                  )}
                </div>
              </motion.div>
            </>
          ) : (
            <div className="glass rounded-2xl p-5 text-center text-muted-foreground">
              Select a student to view details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Students;
