import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AttendanceChart = () => {
  const navigate = useNavigate();

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-attendance-chart"],
    queryFn: async () => {
      // Get courses
      const { data: courses } = await supabase.from("courses").select("id, name").eq("status", "active").limit(6);
      if (!courses || courses.length === 0) return [];

      // Get attendance records for those courses
      const { data: records } = await supabase.from("attendance_records").select("course_id, status");
      if (!records) return courses.map(c => ({ subject: c.name, attendance: 0 }));

      return courses.map(course => {
        const courseRecords = records.filter(r => r.course_id === course.id);
        const present = courseRecords.filter(r => r.status === "present").length;
        const total = courseRecords.length;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        return { subject: course.name.length > 12 ? course.name.substring(0, 12) + "…" : course.name, attendance: rate };
      });
    },
  });

  const displayData = chartData.length > 0 ? chartData : [
    { subject: "No data", attendance: 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      onClick={() => navigate("/attendance")}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-foreground">Course Attendance</h3>
        <span className="text-xs text-primary font-medium hover:underline">View All →</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Average attendance rate per course</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--neon-purple))" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="subject"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                color: 'hsl(var(--foreground))',
                boxShadow: '0 8px 30px hsl(0 0% 0% / 0.2)',
              }}
              formatter={(value: number) => [`${value}%`, 'Attendance']}
            />
            <Bar dataKey="attendance" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default AttendanceChart;
