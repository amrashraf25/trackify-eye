import { BookOpen, Users, Stethoscope, AlertTriangle, Video, Settings, LayoutDashboard, BarChart3, LogOut, ChevronRight, ClipboardList, CalendarDays, ClipboardCheck } from "lucide-react";
import { Button } from "./ui/button";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import owlMascot from "@/assets/owl_mascot.png";
import { motion } from "framer-motion";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",      path: "/",           roles: ["admin", "dean", "doctor", "student"] },
  { icon: BookOpen,        label: "Courses",         path: "/courses",    roles: ["admin", "dean", "doctor", "student"] },
  { icon: CalendarDays,    label: "Schedules",       path: "/schedules",  roles: ["admin", "dean"] },
  { icon: ClipboardList,   label: "Sessions",        path: "/sessions",   roles: ["admin", "dean", "doctor", "student"] },
  { icon: ClipboardCheck,  label: "Attendance",      path: "/attendance", roles: ["admin", "dean", "doctor"] },
  { icon: Users,           label: "Students",        path: "/students",   roles: ["admin", "dean", "doctor"] },
  { icon: Stethoscope,     label: "Doctors",         path: "/doctors",    roles: ["admin", "dean"] },
  { icon: AlertTriangle,   label: "Alerts",          path: "/alerts",     roles: ["admin", "dean", "doctor"] },
  { icon: Video,           label: "Camera",          path: "/camera",     roles: ["admin", "dean"] },
  { icon: BarChart3,       label: "Reports",         path: "/reports",    roles: ["admin", "dean"] },
  { icon: Settings,        label: "Settings",        path: "/settings",   roles: ["admin", "dean", "doctor", "student"] },
];

const navSections = [
  { label: "Main",       paths: ["/"] },
  { label: "Academics",  paths: ["/courses", "/schedules", "/sessions", "/attendance", "/students", "/doctors"] },
  { label: "Monitoring", paths: ["/alerts", "/camera", "/reports"] },
  { label: "System",     paths: ["/settings"] },
];

const Sidebar = () => {
  const location = useLocation();
  const { role, user, signOut } = useAuth();

  const filteredItems = navItems.filter((item) => {
    if (!role) return false;
    return item.roles.includes(role);
  });

  return (
    <aside className="w-64 min-h-screen flex flex-col border-r relative overflow-hidden transition-colors duration-300"
      style={{ background: "hsl(var(--sidebar-bg))", borderColor: "hsl(var(--sidebar-border))" }}>

      {/* -- Top gradient bleed -- */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent pointer-events-none" />

      {/* -- Dot grid pattern -- */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "radial-gradient(circle, hsl(217 91% 60% / 0.06) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      {/* -- Ambient glow blobs -- */}
      <div className="absolute top-0    left-0   w-full h-52  bg-gradient-to-b  from-primary/8  to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0   w-full h-52  bg-gradient-to-t  from-accent/8   to-transparent pointer-events-none" />
      <div className="absolute top-1/3  -left-24 w-56  h-56  rounded-full bg-primary/6  blur-[60px]  pointer-events-none" />
      <div className="absolute bottom-1/4 -right-16 w-40 h-40 rounded-full bg-accent/5   blur-[50px]  pointer-events-none" />

      {/* ------------------ LOGO ------------------ */}
      <div className="px-5 pt-6 pb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0 halo-3d">
            {/* Glow halo */}
            <div className="absolute inset-0 rounded-xl bg-primary/25 blur-lg scale-150 pointer-events-none" />
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-primary/50 to-accent/35 flex items-center justify-center shadow-[0_0_24px_hsl(6_63%_50%/0.4),inset_0_1px_0_hsl(0_0%_100%/0.15)]">
              <img src={owlMascot} alt="Trackify" className="w-7 h-7 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] float-3d" />
            </div>
            {/* Online dot */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-[hsl(217_52%_5%)] shadow-[0_0_8px_#4ade8090] animate-pulse" />
          </div>
          <div>
            <span className="text-[15px] font-black tracking-tight gradient-text">Trackify</span>
            <p className="text-[9px] uppercase tracking-[0.2em] leading-none mt-0.5 font-medium" style={{ color: "hsl(var(--sidebar-icon-color))" }}>Smart Monitor</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-black/[0.08] dark:via-white/[0.08] to-transparent" />

      {/* ------------------ NAVIGATION ------------------ */}
      <nav className="flex-1 px-3 py-4 relative z-10 overflow-y-auto space-y-1">
        {navSections.map((section) => {
          const sectionItems = filteredItems.filter(item => section.paths.includes(item.path));
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-1">
              <p className="text-[9px] uppercase tracking-[0.18em] font-bold px-3 mb-1.5 mt-3 first:mt-0"
                style={{ color: "hsl(var(--sidebar-section-label))" }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {sectionItems.map((item, index) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink key={item.label} to={item.path}>
                      <motion.div
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, type: "spring", stiffness: 320, damping: 26 }}
                      >
                        <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                          isActive
                            ? "text-foreground"
                            : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                        }`}
                          style={isActive ? {
                            background: "linear-gradient(90deg, hsl(217 91% 60% / 0.18), hsl(217 91% 60% / 0.06), transparent)",
                            boxShadow: "inset 0 1px 0 hsl(217 91% 60% / 0.15), 0 4px 24px hsl(217 91% 60% / 0.08)",
                          } : { color: "hsl(var(--sidebar-item-color))" }}
                        >
                          {/* Animated left neon stripe */}
                          {isActive && (
                            <motion.div
                              layoutId="sidebar-active-bar"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                              style={{ background: "linear-gradient(180deg, hsl(187 92% 69%), hsl(217 91% 60%), hsl(263 70% 58%))", boxShadow: "0 0 10px hsl(217 91% 60% / 0.8)" }}
                            />
                          )}

                          {/* Icon box */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                            isActive ? "bg-primary/20" : "group-hover:bg-black/[0.06] dark:group-hover:bg-white/[0.06]"
                          }`}
                            style={isActive ? { boxShadow: "0 0 16px hsl(217 91% 60% / 0.4), inset 0 1px 0 hsl(217 91% 60% / 0.2)" } : {}}
                          >
                            <item.icon className={`w-4 h-4 transition-all duration-200 ${
                              isActive ? "text-primary" : "group-hover:scale-110"
                            }`}
                              style={isActive
                                ? { filter: "drop-shadow(0 0 8px hsl(217 91% 60% / 0.9))" }
                                : { color: "hsl(var(--sidebar-icon-color))" }
                              }
                            />
                          </div>

                          <span className="flex-1 font-medium">{item.label}</span>

                          {isActive && (
                            <ChevronRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                          )}
                        </div>
                      </motion.div>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ------------------ FOOTER ------------------ */}
      <div className="px-3 pb-5 relative z-10">
        <div className="h-px bg-gradient-to-r from-transparent via-black/[0.07] dark:via-white/[0.07] to-transparent mb-3" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start hover:text-red-400 hover:bg-red-500/10 transition-all h-9 px-3 rounded-xl text-xs font-medium gap-2.5"
          style={{ color: "hsl(var(--sidebar-item-color))" }}
          onClick={signOut}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
