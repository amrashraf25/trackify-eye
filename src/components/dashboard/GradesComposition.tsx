import { motion } from "framer-motion";

const grades = [
  { label: "Coursework", value: 40, color: "bg-primary" },
  { label: "Participation", value: 30, color: "bg-neon-cyan" },
  { label: "Attendance", value: 20, color: "bg-emerald-500" },
  { label: "Exams", value: 10, color: "bg-amber-500" },
];

const GradesComposition = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass rounded-2xl p-5 hover:shadow-card-hover transition-all duration-300"
    >
      <h3 className="text-base font-bold text-foreground mb-1">Grades Composition</h3>
      <p className="text-xs text-muted-foreground mb-4">Grade weight distribution</p>
      <div className="space-y-4">
        {grades.map((grade, index) => (
          <motion.div
            key={grade.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
          >
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground font-medium">{grade.label}</span>
              <span className="text-foreground font-bold">{grade.value}%</span>
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
