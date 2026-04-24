// Scrollable list of doctor cards used in the left panel of the Doctors page; highlights the selected doctor.
import { User, Stethoscope, BookOpen, Mail } from "lucide-react";
import { motion } from "framer-motion";

interface DoctorListProps {
  doctors: any[];
  selectedDoctorId?: string;
  onSelect: (id: string) => void;
  getDoctorCourses: (id: string) => any[];
}

const DoctorList = ({ doctors, selectedDoctorId, onSelect, getDoctorCourses }: DoctorListProps) => {
  if (doctors.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "hsl(160 84% 39% / 0.08)", boxShadow: "0 0 20px hsl(160 84% 39% / 0.1)" }}>
          <Stethoscope className="w-8 h-8 text-emerald-400/40" />
        </div>
        <p className="font-medium text-sm text-white/50">No doctors found</p>
        <p className="text-xs mt-1 text-white/25">Try adjusting your search</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
      {doctors.map((doctor, index) => {
        const courseCount = getDoctorCourses(doctor.id).length;
        const isSelected = selectedDoctorId === doctor.id;
        // Generate up to 2-letter initials from the doctor's full name for avatar fallback
        const initials = (doctor.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

        return (
          <motion.div
            key={doctor.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => onSelect(doctor.id)}
            className="relative group cursor-pointer rounded-xl overflow-hidden transition-all duration-200"
            style={isSelected ? {
              background: "linear-gradient(135deg, hsl(160 84% 39% / 0.14), hsl(160 84% 39% / 0.06))",
              boxShadow: "inset 0 1px 0 hsl(160 84% 39% / 0.2), 0 4px 16px rgba(0,0,0,0.15)",
              border: "1px solid hsl(160 84% 39% / 0.25)",
            } : {
              background: "hsl(225 25% 10%)",
              border: "1px solid hsl(225 25% 14%)",
            }}
          >
            {/* Neon left accent bar */}
            {isSelected && (
              <motion.div
                layoutId="doctor-active-bar"
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                style={{ background: "linear-gradient(180deg, hsl(160 84% 60%), hsl(160 84% 39%))", boxShadow: "0 0 8px hsl(160 84% 39% / 0.8)" }}
              />
            )}

            <div className="flex items-center gap-3 p-3">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden"
                  style={isSelected ? {
                    background: "linear-gradient(135deg, hsl(160 84% 39% / 0.4), hsl(160 70% 25% / 0.4))",
                    boxShadow: "0 0 12px hsl(160 84% 39% / 0.3)",
                  } : {
                    background: "hsl(225 25% 15%)",
                  }}>
                  {doctor.avatar_url ? (
                    <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-sm font-black text-white/70">{initials}</span>
                  )}
                </div>
                {/* Online dot */}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 bg-emerald-400"
                  style={{ borderColor: "hsl(225 25% 7%)", boxShadow: "0 0 6px hsl(160 84% 39% / 0.6)" }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate transition-colors ${isSelected ? "text-white" : "text-white/70 group-hover:text-white/90"}`}>
                  {doctor.full_name || "Unnamed"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Mail className="w-2.5 h-2.5 text-white/20 flex-shrink-0" />
                  <p className="text-[10px] text-white/30 truncate">{doctor.email}</p>
                </div>
              </div>

              {/* Course count badge */}
              <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold"
                style={courseCount > 0 ? {
                  background: "hsl(160 84% 39% / 0.12)",
                  color: "hsl(160 84% 55%)",
                  border: "1px solid hsl(160 84% 39% / 0.2)",
                } : {
                  background: "hsl(225 25% 13%)",
                  color: "hsl(225 15% 40%)",
                  border: "1px solid hsl(225 25% 16%)",
                }}>
                <BookOpen className="w-2.5 h-2.5" />
                {courseCount}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default DoctorList;
