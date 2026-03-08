import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "primary" | "success" | "warning" | "info";
  index?: number;
  linkTo?: string;
}

const colorClasses = {
  primary: {
    icon: "bg-primary/15 text-primary",
    glow: "hover:shadow-glow-primary",
    border: "hover:border-primary/30",
  },
  success: {
    icon: "bg-emerald-500/15 text-emerald-500",
    glow: "hover:shadow-[0_8px_30px_hsl(160_84%_39%/0.12)]",
    border: "hover:border-emerald-500/30",
  },
  warning: {
    icon: "bg-amber-500/15 text-amber-500",
    glow: "hover:shadow-[0_8px_30px_hsl(38_92%_50%/0.12)]",
    border: "hover:border-amber-500/30",
  },
  info: {
    icon: "bg-neon-cyan/15 text-neon-cyan",
    glow: "hover:shadow-glow-cyan",
    border: "hover:border-neon-cyan/30",
  },
};

const MetricCard = ({ title, value, icon: Icon, trend, color = "primary", index = 0, linkTo }: MetricCardProps) => {
  const styles = colorClasses[color];
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={() => linkTo && navigate(linkTo)}
      className={`glass rounded-2xl p-5 ${styles.border} ${styles.glow} transition-all duration-300 hover-lift ${linkTo ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trend.isPositive ? 'text-emerald-500' : 'text-destructive'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${styles.icon}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {linkTo && (
        <p className="text-[10px] text-muted-foreground/60 mt-3 uppercase tracking-wider">Click to view →</p>
      )}
    </motion.div>
  );
};

export default MetricCard;
