import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Layers3,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Settings,
  Users,
  X,
} from "lucide-react";
import { clearAuthenticatedRoles, isPlatformAdmin } from "../auth";

type Project = {
  id: number;
  title: string;
  code: string;
  client: string;
  address: string;
  phase: string;
  revision: string;
  status: "Ativo" | "A aguardar cliente" | "Em análise";
  notifications: number;
  plan: "courtyard" | "linear" | "compact";
};

const projects: Project[] = [
  {
    id: 1,
    title: "Casa do Vale",
    code: "CV-024",
    client: "Marta e João Silva",
    address: "Azeitão, Setúbal",
    phase: "Projeto de execução",
    revision: "R07",
    status: "A aguardar cliente",
    notifications: 3,
    plan: "courtyard",
  },
  {
    id: 2,
    title: "Apartamento Alvalade",
    code: "AA-018",
    client: "Inês Costa",
    address: "Alvalade, Lisboa",
    phase: "Estudo prévio",
    revision: "R03",
    status: "Em análise",
    notifications: 1,
    plan: "linear",
  },
  {
    id: 3,
    title: "Atelier da Ribeira",
    code: "AR-031",
    client: "Ribeira Criativa, Lda.",
    address: "Alcântara, Lisboa",
    phase: "Licenciamento",
    revision: "R05",
    status: "Ativo",
    notifications: 0,
    plan: "compact",
  },
  {
    id: 4,
    title: "Moradia Monte Estoril",
    code: "ME-029",
    client: "Pedro Almeida",
    address: "Monte Estoril, Cascais",
    phase: "Projeto de execução",
    revision: "R09",
    status: "Ativo",
    notifications: 2,
    plan: "courtyard",
  },
  {
    id: 5,
    title: "Casa Pátio",
    code: "CP-027",
    client: "Leonor Ferreira",
    address: "Comporta, Grândola",
    phase: "Estudo prévio",
    revision: "R02",
    status: "A aguardar cliente",
    notifications: 4,
    plan: "compact",
  },
  {
    id: 6,
    title: "Escritório do Chiado",
    code: "EC-022",
    client: "Vértice Partners",
    address: "Chiado, Lisboa",
    phase: "Licenciamento",
    revision: "R04",
    status: "Em análise",
    notifications: 0,
    plan: "linear",
  },
];

const primaryNav = [
  { label: "Dashboard", icon: LayoutDashboard, active: true, path: "/dashboard", mockStatus: "mock" },
  { label: "Projetos", icon: FolderKanban, path: "/projects", mockStatus: "mock" },
  { label: "Clientes", icon: Users, path: "/clients", mockStatus: "mock" },
  { label: "Administração", icon: ShieldCheck, path: "/administration", mockStatus: undefined },
  { label: "Definições", icon: Settings, path: "/settings", mockStatus: "mock" },
];

const secondaryNav = [
  { label: "Notificações", icon: Bell, badge: 6, path: "/notifications", mockStatus: "mock" },
  { label: "Ajuda e suporte", icon: CircleHelp, path: "/help", mockStatus: "mock" },
];

