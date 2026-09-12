import { ReactNode, useEffect, useState } from "react";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  ShieldCheck,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearAuthenticatedRoles, getAuthenticatedRoles, isEmployee, isPlatformAdmin } from "../auth";
import {
  profileInitials,
  profileRoleLabel,
  useOptionalProfile,
} from "../profile/ProfileContext";
import { BlueprintLogoMark } from "./BlueprintLogoMark";
import { getNotificationSummary, NOTIFICATIONS_CHANGED_EVENT } from "../api/notifications";

const primaryNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", mockStatus: undefined },
  { label: "Projetos", icon: FolderKanban, path: "/projects", mockStatus: undefined },
  { label: "Clientes", icon: Users, path: "/clients", mockStatus: undefined },
  { label: "Administração", icon: ShieldCheck, path: "/administration", mockStatus: undefined },
  { label: "Definições", icon: Settings, path: "/settings", mockStatus: undefined },
];

const secondaryNav = [
  { label: "Notificações", icon: Bell, path: "/notifications", mockStatus: undefined },
  { label: "Ajuda e suporte", icon: CircleHelp, path: "/help", mockStatus: "mock" },
];

type PortalShellProps = {
  children: ReactNode;
  wide?: boolean;
};

export default function PortalShell({ children, wide = false }: PortalShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useOptionalProfile()?.profile ?? null;
  const profileName = profile?.displayName ?? "Ana Martins";
  const profileRole = profile ? profileRoleLabel(profile) : "Arquiteta";
  const profileCompany = profile?.companyName ?? "Forma Norte";
  const isClientProfile = profile?.profileType === "client";
  const isAdminProfile = isPlatformAdmin();
  const isAuthenticated = getAuthenticatedRoles().length > 0;
  const visibleSecondaryNav = secondaryNav.filter((item) => !isAdminProfile || item.path !== "/notifications");
  const visiblePrimaryNav = primaryNav.filter(
      (item) =>
      (!isAdminProfile || item.path !== "/dashboard" && item.path !== "/projects") &&
      (item.path !== "/clients" || isEmployee()) &&
      (item.path !== "/administration" || isAdminProfile) &&
      (item.path !== "/settings" || isEmployee() && profile?.companyRole === "owner"),
  );

  const goTo = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  useEffect(() => {
    if (!isAuthenticated || isAdminProfile) return;
    let active = true;
    const refresh = () => { void getNotificationSummary().then((summary) => { if (active) setNotificationCount(summary.total); }).catch(() => undefined); };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh); };
  }, [isAdminProfile, isAuthenticated]);

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearAuthenticatedRoles();
      navigate("/", { replace: true });
    }
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell--collapsed" : ""}`}>
      <button
        className="mobile-menu-button"
        type="button"
        aria-label="Abrir navegação"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu size={20} />
      </button>

      {mobileNavOpen && (
        <button
          className="nav-scrim"
          type="button"
          aria-label="Fechar navegação"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? "sidebar--mobile-open" : ""}`}>
        <div className="sidebar__header">
          <button className="sidebar-brand sidebar-brand--button" type="button" onClick={() => goTo("/dashboard")}>
            <span className="sidebar-brand__mark" aria-hidden="true">
              <BlueprintLogoMark />
            </span>
            <span className="sidebar-label sidebar-brand__name">blueprint</span>
          </button>
          <button
            className="mobile-close-button"
            type="button"
            aria-label="Fechar navegação"
            onClick={() => setMobileNavOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="atelier-context">
          <span className="atelier-context__icon" aria-hidden="true"><Building2 size={17} /></span>
          <span className="sidebar-label">
            <small>{isClientProfile ? "Empresas associadas" : "Atelier ativo"}</small>
            <strong>{isClientProfile ? profile.availableCompanies.length : profileCompany}</strong>
          </span>
        </div>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          <div className="nav-group">
            {visiblePrimaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  className={`nav-item ${active ? "nav-item--active" : ""}`}
                  type="button"
                  key={item.path}
                  aria-label={item.label}
                  title={sidebarCollapsed && item.mockStatus ? `${item.label} — Mock` : sidebarCollapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
                  {item.mockStatus && (
                    <span className={`nav-status nav-status--${item.mockStatus}`} aria-hidden="true">
                      Mock
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="nav-group nav-group--bottom">
            {visibleSecondaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  className={`nav-item ${active ? "nav-item--active" : ""}`}
                  type="button"
                  key={item.path}
                  aria-label={item.label}
                  title={sidebarCollapsed ? (item.mockStatus ? `${item.label} — Mock` : item.label) : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
                  {item.mockStatus && <span className="nav-status nav-status--mock" aria-hidden="true">Mock</span>}
                  {item.path === "/notifications" && notificationCount > 0 && <span className="nav-badge">{notificationCount > 99 ? "99+" : notificationCount}</span>}
                </button>
              );
            })}
            {!isPlatformAdmin() && (
              <button
                className={`user-menu ${location.pathname === "/profile" ? "user-menu--active" : ""}`}
                type="button"
                title={sidebarCollapsed ? "Perfil de utilizador" : undefined}
                onClick={() => goTo("/profile")}
              >
                <span className="user-avatar">{profileInitials(profileName)}</span>
                <span className="sidebar-label user-menu__copy">
                  <strong>{profileName}</strong>
                  <small>{profileRole}</small>
                </span>
                <MoreHorizontal className="sidebar-label" size={18} aria-hidden="true" />
              </button>
            )}
            <button
              className="nav-item logout-button"
              type="button"
              title={sidebarCollapsed ? "Terminar sessão" : undefined}
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              <LogOut size={19} strokeWidth={1.8} aria-hidden="true" />
              <span className="sidebar-label">
                {isLoggingOut ? "A terminar sessão…" : "Terminar sessão"}
              </span>
            </button>
          </div>
        </nav>

        <button
          className="sidebar-toggle"
          type="button"
          aria-label={sidebarCollapsed ? "Expandir navegação" : "Recolher navegação"}
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <span className="sidebar-label">Recolher menu</span>
        </button>
      </aside>

      <main className="dashboard">
        <div className={`dashboard__inner portal-page ${wide ? "portal-page--wide" : ""}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
