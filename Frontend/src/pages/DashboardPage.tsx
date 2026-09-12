import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ChevronRight, FolderKanban, PanelTop, Search, Table2, X } from "lucide-react";
import { getProjects, Project as ApiProject, projectClients } from "../api/projects";
import PortalShell from "../components/PortalShell";
import { NotificationList } from "../components/NotificationList";
import { ProjectCard } from "../components/ProjectCard";
import { useNotifications } from "../hooks/useNotifications";
import { useNotificationSummary } from "../hooks/useNotificationSummary";
import { useProfile } from "../profile/ProfileContext";

type DashboardLayout = "attention-first" | "by-project";
const DASHBOARD_LAYOUT_KEY = "blueprint.dashboard.notification-layout";

const initialLayout = (): DashboardLayout => sessionStorage.getItem(DASHBOARD_LAYOUT_KEY) === "by-project" ? "by-project" : "attention-first";

function ProjectNotificationPreview({ projectId, projectTitle, unreadCount }: { projectId: number; projectTitle: string; unreadCount: number }) {
  const navigate = useNavigate();
  const notifications = useNotifications({ unreadOnly: true, limit: 3, projectId, autoRefresh: false });
  return <section className="dashboard-project-notifications" aria-label={`Notificações não lidas de ${projectTitle}`}>
    <div className="dashboard-project-notifications__heading">
      <strong>Atividade não lida</strong>
      {unreadCount > 3 && <button type="button" onClick={() => navigate("/notifications?unreadOnly=true")}>Ver todas<ChevronRight size={15} aria-hidden="true" /></button>}
    </div>
    {notifications.error && <p className="dashboard-notification-error" role="alert">{notifications.error}</p>}
    <NotificationList items={notifications.items} loading={notifications.loading} emptyText="Sem notificações por ler." groupByDay={false} onRead={notifications.read} />
  </section>;
}

