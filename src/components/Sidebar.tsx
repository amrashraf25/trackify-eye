import { BookOpen, Users, Stethoscope, AlertTriangle, Video, Settings, Shield } from "lucide-react";
import { Button } from "./ui/button";

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
}

const navItems: NavItem[] = [
  { icon: BookOpen, label: "Courses" },
  { icon: Users, label: "Students" },
  { icon: Stethoscope, label: "Doctors" },
  { icon: AlertTriangle, label: "Alerts Incidents", active: true },
  { icon: Video, label: "Camera Records" },
  { icon: Settings, label: "Setting" },
];

const Sidebar = () => {
  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col border-r border-border">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-glow-red">
          <Shield className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-semibold text-foreground tracking-tight">Trackify</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.label}
            variant={item.active ? "sidebarActive" : "sidebar"}
            className="px-4 py-3 h-auto text-sm font-medium"
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          © 2024 Trackify
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
