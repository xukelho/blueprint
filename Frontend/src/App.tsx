import { Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import {
  ClientPage,
  ClientsPage,
  HelpPage,
  NotificationsPage,
  ProfilePage,
  ProjectCreatePage,
  ProjectPage,
  ProjectsPage,
  SettingsPage,
} from "./pages/MockupPages";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<ProjectCreatePage />} />
      <Route path="/projects/casa-do-vale" element={<ProjectPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/clients/marta-silva" element={<ClientPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
