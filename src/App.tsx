import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireRole } from "@/components/RequireRole";
import Dashboard from "@/pages/Dashboard";
import SubmitIncident from "@/pages/SubmitIncident";
import Records from "@/pages/Records";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import AdminPanel from "@/pages/AdminPanel";
import SettingsPage from "@/pages/SettingsPage";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route
                  path="/submit"
                  element={
                    <RequireRole permission="submit_incident">
                      <SubmitIncident />
                    </RequireRole>
                  }
                />
                <Route
                  path="/records"
                  element={
                    <RequireRole permission="view_own_records">
                      <Records />
                    </RequireRole>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <RequireRole permission="view_analytics">
                      <Analytics />
                    </RequireRole>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RequireRole permission="view_reports">
                      <Reports />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireRole permission="manage_users">
                      <AdminPanel />
                    </RequireRole>
                  }
                />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