function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [companyProjects, setCompanyProjects] = useState<ApiProject[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayoutState] = useState<DashboardLayout>(initialLayout);
  const notifications = useNotifications({ unreadOnly: true, limit: 8 });
  const notificationSummary = useNotificationSummary();
  const profileName = profile?.displayName ?? "Ana Martins";
  const firstName = profileName.trim().split(/\s+/)[0] || "Ana";
  const isClientProfile = profile?.profileType === "client";
  const canViewArchitects = profile?.companyRole === "owner";

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");
    getProjects()
      .then((loadedProjects) => {
        if (!Array.isArray(loadedProjects)) throw new Error("Não foi possível carregar os projetos.");
        if (isCurrent) setCompanyProjects(loadedProjects);
      })
      .catch((caught) => { if (isCurrent) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os projetos."); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, []);

  const setLayout = (value: DashboardLayout) => { sessionStorage.setItem(DASHBOARD_LAYOUT_KEY, value); setLayoutState(value); };
  const unreadCounts = useMemo(() => new Map((notificationSummary.summary?.projectUnreadCounts ?? []).map((item) => [item.projectId, item.unreadCount])), [notificationSummary.summary]);
  const activeProjects = useMemo(() => companyProjects.filter((project) => !project.isArchived), [companyProjects]);
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-PT");
    if (!normalizedQuery) return activeProjects;
    return activeProjects.filter((project) => [project.title, project.code, project.address,
      ...projectClients(project).map((client) => client.displayName), project.companyName,
      ...(project.members?.map((member) => member.displayName) ?? []),
    ].join(" ").toLocaleLowerCase("pt-PT").includes(normalizedQuery));
  }, [activeProjects, query]);

  const projectCard = (project: ApiProject) => <ProjectCard key={project.id}
    project={project}
    canViewArchitects={!isClientProfile && canViewArchitects}
    contactDisplay={isClientProfile ? "architects" : "client"}
    unreadNotificationCount={unreadCounts.get(project.id) ?? 0}
  />;

  return <PortalShell>
    <header className="dashboard-header">
      <div><p className="dashboard-kicker">Segunda-feira, 27 de julho</p><h1>Bom dia, {firstName}</h1><p>Acompanha os projetos ativos e o que requer a tua atenção.</p></div>
      {profile?.companyRole === "owner" && <button className="primary-action" type="button" onClick={() => navigate("/projects/new")}><span aria-hidden="true">+</span>Criar projeto</button>}
    </header>

    <div className="dashboard-view-toolbar">
      <span>Organização do dashboard</span>
      <div className="dashboard-view-toggle" role="group" aria-label="Organização do dashboard">
        <button type="button" title="Notificações acima dos projetos" aria-label="Notificações acima dos projetos" aria-pressed={layout === "attention-first"} onClick={() => setLayout("attention-first")}><PanelTop size={18} aria-hidden="true" /></button>
        <button type="button" title="Notificações agrupadas por projeto" aria-label="Notificações agrupadas por projeto" aria-pressed={layout === "by-project"} onClick={() => setLayout("by-project")}><Table2 size={18} aria-hidden="true" /></button>
      </div>
    </div>

    {layout === "attention-first" && <section className="dashboard-attention" aria-labelledby="dashboard-attention-title">
      <div className="section-heading">
        <div><h2 id="dashboard-attention-title">Requer a tua atenção</h2><p>{notificationSummary.summary?.unreadCount ?? notifications.items.length} notificações por ler</p></div>
        <div className="dashboard-attention__actions">
          <button type="button" disabled={!notifications.items.length} onClick={() => void notifications.readAll()}><CheckCheck size={16} aria-hidden="true" />Marcar tudo como lido</button>
          <button type="button" onClick={() => navigate("/notifications?unreadOnly=true")}>Ver todas<ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </div>
      {!error && (notifications.error || notificationSummary.error) && <p className="dashboard-notification-error" role="alert">{notifications.error || notificationSummary.error}</p>}
      <NotificationList items={notifications.items} loading={notifications.loading} emptyText="Tudo em dia." onRead={notifications.read} />
    </section>}

    <label className="mock-search mock-project-search" htmlFor="company-dashboard-project-search">
      <Search size={19} aria-hidden="true" /><span className="sr-only">Pesquisar projetos</span>
      <input id="company-dashboard-project-search" type="search" placeholder="Pesquisar por projeto, cliente ou morada" value={query} onChange={(event) => setQuery(event.target.value)} />
      {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}
    </label>

    <section className="projects-section" aria-labelledby="company-active-projects-title">
      <div className="section-heading">
        <div><h2 id="company-active-projects-title">Projetos ativos</h2>{!isLoading && !error && <p>{filteredProjects.length} {filteredProjects.length === 1 ? "projeto encontrado" : "projetos em curso"}</p>}</div>
        <button type="button" onClick={() => navigate("/projects")}>Ver todos os projetos<ChevronRight size={17} aria-hidden="true" /></button>
      </div>

      {isLoading ? <p className="dashboard-project-state" role="status">A carregar projetos…</p>
        : error ? <p className="dashboard-project-state dashboard-project-state--error" role="alert">{error}</p>
        : filteredProjects.length ? layout === "attention-first"
          ? <div className="mock-project-grid">{filteredProjects.map(projectCard)}</div>
          : <div className="dashboard-project-rows">{filteredProjects.map((project) => {
            const unreadCount = unreadCounts.get(project.id) ?? 0;
            return <div className="dashboard-project-row" role="group" aria-label={`Projeto ${project.title}`} key={project.id}>
              <div className="dashboard-project-row__project">{projectCard(project)}</div>
              {unreadCount > 0 ? <ProjectNotificationPreview projectId={project.id} projectTitle={project.title} unreadCount={unreadCount} key={`${project.id}-${unreadCount}`} />
                : <div className="dashboard-project-notifications dashboard-project-notifications--empty"><Bell size={20} aria-hidden="true" /><p>Sem notificações por ler.</p></div>}
            </div>;
          })}</div>
        : query.trim() ? <div className="empty-state"><Search size={24} aria-hidden="true" /><h3>Não encontrámos projetos</h3><p>Experimenta pesquisar por outro nome, cliente ou morada.</p><button type="button" onClick={() => setQuery("")}>Limpar pesquisa</button></div>
        : <div className="empty-state"><FolderKanban size={24} aria-hidden="true" /><h3>Não existem projetos ativos</h3><p>Os novos projetos ativos aparecerão aqui.</p></div>}
    </section>
  </PortalShell>;
}

export default DashboardPage;
