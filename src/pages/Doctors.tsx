import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { Search, User, BookOpen, Clock, TrendingUp, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const doctors = [
  { id: 1, name: "Dr. Ahmed Mahmoud", courses: 4, attendance: 98, lateness: 2, students: 145 },
  { id: 2, name: "Dr. Sara Hassan", courses: 3, attendance: 95, lateness: 5, students: 98 },
  { id: 3, name: "Dr. Mohamed Fathy", courses: 5, attendance: 88, lateness: 12, students: 180 },
  { id: 4, name: "Dr. Layla Ibrahim", courses: 2, attendance: 100, lateness: 0, students: 65 },
];

const gradeData = [
  { grade: "A+", count: 15 },
  { grade: "A", count: 28 },
  { grade: "B+", count: 35 },
  { grade: "B", count: 22 },
  { grade: "C", count: 12 },
  { grade: "D", count: 5 },
];

const Doctors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(doctors[0]);

  const filteredDoctors = doctors.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout title="Doctors">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doctors List */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search doctors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-3">
            {filteredDoctors.map((doctor) => (
              <div
                key={doctor.id}
                onClick={() => setSelectedDoctor(doctor)}
                className={`p-4 rounded-lg cursor-pointer transition-all ${
                  selectedDoctor.id === doctor.id
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-secondary/50 hover:bg-secondary border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{doctor.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doctor.courses} courses • {doctor.students} students
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Doctor Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs">Courses</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">{selectedDoctor.courses}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="w-4 h-4" />
                <span className="text-xs">Students</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">{selectedDoctor.students}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Attendance</span>
              </div>
              <p className="text-2xl font-semibold text-emerald-500">{selectedDoctor.attendance}%</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Lateness</span>
              </div>
              <p className="text-2xl font-semibold text-amber-500">{selectedDoctor.lateness}%</p>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Grade Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="grade"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Attendance Breakdown */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Attendance Breakdown</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Present</span>
                  <span className="text-emerald-500 font-medium">{selectedDoctor.attendance}%</span>
                </div>
                <Progress value={selectedDoctor.attendance} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Sick Leave</span>
                  <span className="text-amber-500 font-medium">2%</span>
                </div>
                <Progress value={2} className="h-2 [&>div]:bg-amber-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Absent</span>
                  <span className="text-red-500 font-medium">{100 - selectedDoctor.attendance - 2}%</span>
                </div>
                <Progress value={100 - selectedDoctor.attendance - 2} className="h-2 [&>div]:bg-red-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Doctors;
