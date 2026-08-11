import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, FolderKanban, Search, X } from "lucide-react";
import { getProjects, Project as ApiProject } from "../api/projects";
import PortalShell from "../components/PortalShell";
import { ProjectCard } from "../components/ProjectCard";
import { useProfile } from "../profile/ProfileContext";

function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [companyProjects, setCompanyProjects] = useState<ApiProject[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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
        if (!Array.isArray(loadedProjects)) {
          throw new Error("Não foi possível carregar os projetos.");
        }
        if (isCurrent) setCompanyProjects(loadedProjects);
      })
      .catch((caught) => {
        if (isCurrent) {
          setError(caught instanceof Error ? caught.message : "Não foi possível carregar os projetos.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const activeProjects = useMemo(
    () => companyProjects.filter((project) => !project.isArchived),
    [companyProjects],
  );
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-PT");
    if (!normalizedQuery) return activeProjects;
    return activeProjects.filter((project) =>
      [
        project.title,
        project.code,
        project.address,
        project.client?.displayName ?? "",
        project.companyName,
        ...(project.members?.map((member) => member.displayName) ?? []),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-PT")
        .includes(normalizedQuery),
    );
  }, [activeProjects, query]);

  return (
    <PortalShell>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">Segunda-feira, 27 de julho</p>
          <h1>Bom dia, {firstName}</h1>
          <p>Acompanha os projetos ativos e o que requer a tua atenção.</p>
        </div>
        {profile?.companyRole === "owner" && (
          <button className="primary-action" type="button" onClick={() => navigate("/projects/new")}>
            <span aria-hidden="true">+</span>
            Criar projeto
          </button>
        )}
      </header>

      <label className="mock-search mock-project-search" htmlFor="company-dashboard-project-search">
        <Search size={19} aria-hidden="true" />
        <span className="sr-only">Pesquisar projetos</span>
        <input
          id="company-dashboard-project-search"
          type="search"
          placeholder="Pesquisar por projeto, cliente ou morada"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}>
            <X size={16} />
          </button>
        )}
      </label>

      <section className="projects-section" aria-labelledby="company-active-projects-title">
        <div className="section-heading">
          <div>
            <h2 id="company-active-projects-title">Projetos ativos</h2>
            {!isLoading && !error && (
              <p>
                {filteredProjects.length} {filteredProjects.length === 1 ? "projeto encontrado" : "projetos em curso"}
              </p>
            )}
          </div>
          <button type="button" onClick={() => navigate("/projects")}>
            Ver todos os projetos
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <p className="dashboard-project-state" role="status">A carregar projetos…</p>
        ) : error ? (
          <p className="dashboard-project-state dashboard-project-state--error" role="alert">{error}</p>
        ) : filteredProjects.length ? (
          <div className="mock-project-grid">
            {filteredProjects.map((project) => (
              <ProjectCard
                project={project}
                canViewArchitects={!isClientProfile && canViewArchitects}
                contactDisplay={isClientProfile ? "architects" : "client"}
                showNotificationBar
                key={project.id}
              />
            ))}
          </div>
        ) : query.trim() ? (
          <div className="empty-state">
            <Search size={24} aria-hidden="true" />
            <h3>Não encontrámos projetos</h3>
            <p>Experimenta pesquisar por outro nome, cliente ou morada.</p>
            <button type="button" onClick={() => setQuery("")}>Limpar pesquisa</button>
          </div>
        ) : (
          <div className="empty-state">
            <FolderKanban size={24} aria-hidden="true" />
            <h3>Não existem projetos ativos</h3>
            <p>Os novos projetos ativos aparecerão aqui.</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}

export default DashboardPage;
