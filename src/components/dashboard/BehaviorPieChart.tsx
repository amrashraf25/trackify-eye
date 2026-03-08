import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BehaviorPieChart = () => {
  const navigate = useNavigate();

  const { data: chartData = [] } = useQuery({
    queryKey: ["dashboard-behavior-pie"],
    queryFn: async () => {
      const { data: scores } = await supabase.from("behavior_scores").select("score");
      if (!scores || scores.length === 0) {
        return [
          { name: "Excellent", value: 0, color: "hsl(160 84% 39%)" },
          { name: "Good", value: 0, color: "hsl(217 91% 60%)" },
          { name: "Needs Improvement", value: 0, color: "hsl(0 84% 60%)" },
        ];
      }

      let excellent = 0, good = 0, poor = 0;
      scores.forEach(s => {
        if (s.score >= 80) excellent++;
        else if (s.score >= 60) good++;
        else poor++;
      });

      const total = scores.length;
      return [
        { name: "Excellent (80+)", value: Math.round((excellent / total) * 100), color: "hsl(160 84% 39%)" },
        { name: "Good (60-79)", value: Math.round((good / total) * 100), color: "hsl(217 91% 60%)" },
        { name: "Needs Work (<60)", value: Math.round((poor / total) * 100), color: "hsl(0 84% 60%)" },
      ];
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      onClick={() => navigate("/behavior")}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-foreground">Student Behavior</h3>
        <span className="text-xs text-primary font-medium hover:underline">View All →</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Behavior score distribution</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                color: 'hsl(var(--foreground))',
                boxShadow: '0 8px 30px hsl(0 0% 0% / 0.2)',
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`${value}%`, 'Students']}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default BehaviorPieChart;
