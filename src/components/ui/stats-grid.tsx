import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

export interface StatItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string; // e.g. "primary", "emerald", "amber", "red", "violet"
  trend?: { value: string; up: boolean };
  onClick?: () => void;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  primary: { bg: "from-primary/20 to-primary/5", border: "border-primary/25", text: "text-primary", icon: "bg-primary/20 text-primary" },
  emerald: { bg: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/25", text: "text-emerald-400", icon: "bg-emerald-500/20 text-emerald-400" },
  amber: { bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/25", text: "text-amber-400", icon: "bg-amber-500/20 text-amber-400" },
  red: { bg: "from-red-500/20 to-red-500/5", border: "border-red-500/25", text: "text-red-400", icon: "bg-red-500/20 text-red-400" },
  violet: { bg: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/25", text: "text-violet-400", icon: "bg-violet-500/20 text-violet-400" },
  blue: { bg: "from-blue-500/20 to-blue-500/5", border: "border-blue-500/25", text: "text-blue-400", icon: "bg-blue-500/20 text-blue-400" },
  cyan: { bg: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/25", text: "text-cyan-400", icon: "bg-cyan-500/20 text-cyan-400" },
};

export function StatsGrid({ items, columns = 4 }: { items: StatItem[]; columns?: number }) {
  const colClass =
    columns === 2 ? "grid-cols-2" :
    columns === 3 ? "grid-cols-1 sm:grid-cols-3" :
    "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${colClass} gap-3`}>
      {items.map((item, i) => {
        const c = COLOR_MAP[item.color] || COLOR_MAP.primary;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.08 + i * 0.06, type: "spring", stiffness: 300, damping: 24 }}
            whileHover={{ y: -3, scale: 1.02, transition: { duration: 0.15 } }}
            onClick={item.onClick}
            className={`tilt-3d transition-all duration-300 relative overflow-hidden rounded-2xl bg-gradient-to-b ${c.bg} ${c.border} border p-4 ${item.onClick ? "cursor-pointer" : ""}`}
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}>
                <item.icon className="w-4 h-4" />
              </div>
              {item.trend && (
                <span className={`text-[10px] font-bold ${item.trend.up ? "text-emerald-400" : "text-red-400"}`}>
                  {item.trend.up ? "↑" : "↓"} {item.trend.value}
                </span>
              )}
            </div>
            <p className={`text-2xl font-black tabular-nums ${c.text}`}>{item.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{item.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
