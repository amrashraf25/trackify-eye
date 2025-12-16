import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useIncidentNotifications } from "@/hooks/useIncidentNotifications";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import Students from "./pages/Students";
import Doctors from "./pages/Doctors";
import Alerts from "./pages/Alerts";
import Camera from "./pages/Camera";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Auth from "./pages/Auth";
import IncidentDetail from "./pages/IncidentDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useIncidentNotifications();
  
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/courses" element={<Courses />} />
      <Route path="/students" element={<Students />} />
      <Route path="/doctors" element={<Doctors />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/camera" element={<Camera />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/incident/:id" element={<IncidentDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
