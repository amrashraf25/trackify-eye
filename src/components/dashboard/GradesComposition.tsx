const grades = [
  { label: "Coursework", value: 40, color: "bg-primary" },
  { label: "Participation", value: 30, color: "bg-sky-500" },
  { label: "Attendance", value: 20, color: "bg-emerald-500" },
  { label: "Exams", value: 10, color: "bg-amber-500" },
];

const GradesComposition = () => {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Grades Composition</h3>
      <div className="space-y-4">
        {grades.map((grade) => (
          <div key={grade.label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{grade.label}</span>
              <span className="text-foreground font-medium">{grade.value}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${grade.color} transition-all duration-500`}
                style={{ width: `${grade.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GradesComposition;
