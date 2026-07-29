import { Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import AdministrationPage from "./pages/AdministrationPage";
import EmployeePage from "./pages/EmployeePage";
import ClientPage from "./pages/ClientPage";
import { isClient, isEmployee, isPlatformAdmin } from "./auth";
import {
  ClientPage as ClientDetailMockPage,
  ClientsPage,
  HelpPage,
  NotificationsPage,
  ProjectCreatePage,
  ProjectPage,
  ProjectsPage,
  SettingsPage,
} from "./pages/MockupPages";

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

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<ProjectCreatePage />} />
      <Route path="/projects/casa-do-vale" element={<ProjectPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/clients/marta-silva" element={<ClientDetailMockPage />} />
      <Route
        path="/administration"
        element={<AdministrationRoute />}
      />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/profile" element={<ProfileRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