function PlanPreview({ variant }: { variant: Project["plan"] }) {
  return (
    <div className={`plan-preview plan-preview--${variant}`} aria-hidden="true">
      <span className="plan-room plan-room--a" />
      <span className="plan-room plan-room--b" />
      <span className="plan-room plan-room--c" />
      <span className="plan-room plan-room--d" />
      <span className="plan-door plan-door--a" />
      <span className="plan-door plan-door--b" />
      <span className="plan-dimension plan-dimension--a">4.20</span>
      <span className="plan-dimension plan-dimension--b">3.60</span>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const visiblePrimaryNav = primaryNav.filter(
    (item) => item.path !== "/administration" || isPlatformAdmin(),
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-PT");
    if (!normalizedQuery) return projects;
    return projects.filter((project) =>
      [project.title, project.client, project.address, project.code]
        .join(" ")
        .toLocaleLowerCase("pt-PT")
        .includes(normalizedQuery),
    );
  }, [query]);

  const selectProject = () => {
    navigate("/projects/casa-do-vale");
  };

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
          <div className="sidebar-brand" aria-label="Blueprint">
            <span className="sidebar-brand__mark" aria-hidden="true">
              <Layers3 size={20} strokeWidth={1.8} />
            </span>
            <span className="sidebar-label sidebar-brand__name">blueprint</span>
          </div>
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
          <span className="atelier-context__icon" aria-hidden="true">
            <Building2 size={17} />
          </span>
          <span className="sidebar-label">
            <small>Atelier ativo</small>
            <strong>Forma Norte</strong>
          </span>
        </div>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          <div className="nav-group">
            {visiblePrimaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`nav-item ${item.active ? "nav-item--active" : ""}`}
                  type="button"
                  key={item.label}
                  title={sidebarCollapsed && item.mockStatus ? `${item.label} — Mock` : sidebarCollapsed ? item.label : undefined}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => navigate(item.path)}
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
              return (
                <button
                  className="nav-item"
                  type="button"
                  key={item.label}
                  title={sidebarCollapsed ? `${item.label} — Mock` : undefined}
                  onClick={() => navigate(item.path)}
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="sidebar-label">{item.label}</span>
                  <span className="nav-status nav-status--mock" aria-hidden="true">Mock</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              );
            })}
            <button
              className="user-menu"
              type="button"
              title={sidebarCollapsed ? "Menu de utilizador — Mock" : undefined}
              onClick={() => navigate("/profile")}
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
        <div className="dashboard__inner">
          <header className="dashboard-header">
            <div>
              <p className="dashboard-kicker">Segunda-feira, 27 de julho</p>
              <h1>Bom dia, Ana</h1>
              <p>Acompanha os projetos ativos e o que requer a tua atenção.</p>
            </div>
            <button className="primary-action" type="button" onClick={() => navigate("/projects/new")}>
              <span aria-hidden="true">+</span>
              Criar projeto
            </button>
          </header>

          <section className="dashboard-search" aria-label="Pesquisa de projetos">
            <label htmlFor="project-search">Pesquisar projetos</label>
            <div className="dashboard-search__field">
              <Search size={20} aria-hidden="true" />
              <input
                id="project-search"
                type="search"
                placeholder="Pesquisar por projeto, cliente ou morada"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}>
                  <X size={17} />
                </button>
              )}
              <span className="search-shortcut" aria-hidden="true">⌘ K</span>
            </div>
          </section>

          <section className="projects-section" aria-labelledby="active-projects-title">
            <div className="section-heading">
              <div>
                <h2 id="active-projects-title">Projetos ativos</h2>
                <p>
                  {filteredProjects.length} {filteredProjects.length === 1 ? "projeto encontrado" : "projetos em curso"}
                </p>
              </div>
              <button type="button" onClick={() => navigate("/projects")}>
                Ver todos os projetos
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>

            {filteredProjects.length > 0 ? (
              <div className="project-grid">
                {filteredProjects.map((project) => (
                  <article className="dashboard-project-card" key={project.id}>
                    <div className="project-preview">
                      <div className="project-code">{project.code}</div>
                      <button
                        className="project-more"
                        type="button"
                        aria-label={`Abrir definições de ${project.title}`}
                        aria-expanded={openMenu === project.id}
                        onClick={() => setOpenMenu((current) => current === project.id ? null : project.id)}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                      {openMenu === project.id && (
                        <div className="project-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => navigate("/projects/casa-do-vale?tab=settings")}>
                            Abrir definições
                          </button>
                          <button type="button" role="menuitem" onClick={() => navigate("/projects/casa-do-vale?tab=activity")}>
                            Ver atividade
                          </button>
                        </div>
                      )}
                      <button
                        className="project-preview__open"
                        type="button"
                        aria-label={`Abrir projeto ${project.title}`}
                        onClick={selectProject}
                      >
                        <PlanPreview variant={project.plan} />
                      </button>
                    </div>

                    <button className="project-card__content" type="button" onClick={selectProject}>
                      <span className="project-card__title-row">
                        <strong>{project.title}</strong>
                        <ChevronRight size={17} aria-hidden="true" />
                      </span>
                      <span className="project-card__client">{project.client}</span>
                      <span className="project-card__address">
                        <MapPin size={14} aria-hidden="true" />
                        {project.address}
                      </span>
                      <span className="project-card__meta">
                        <span>{project.phase}</span>
                        <span>{project.revision}</span>
                      </span>
                    </button>

                    <footer className="project-card__footer-row">
                      <span className={`status-pill status-pill--${project.status === "Ativo" ? "active" : project.status === "Em análise" ? "review" : "waiting"}`}>
                        <i aria-hidden="true" />
                        {project.status}
                      </span>
                      <span className={`notification-count ${project.notifications === 0 ? "notification-count--empty" : ""}`}>
                        <Bell size={15} aria-hidden="true" />
                        <span>{project.notifications}</span>
                        <span className="sr-only">{project.notifications === 1 ? "notificação" : "notificações"}</span>
                      </span>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={24} aria-hidden="true" />
                <h3>Não encontrámos projetos</h3>
                <p>Experimenta pesquisar por outro nome, cliente ou morada.</p>
                <button type="button" onClick={() => setQuery("")}>Limpar pesquisa</button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
