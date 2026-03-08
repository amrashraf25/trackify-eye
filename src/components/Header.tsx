import { Bell, User, Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "./ui/badge";
import { motion } from "framer-motion";

interface HeaderProps {
  title: string;
}

const Header = ({ title }: HeaderProps) => {
  const { user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 glass border-b border-border/50 flex items-center justify-between px-6 transition-colors duration-300 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </motion.div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-xl transition-all"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Notification */}
        <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-secondary/80">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-neon-cyan rounded-full pulse-ring" />
        </Button>

        {/* Profile */}
        <div className="flex items-center gap-3 ml-1 pl-3 border-l border-border/50">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.user_metadata?.full_name || user?.email?.split("@")[0]}</p>
            {role && (
              <Badge className="text-[10px] capitalize bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {role}
              </Badge>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/20">
            <User className="w-4 h-4 text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
