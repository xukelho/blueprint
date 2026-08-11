import { useEffect, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { getProjects, Project } from "../api/projects";
import { useProfile } from "../profile/ProfileContext";
import { ProjectCard } from "../components/ProjectCard";

function ErrorMessage({ value }: { value: string }) {
  return value ? <p role="alert">{value}</p> : null;
}

export function CompanyProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [activeOpen, setActiveOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(true);
  const navigate = useNavigate();
  const { profile } = useProfile();

  useEffect(() => {
    getProjects().then(setProjects).catch((caught) => setError(caught instanceof globalThis.Error ? caught.message : "Não foi possível carregar os projetos."));
  }, []);

  const filtered = projects.filter((project) => `${project.title} ${project.code} ${project.address} ${project.client?.displayName ?? ""} ${project.companyName}`.toLocaleLowerCase("pt-PT").includes(query.toLocaleLowerCase("pt-PT")));
  const canViewArchitects = profile?.profileType === "client" || (profile?.profileType === "employee" && profile.companyRole === "owner");
  const activeProjects = filtered.filter((project) => !project.isArchived);
  const archivedProjects = filtered.filter((project) => project.isArchived);
  const groupProjects = (items: Project[]) => items.reduce<Array<{ companyId: number; companyName: string; projects: Project[] }>>((groups, project) => {
    const group = groups.find((candidate) => candidate.companyId === project.companyId);
    if (group) group.projects.push(project);
    else groups.push({ companyId: project.companyId, companyName: project.companyName, projects: [project] });
    return groups;
  }, []);
  const projectCard = (project: Project) => (
    <ProjectCard project={project} canViewArchitects={canViewArchitects} key={project.id} />
  );
  const projectCollection = (items: Project[]) => profile?.profileType === "client"
    ? groupProjects(items).map((group) => <section className="client-project-company" key={group.companyId}><h2>{group.companyName}</h2><div className="mock-project-grid">{group.projects.map(projectCard)}</div></section>)
    : <div className="mock-project-grid">{items.map(projectCard)}</div>;

  return <PortalShell>
    <header className="mock-page-header">
      <div><p className="mock-eyebrow">Portefólio</p><h1>Projetos</h1><p>Consulta, pesquisa e acompanha os projetos{profile?.profileType === "client" ? " das empresas associadas" : " do atelier"}.</p></div>
      {profile?.companyRole === "owner" && <button className="primary-action" onClick={() => navigate("/projects/new")}><Plus size={18} />Criar projeto</button>}
    </header>
    <label className="mock-search mock-project-search"><Search size={19} /><span className="sr-only">Pesquisar projetos</span><input type="search" placeholder="Pesquisar por projeto, empresa, cliente ou morada" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <ErrorMessage value={error} />
    <section className="mock-collapsible"><button className="mock-section-heading" type="button" aria-expanded={activeOpen} onClick={() => setActiveOpen((open) => !open)}><span><ChevronDown className={activeOpen ? "" : "is-collapsed"} size={19} /><strong>Projetos ativos</strong><small>{activeProjects.length}</small></span></button>{activeOpen && projectCollection(activeProjects)}</section>
    <section className="mock-collapsible"><button className="mock-section-heading" type="button" aria-expanded={archivedOpen} onClick={() => setArchivedOpen((open) => !open)}><span><ChevronDown className={archivedOpen ? "" : "is-collapsed"} size={19} /><strong>Projetos arquivados</strong><small>{archivedProjects.length}</small></span></button>{archivedOpen && projectCollection(archivedProjects)}</section>
    {!error && !filtered.length && <p>Não existem projetos a apresentar.</p>}
  </PortalShell>;
}
