import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, Users, Plus, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Courses = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ course_code: "", name: "", description: "", credits: "3", semester: "Fall 2024" });
  const { role } = useAuth();

  const { data: courses = [], refetch } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.course_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || filteredCourses[0];
  const canManage = role === "admin" || role === "dean";

  const getEnrollmentCount = (courseId: string) => enrollments.filter((e) => e.course_id === courseId).length;

  const handleAddCourse = async () => {
    if (!newCourse.course_code || !newCourse.name) {
      toast.error("Course code and name are required");
      return;
    }
    const { error } = await supabase.from("courses").insert({
      course_code: newCourse.course_code,
      name: newCourse.name,
      description: newCourse.description || null,
      credits: parseInt(newCourse.credits),
      semester: newCourse.semester,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Course added successfully");
      setNewCourse({ course_code: "", name: "", description: "", credits: "3", semester: "Fall 2024" });
      setAddOpen(false);
      refetch();
    }
  };

  return (
    <MainLayout title="Courses">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            {canManage && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Course</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Course</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Course Code *</Label><Input value={newCourse.course_code} onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })} placeholder="e.g. CS101" /></div>
                    <div><Label>Name *</Label><Input value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} /></div>
                    <div><Label>Description</Label><Input value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} /></div>
                    <div><Label>Credits</Label>
                      <Select value={newCourse.credits} onValueChange={(v) => setNewCourse({ ...newCourse, credits: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((c) => <SelectItem key={c} value={String(c)}>{c} Credits</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Semester</Label><Input value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} /></div>
                    <Button onClick={handleAddCourse} className="w-full">Add Course</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {filteredCourses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No courses found. {canManage && "Add your first course to get started."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    selectedCourse?.id === course.id
                      ? "bg-primary/10 border-2 border-primary/30"
                      : "bg-secondary/50 hover:bg-secondary border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{course.name}</p>
                      <p className="text-xs text-muted-foreground">{course.course_code}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{getEnrollmentCount(course.id)}</span>
                        <span>{course.credits} credits</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {selectedCourse ? (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedCourse.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedCourse.course_code}</p>
                  <Badge className="mt-1">{selectedCourse.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-xl font-semibold text-foreground">{getEnrollmentCount(selectedCourse.id)}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="text-xl font-semibold text-foreground">{selectedCourse.credits}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Semester</p>
                  <p className="text-sm font-semibold text-foreground">{selectedCourse.semester}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Max Students</p>
                  <p className="text-xl font-semibold text-foreground">{selectedCourse.max_students}</p>
                </div>
              </div>

              {selectedCourse.description && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">{selectedCourse.description}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-5 text-center text-muted-foreground">
              Select a course to view details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Courses;
