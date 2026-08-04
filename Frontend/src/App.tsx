import { useSyncExternalStore } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import AdministrationPage from "./pages/AdministrationPage";
import EmployeePage from "./pages/EmployeePage";
import ClientPage from "./pages/ClientPage";
import CompanySettingsPage from "./pages/CompanySettingsPage";
import { getAuthenticatedRoles, isClient, isEmployee, isPlatformAdmin } from "./auth";
import { ProfileProvider, useProfile } from "./profile/ProfileContext";
import { HelpPage, NotificationsPage } from "./pages/MockupPages";
import { CompanyClientPage, CompanyClientDetailPage } from "./pages/CompanyClientPage";
import { CompanyProjectsPage } from "./pages/CompanyProjectsPage";
import { CompanyProjectsCreatePage } from "./pages/CompanyProjectsCreatePage";
import { CompanyProjectPage } from "./pages/CompanyProjectPage";

function AdministrationRoute() {
  return isPlatformAdmin()
    ? <AdministrationPage />
    : <Navigate to="/dashboard" replace />;
}

function ProfileRoute() {
  if (isPlatformAdmin()) return <Navigate to="/dashboard" replace />;
  if (isEmployee()) return <EmployeePage />;
  if (isClient()) return <ClientPage />;
  return <Navigate to="/dashboard" replace />;
}

function CompanySettingsRoute() {
  const { profile, isLoading } = useProfile();
  if (!isEmployee()) return <Navigate to="/dashboard" replace />;
  if (isLoading) return null;
  return profile?.profileType === "employee" && profile.companyRole === "owner"
    ? <CompanySettingsPage />
    : <Navigate to="/dashboard" replace />;
}

function subscribeToAuthenticationChanges(onStoreChange: () => void) {
  window.addEventListener("blueprint:auth-changed", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("blueprint:auth-changed", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function AuthenticatedRoute() {
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuthenticationChanges,
    () => getAuthenticatedRoles().length > 0,
    () => false,
  );

  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />;
}

function App() {
  return (
    <ProfileProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route element={<AuthenticatedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<CompanyProjectsPage />} />
          <Route path="/projects/new" element={<CompanyProjectsCreatePage />} />
          <Route path="/projects/:id" element={<CompanyProjectPage />} />
          <Route path="/clients" element={<CompanyClientPage />} />
          <Route path="/clients/:id" element={<CompanyClientDetailPage />} />
          <Route
            path="/administration"
            element={<AdministrationRoute />}
          />
          <Route path="/settings" element={<CompanySettingsRoute />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/profile" element={<ProfileRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProfileProvider>
  );
}

export default App;
