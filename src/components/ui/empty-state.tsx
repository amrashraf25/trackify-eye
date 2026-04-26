import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="float-3d halo-3d w-16 h-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-primary/40" />
      </div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[280px]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
