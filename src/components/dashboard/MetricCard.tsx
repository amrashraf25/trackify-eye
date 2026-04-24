// Reusable KPI card that displays a metric with an animated number, trend indicator, and optional navigation link.
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

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
    icon:    "bg-primary/15 text-primary shadow-[0_0_20px_hsl(217_91%_60%/0.2)]",
    glow:    "hover:shadow-[0_8px_40px_hsl(217_91%_60%/0.15)]",
    border:  "hover:border-primary/25",
    accent:  "from-primary/8 to-transparent",
    trend:   "text-primary",
  },
  success: {
    icon:    "bg-emerald-500/15 text-emerald-500 shadow-[0_0_20px_hsl(160_84%_39%/0.2)]",
    glow:    "hover:shadow-[0_8px_40px_hsl(160_84%_39%/0.15)]",
    border:  "hover:border-emerald-500/25",
    accent:  "from-emerald-500/8 to-transparent",
    trend:   "text-emerald-500",
  },
  warning: {
    icon:    "bg-amber-500/15 text-amber-500 shadow-[0_0_20px_hsl(38_92%_50%/0.2)]",
    glow:    "hover:shadow-[0_8px_40px_hsl(38_92%_50%/0.15)]",
    border:  "hover:border-amber-500/25",
    accent:  "from-amber-500/8 to-transparent",
    trend:   "text-amber-500",
  },
  info: {
    icon:    "bg-neon-cyan/15 text-neon-cyan shadow-[0_0_20px_hsl(187_92%_69%/0.2)]",
    glow:    "hover:shadow-[0_8px_40px_hsl(187_92%_69%/0.15)]",
    border:  "hover:border-neon-cyan/25",
    accent:  "from-neon-cyan/8 to-transparent",
    trend:   "text-neon-cyan",
  },
};

// Animates a numeric value from its previous value to the new target using an easeOutExpo curve
function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    if (typeof target !== "number") return;
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo: fast start that decelerates toward the final value
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = target;
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return count;
}

// Renders a single metric card; if value is numeric it will be animated via useCountUp
const MetricCard = ({ title, value, icon: Icon, trend, color = "primary", index = 0, linkTo }: MetricCardProps) => {
  const styles  = colorClasses[color];
  const navigate = useNavigate();

  // Determine whether the value is numeric so we can apply the count-up animation
  const numericValue = typeof value === "number" ? value : parseInt(String(value), 10);
  const isNumeric    = !isNaN(numericValue);
  const displayCount = useCountUp(isNumeric ? numericValue : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.45, type: "spring", stiffness: 260, damping: 20 }}
      whileHover={{ y: -2 }}
      onClick={() => linkTo && navigate(linkTo)}
      className={`glass rounded-2xl p-5 border ${styles.border} ${styles.glow} transition-all duration-300 relative overflow-hidden ${linkTo ? "cursor-pointer" : "cursor-default"}`}
    >
      {/* Subtle accent gradient top */}
      <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${styles.accent} pointer-events-none`} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">{title}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight tabular-nums">
            {isNumeric ? displayCount : value}
          </p>
          {trend && (
            <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${trend.isPositive ? "text-emerald-500" : "text-destructive"}`}>
              <span className="text-base leading-none">{trend.isPositive ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}% from last week</span>
            </div>
          )}
          {linkTo && (
            <p className="text-[10px] text-muted-foreground/50 mt-3 uppercase tracking-wider">
              View details →
            </p>
          )}
        </div>

        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
};

export default MetricCard;
