import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireRole } from "@/components/RequireRole";
import { PageSkeleton } from "@/components/ReliabilityState";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const SubmitIncident = lazy(() => import("@/pages/SubmitIncident"));
const Records = lazy(() => import("@/pages/Records"));
const IncidentCase = lazy(() => import("@/pages/IncidentCase"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Reports = lazy(() => import("@/pages/Reports"));
const AdminPanel = lazy(() => import("@/pages/AdminPanel"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const Login = lazy(() => import("@/pages/Login"));
const SignUp = lazy(() => import("@/pages/SignUp"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<main className="p-4 sm:p-6"><PageSkeleton /></main>}>
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
                  path="/incidents/:id"
                  element={
                    <RequireRole permission="view_own_records">
                      <IncidentCase />
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
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profiles" element={<ProfilePage />} />
                <Route
                  path="/admin"
                  element={
                    <RequireRole permission="manage_users">
                      <AdminPanel />
                    </RequireRole>
                  }
                />
                <Route path="/settings" element={<RequireRole permission="system_settings"><SettingsPage /></RequireRole>} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
