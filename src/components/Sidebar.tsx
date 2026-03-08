import { BookOpen, Users, Stethoscope, AlertTriangle, Video, Settings, LayoutDashboard, BarChart3, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import trackifyLogo from "@/assets/trackify_logo.jfif";
import { motion } from "framer-motion";

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
    <aside className="w-64 min-h-screen bg-sidebar flex flex-col border-r border-border/50 relative overflow-hidden transition-colors duration-300">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-blue/5 via-transparent to-neon-purple/5 pointer-events-none" />
      
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 relative z-10">
        <div className="relative">
          <img src={trackifyLogo} alt="Trackify Logo" className="w-10 h-10 rounded-xl object-cover ring-2 ring-primary/20" />
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-neon-cyan rounded-full border-2 border-sidebar animate-pulse" />
        </div>
        <span className="text-lg font-bold text-primary-foreground tracking-tight">Trackify</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 relative z-10">
        {filteredItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.label} to={item.path}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start px-4 py-3 h-auto text-sm font-medium transition-all duration-200 relative group ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-glow-primary"
                      : "text-sidebar-foreground hover:text-primary-foreground hover:bg-sidebar-hover"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-neon-cyan rounded-r-full"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon className={`w-5 h-5 mr-3 transition-transform group-hover:scale-110 ${isActive ? "" : ""}`} />
                  {item.label}
                </Button>
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-border/30 relative z-10">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
        <p className="text-[10px] text-sidebar-foreground/40 text-center mt-3 uppercase tracking-wider">
          © 2024 Trackify — AI Platform
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
