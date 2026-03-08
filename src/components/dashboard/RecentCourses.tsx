import { BookOpen, Users, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

const courses = [
  { id: 1, name: "Agile Methodologies", students: 45, progress: 78, time: "Mon, Wed 10:00" },
  { id: 2, name: "Risk Management", students: 32, progress: 65, time: "Tue, Thu 14:00" },
  { id: 3, name: "Software Testing", students: 28, progress: 92, time: "Wed, Fri 09:00" },
  { id: 4, name: "DevOps Practices", students: 38, progress: 55, time: "Mon, Thu 11:00" },
];

const RecentCourses = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">My Courses</h3>
          <p className="text-xs text-muted-foreground">Active course progress</p>
        </div>
        <span className="text-xs text-primary cursor-pointer hover:underline font-medium">View All</span>
      </div>
      <div className="space-y-3">
        {courses.map((course, index) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            className="p-4 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-all duration-200 cursor-pointer group hover-lift"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{course.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {course.students}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {course.time}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-sm font-bold text-primary">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-1.5" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default RecentCourses;
