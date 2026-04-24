import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type StatusVariant = "present" | "absent" | "late" | "active" | "ended" | "warning" | "success" | "info" | "danger";

const VARIANT_STYLES: Record<StatusVariant, string> = {
  present: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  absent: "bg-red-500/15 text-red-400 border-red-500/30",
  late: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ended: "bg-secondary/60 text-muted-foreground border-border/50",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  info: "bg-primary/15 text-primary border-primary/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
};

interface StatusBadgeProps {
  variant: StatusVariant;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ variant, children, pulse, className, dot }: StatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "text-[10px] border font-semibold gap-1.5",
        VARIANT_STYLES[variant],
        pulse && "animate-pulse",
        className
      )}
    >
      {dot && (
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          variant === "present" || variant === "active" || variant === "success" ? "bg-emerald-400" :
          variant === "absent" || variant === "danger" ? "bg-red-400" :
          variant === "late" || variant === "warning" ? "bg-amber-400" :
          "bg-primary"
        )} />
      )}
      {children}
    </Badge>
  );
}
