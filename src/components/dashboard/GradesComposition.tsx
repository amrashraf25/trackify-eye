import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";

const GradesComposition = () => {
  const navigate = useNavigate();

  const { data: gradeData = [] } = useQuery({
    queryKey: ["dashboard-grades-composition"],
    queryFn: async () => {
      const { data: grades } = await supabase.from("grades").select("grade_type");
      if (!grades || grades.length === 0) return [];

      const typeCounts: Record<string, number> = {};
      grades.forEach(g => {
        const type = g.grade_type || "other";
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      const total = grades.length;
      const colorMap: Record<string, string> = {
        exam: "bg-primary",
        quiz: "bg-neon-cyan",
        assignment: "bg-emerald-500",
        midterm: "bg-amber-500",
        final: "bg-neon-purple",
        project: "bg-neon-blue",
      };

      const fallbackColors = ["bg-primary", "bg-neon-cyan", "bg-emerald-500", "bg-amber-500"];

      return Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count], i) => ({
          label: type.charAt(0).toUpperCase() + type.slice(1),
          value: Math.round((count / total) * 100),
          count,
          color: colorMap[type] || fallbackColors[i % fallbackColors.length],
        }));
    },
  });

  const displayData = gradeData.length > 0 ? gradeData : [
    { label: "No grades yet", value: 0, count: 0, color: "bg-muted" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-foreground">Grades Composition</h3>
        <span
          onClick={() => navigate("/reports")}
          className="text-xs text-primary cursor-pointer hover:underline font-medium flex items-center gap-1"
        >
          Reports <ArrowRight className="w-3 h-3" />
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Grade type distribution</p>
      <div className="space-y-4">
        {displayData.map((grade, index) => (
          <motion.div
            key={grade.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
          >
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground font-medium">{grade.label}</span>
              <span className="text-foreground font-bold">{grade.value}% <span className="text-muted-foreground font-normal text-xs">({grade.count})</span></span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${grade.value}%` }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.6, ease: "easeOut" }}
                className={`h-2 rounded-full ${grade.color}`}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default GradesComposition;
