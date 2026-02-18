import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useIncidentNotifications } from "@/hooks/useIncidentNotifications";
import ProtectedRoute from "@/components/ProtectedRoute";
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
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Students /></ProtectedRoute>} />
      <Route path="/doctors" element={<ProtectedRoute allowedRoles={["admin", "dean"]}><Doctors /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Alerts /></ProtectedRoute>} />
      <Route path="/camera" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Camera /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Reports /></ProtectedRoute>} />
      <Route path="/incident/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
