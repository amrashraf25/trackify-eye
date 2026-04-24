// Dashboard widget listing the 4 most recently created active courses with their enrollment counts.
import { BookOpen, Users, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const RecentCourses = () => {
  const navigate = useNavigate();

  // Fetch the 4 newest active courses, then enrich each with its total enrollment count
  const { data: courses = [] } = useQuery({
    queryKey: ["dashboard-recent-courses"],
    queryFn: async () => {
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, course_code, status, credits, semester")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);

      if (!courseData) return [];

      // Fetch enrollments for the returned courses in one request
      const courseIds = courseData.map(c => c.id);
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .in("course_id", courseIds);

      // Attach per-course student count to each course object
      return courseData.map(course => {
        const studentCount = enrollments?.filter(e => e.course_id === course.id).length || 0;
        return { ...course, studentCount };
      });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Recent Courses</h3>
          <p className="text-xs text-muted-foreground">Active courses overview</p>
        </div>
        <span
          onClick={() => navigate("/courses")}
          className="text-xs text-primary cursor-pointer hover:underline font-medium flex items-center gap-1"
        >
          View All <ArrowRight className="w-3 h-3" />
        </span>
      </div>
      <div className="space-y-3">
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No active courses yet</p>
        ) : (
          courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              onClick={() => navigate("/courses")}
              className="p-4 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-all duration-200 cursor-pointer group hover-lift"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{course.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {course.studentCount} students
                      </span>
                      <span>{course.course_code}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-primary">{course.credits} cr</span>
                  <p className="text-[10px] text-muted-foreground">{course.semester}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default RecentCourses;
