import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { motion } from "framer-motion";

const data = [
  { name: "Excellent", value: 45, color: "hsl(160 84% 39%)" },
  { name: "Good", value: 35, color: "hsl(217 91% 60%)" },
  { name: "Poor", value: 20, color: "hsl(0 84% 60%)" },
];

const BehaviorPieChart = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300"
    >
      <h3 className="text-base font-bold text-foreground mb-1">Student Behavior</h3>
      <p className="text-xs text-muted-foreground mb-4">Behavior score distribution</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
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
