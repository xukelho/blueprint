import { ReactNode, useState } from "react";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const primaryNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Projetos", icon: FolderKanban, path: "/projects" },
  { label: "Clientes", icon: Users, path: "/clients" },
  { label: "Definições", icon: Settings, path: "/settings" },
];

const secondaryNav = [
  { label: "Notificações", icon: Bell, path: "/notifications", badge: 6 },
  { label: "Ajuda e suporte", icon: CircleHelp, path: "/help" },
];

type PortalShellProps = {
  children: ReactNode;
  wide?: boolean;
};

export default function PortalShell({ children, wide = false }: PortalShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`);

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
              <Layers3 size={20} strokeWidth={1.8} />
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
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  className={`nav-item ${active ? "nav-item--active" : ""}`}
                  type="button"
                  key={item.path}
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
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
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              );
            })}
            <button
              className={`user-menu ${location.pathname === "/profile" ? "user-menu--active" : ""}`}
              type="button"
              title={sidebarCollapsed ? "Perfil de utilizador" : undefined}
              onClick={() => goTo("/profile")}
            >
              <span className="user-avatar">AM</span>
              <span className="sidebar-label user-menu__copy">
                <strong>Ana Martins</strong>
                <small>Arquiteta</small>
              </span>
              <MoreHorizontal className="sidebar-label" size={18} aria-hidden="true" />
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
