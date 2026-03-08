import { User, Stethoscope, BookOpen, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface DoctorListProps {
  doctors: any[];
  selectedDoctorId?: string;
  onSelect: (id: string) => void;
  getDoctorCourses: (id: string) => any[];
}

const DoctorList = ({ doctors, selectedDoctorId, onSelect, getDoctorCourses }: DoctorListProps) => {
  if (doctors.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-border/30 flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="w-8 h-8 text-primary/40" />
        </div>
        <p className="font-medium text-sm">No doctors found</p>
        <p className="text-xs mt-1">Try adjusting your search</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
      {doctors.map((doctor, index) => {
        const courseCount = getDoctorCourses(doctor.id).length;
        const isSelected = selectedDoctorId === doctor.id;

        return (
          <motion.div
            key={doctor.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            onClick={() => onSelect(doctor.id)}
            className={`group relative p-3.5 rounded-xl cursor-pointer transition-all duration-300 ${
              isSelected
                ? "bg-gradient-to-r from-primary/15 to-accent/10 ring-1 ring-primary/30 shadow-lg shadow-primary/5"
                : "bg-secondary/20 hover:bg-secondary/40 border border-transparent hover:border-border/30"
            }`}
          >
            {/* Active indicator */}
            {isSelected && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-primary to-accent" />
            )}

            <div className="flex items-center gap-3">
              <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden transition-all ${
                isSelected
                  ? "bg-gradient-to-br from-primary/20 to-accent/20 ring-2 ring-primary/30"
                  : "bg-secondary/40 group-hover:bg-secondary/60"
              }`}>
                {doctor.avatar_url ? (
                  <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <User className={`w-5 h-5 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                )}
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate transition-colors ${isSelected ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"}`}>
                  {doctor.full_name || "Unnamed"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                  <p className="text-[10px] text-muted-foreground truncate">{doctor.email}</p>
                </div>
              </div>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 shrink-0 rounded-md border-border/40 ${
                courseCount > 0 ? "bg-primary/5 text-primary border-primary/20" : "text-muted-foreground"
              }`}>
                <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                {courseCount}
              </Badge>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DoctorList;
