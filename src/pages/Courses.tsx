import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { Search, BookOpen, Users, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const courses = [
  { id: 1, name: "Agile Methodologies", students: 45, attendance: 92, alerts: 3, satisfaction: 88 },
  { id: 2, name: "Risk Management", students: 32, attendance: 88, alerts: 5, satisfaction: 82 },
  { id: 3, name: "Software Testing", students: 28, attendance: 95, alerts: 1, satisfaction: 94 },
  { id: 4, name: "DevOps Practices", students: 38, attendance: 78, alerts: 8, satisfaction: 75 },
  { id: 5, name: "Cybersecurity", students: 52, attendance: 85, alerts: 4, satisfaction: 86 },
  { id: 6, name: "AI & Machine Learning", students: 61, attendance: 91, alerts: 2, satisfaction: 91 },
];

const engagementData = [
  { name: "High", value: 60, color: "#10b981" },
  { name: "Medium", value: 30, color: "#3b82f6" },
  { name: "Low", value: 10, color: "#ef4444" },
];

const Courses = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(courses[0]);

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout title="Courses">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses List */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                onClick={() => setSelectedCourse(course)}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  selectedCourse.id === course.id
                    ? "bg-primary/10 border-2 border-primary/30"
                    : "bg-secondary/50 hover:bg-secondary border-2 border-transparent"
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{course.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {course.students}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {course.alerts}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={course.attendance} className="flex-1 h-1.5" />
                  <span className="text-xs font-medium text-foreground">{course.attendance}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Course Details */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{selectedCourse.name}</h3>
                <Badge className="bg-emerald-500/10 text-emerald-500 mt-1">Active</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Students</span>
                </div>
                <p className="text-xl font-semibold text-foreground">{selectedCourse.students}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Attendance</span>
                </div>
                <p className="text-xl font-semibold text-emerald-500">{selectedCourse.attendance}%</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs">Alerts</span>
                </div>
                <p className="text-xl font-semibold text-amber-500">{selectedCourse.alerts}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Satisfaction</span>
                </div>
                <p className="text-xl font-semibold text-sky-500">{selectedCourse.satisfaction}%</p>
              </div>
            </div>
          </div>

          {/* Student Engagement */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h4 className="font-semibold text-foreground mb-4">Student Engagement</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={engagementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {engagementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => [`${value}%`, 'Students']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-xs">
              {engagementData.map((item) => (
                <div key={item.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Courses;
