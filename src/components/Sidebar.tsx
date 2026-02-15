import { BookOpen, Users, Stethoscope, AlertTriangle, Video, Settings, LayoutDashboard, BarChart3, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import trackifyLogo from "@/assets/trackify_logo.jfif";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ["admin", "dean", "doctor", "student"] },
  { icon: BookOpen, label: "Courses", path: "/courses", roles: ["admin", "dean", "doctor"] },
  { icon: Users, label: "Students", path: "/students", roles: ["admin", "dean", "doctor"] },
  { icon: Stethoscope, label: "Doctors", path: "/doctors", roles: ["admin", "dean"] },
  { icon: AlertTriangle, label: "Alerts", path: "/alerts", roles: ["admin", "dean", "doctor"] },
  { icon: Video, label: "Camera Records", path: "/camera", roles: ["admin", "dean"] },
  { icon: BarChart3, label: "Reports", path: "/reports", roles: ["admin", "dean"] },
  { icon: Settings, label: "Settings", path: "/settings", roles: ["admin", "dean", "doctor", "student"] },
];

const Sidebar = () => {
  const location = useLocation();
  const { role, signOut } = useAuth();

  const filteredItems = navItems.filter((item) => {
    if (!role) return true;
    return item.roles.includes(role);
  });

  return (
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col border-r border-border transition-colors duration-300">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <img src={trackifyLogo} alt="Trackify Logo" className="w-10 h-10 rounded-lg object-cover" />
        <span className="text-xl font-semibold text-foreground tracking-tight">Trackify</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.label} to={item.path}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start px-4 py-3 h-auto text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-hover"
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </Button>
            </NavLink>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          © 2024 Trackify
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
