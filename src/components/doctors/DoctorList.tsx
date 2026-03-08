import { User, Stethoscope } from "lucide-react";
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
      <div className="text-center py-12 text-muted-foreground">
        <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No doctors found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {doctors.map((doctor, index) => (
        <motion.div
          key={doctor.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(doctor.id)}
          className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
            selectedDoctorId === doctor.id
              ? "bg-primary/10 ring-1 ring-primary/30"
              : "bg-secondary/30 hover:bg-secondary/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
              {doctor.avatar_url ? (
                <img src={doctor.avatar_url} alt={doctor.full_name || ""} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{doctor.full_name || "Unnamed"}</p>
              <p className="text-[10px] text-muted-foreground">{doctor.email} • {getDoctorCourses(doctor.id).length} courses</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default DoctorList;
