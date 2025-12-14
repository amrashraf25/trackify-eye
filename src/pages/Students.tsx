import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { Search, Filter, AlertTriangle, Clock, TrendingUp, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const students = [
  { id: 1, name: "Ahmed Hassan", attendance: 92, incidents: 2, engagement: 85, status: "excellent" },
  { id: 2, name: "Sarah Ibrahim", attendance: 88, incidents: 5, engagement: 72, status: "good" },
  { id: 3, name: "Mohamed Ali", attendance: 65, incidents: 12, engagement: 45, status: "poor" },
  { id: 4, name: "Fatima Khalil", attendance: 95, incidents: 0, engagement: 94, status: "excellent" },
  { id: 5, name: "Omar Nabil", attendance: 78, incidents: 8, engagement: 60, status: "good" },
  { id: 6, name: "Layla Ahmed", attendance: 91, incidents: 1, engagement: 88, status: "excellent" },
];

const statusColors = {
  excellent: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  good: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  poor: "bg-red-500/10 text-red-500 border-red-500/20",
};

const Students = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(students[0]);

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout title="Students">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  selectedStudent.id === student.id
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-secondary/50 hover:bg-secondary border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.incidents} incidents • {student.attendance}% attendance
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[student.status as keyof typeof statusColors]}>
                    {student.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Student Detail Panel */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedStudent.name}</h3>
                <Badge className={statusColors[selectedStudent.status as keyof typeof statusColors]}>
                  {selectedStudent.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Attendance</p>
                <p className="text-xl font-semibold text-foreground">{selectedStudent.attendance}%</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Incidents</p>
                <p className="text-xl font-semibold text-foreground">{selectedStudent.incidents}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Engagement Score</p>
              <div className="flex items-center gap-3">
                <Progress value={selectedStudent.engagement} className="flex-1 h-2" />
                <span className="text-sm font-medium text-foreground">{selectedStudent.engagement}%</span>
              </div>
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              Recent Alerts
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-foreground">Late Attendance</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-foreground">Low Participation</p>
                  <p className="text-xs text-muted-foreground">Yesterday</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Students;
