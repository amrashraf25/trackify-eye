import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useIncidentNotifications } from "@/hooks/useIncidentNotifications";
import { useDoctorNotifications } from "@/hooks/useDoctorNotifications";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import Students from "./pages/Students";
import Doctors from "./pages/Doctors";
import Alerts from "./pages/Alerts";
import Camera from "./pages/Camera";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Attendance from "./pages/Attendance";
import Sessions from "./pages/Sessions";
import Schedules from "./pages/Schedules";
import Behavior from "./pages/Behavior";
import Auth from "./pages/Auth";
import IncidentDetail from "./pages/IncidentDetail";
import Submissions from "./pages/Submissions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  useIncidentNotifications();
  useDoctorNotifications();
  
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Attendance /></ProtectedRoute>} />
      <Route path="/sessions"   element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor", "student"]}><Sessions /></ProtectedRoute>} />
      <Route path="/schedules"  element={<ProtectedRoute allowedRoles={["admin", "dean"]}><Schedules /></ProtectedRoute>} />
      <Route path="/behavior" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Behavior /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor", "student"]}><Courses /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Students /></ProtectedRoute>} />
      <Route path="/doctors" element={<ProtectedRoute allowedRoles={["admin", "dean"]}><Doctors /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><Alerts /></ProtectedRoute>} />
      <Route path="/camera" element={<ProtectedRoute allowedRoles={["admin", "dean"]}><Camera /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor", "student"]}><Settings /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "dean"]}><Reports /></ProtectedRoute>} />
      <Route path="/assignments" element={<Navigate to="/courses" replace />} />
      <Route path="/incident/:id" element={<ProtectedRoute allowedRoles={["admin", "dean", "doctor"]}><IncidentDetail /></ProtectedRoute>} />
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
