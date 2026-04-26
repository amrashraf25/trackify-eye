import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  label: string;
  title: string;
  description?: string;
  iconColor?: string;
  glowColor?: string;
  children?: ReactNode;
  stats?: ReactNode;
}

export function PageHeader({
  icon: Icon,
  label,
  title,
  description,
  iconColor = "text-primary",
  glowColor = "bg-primary/10",
  children,
  stats,
}: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 22 }}
      className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 dark:from-[hsl(228,35%,8%)] dark:via-[hsl(225,30%,6%)] dark:to-[hsl(230,35%,7%)]"
    >
      {/* Grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(hsl(217 91% 60% / 0.07) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow blobs */}
      <div className={`absolute -top-16 -right-16 w-72 h-72 rounded-full ${glowColor} blur-[80px] pointer-events-none`} />
      <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-accent/8 blur-[60px] pointer-events-none" />

      <div className="relative z-10 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`halo-3d float-3d w-12 h-12 rounded-xl ${glowColor} border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center shadow-lg`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase tracking-[0.15em] text-primary/80 font-bold">{label}</span>
              </div>
              <h1 className="text-xl font-black text-foreground tracking-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {children && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
        </div>
        {stats && <div className="mt-4">{stats}</div>}
      </div>
    </motion.div>
  );
}
