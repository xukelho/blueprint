import { ReactNode, useState } from "react";
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
import { clearAuthenticatedRoles, isPlatformAdmin } from "../auth";
import { BlueprintLogoMark } from "./BlueprintLogoMark";

const primaryNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", mockStatus: "mock" },
  { label: "Projetos", icon: FolderKanban, path: "/projects", mockStatus: "mock" },
  { label: "Clientes", icon: Users, path: "/clients", mockStatus: "mock" },
  { label: "Administração", icon: ShieldCheck, path: "/administration", mockStatus: undefined },
  { label: "Definições", icon: Settings, path: "/settings", mockStatus: "mock" },
];

const secondaryNav = [
  { label: "Notificações", icon: Bell, path: "/notifications", badge: 6, mockStatus: "mock" },
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
  const navigate = useNavigate();
  const location = useLocation();
  const visiblePrimaryNav = primaryNav.filter(
    (item) => item.path !== "/administration" || isPlatformAdmin(),
  );

  const goTo = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

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
            <small>Atelier ativo</small>
            <strong>Forma Norte</strong>
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
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  className={`nav-item ${active ? "nav-item--active" : ""}`}
                  type="button"
                  key={item.path}
                  title={sidebarCollapsed ? `${item.label} — Mock` : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
                  <span className="nav-status nav-status--mock" aria-hidden="true">Mock</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              );
            })}
            <button
              className={`user-menu ${location.pathname === "/profile" ? "user-menu--active" : ""}`}
              type="button"
              title={sidebarCollapsed ? "Perfil de utilizador — Mock" : undefined}
              onClick={() => goTo("/profile")}
            >
              <span className="user-avatar">AM</span>
              <span className="sidebar-label user-menu__copy">
                <strong>Ana Martins</strong>
                <small>Arquiteta</small>
              </span>
              <span className="nav-status nav-status--mock" aria-hidden="true">Mock</span>
              <MoreHorizontal className="sidebar-label" size={18} aria-hidden="true" />
            </button>
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
