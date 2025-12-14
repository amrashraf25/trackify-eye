import { BookOpen, Users, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const courses = [
  { id: 1, name: "Agile Methodologies", students: 45, progress: 78, time: "Mon, Wed 10:00" },
  { id: 2, name: "Risk Management", students: 32, progress: 65, time: "Tue, Thu 14:00" },
  { id: 3, name: "Software Testing", students: 28, progress: 92, time: "Wed, Fri 09:00" },
  { id: 4, name: "DevOps Practices", students: 38, progress: 55, time: "Mon, Thu 11:00" },
];

const RecentCourses = () => {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">My Courses</h3>
        <span className="text-xs text-primary cursor-pointer hover:underline">View All</span>
      </div>
      <div className="space-y-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{course.name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {course.students}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {course.time}
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-sm font-medium text-primary">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentCourses;
