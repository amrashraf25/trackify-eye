import { BookOpen, Users, Stethoscope, AlertTriangle, Video, Settings, Shield, LayoutDashboard, BarChart3 } from "lucide-react";
import { Button } from "./ui/button";
import { NavLink, useLocation } from "react-router-dom";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: BookOpen, label: "Courses", path: "/courses" },
  { icon: Users, label: "Students", path: "/students" },
  { icon: Stethoscope, label: "Doctors", path: "/doctors" },
  { icon: AlertTriangle, label: "Alerts Incidents", path: "/alerts" },
  { icon: Video, label: "Camera Records", path: "/camera" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const Sidebar = () => {
  const location = useLocation();

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
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.label} to={item.path}>
              <Button
                variant={isActive ? "sidebarActive" : "sidebar"}
                className="w-full justify-start px-4 py-3 h-auto text-sm font-medium"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </Button>
            </NavLink>
          );
        })}
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
