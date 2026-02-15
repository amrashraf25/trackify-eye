import { Bell, User, Sun, Moon } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Badge } from "./ui/badge";

interface HeaderProps {
  title: string;
}

const Header = ({ title }: HeaderProps) => {
  const { user, role } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 transition-colors duration-300">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* Notification */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full pulse-ring" />
        </Button>

        {/* Profile */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.user_metadata?.full_name || user?.email?.split("@")[0]}</p>
            {role && (
              <Badge variant="secondary" className="text-xs capitalize">
                {role}
              </Badge>
            )}
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-border">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
