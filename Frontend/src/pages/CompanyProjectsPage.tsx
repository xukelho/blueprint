import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
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
  const navigate = useNavigate();
  const { profile } = useProfile();

  useEffect(() => {
    getProjects().then(setProjects).catch((caught) => setError(caught instanceof globalThis.Error ? caught.message : "Não foi possível carregar os projetos."));
  }, []);

  const filtered = projects.filter((project) => `${project.title} ${project.code} ${project.address} ${project.client?.displayName ?? ""} ${project.companyName}`.toLocaleLowerCase("pt-PT").includes(query.toLocaleLowerCase("pt-PT")));
  const canViewArchitects = profile?.profileType === "client" || (profile?.profileType === "employee" && profile.companyRole === "owner");
  const groupedProjects = filtered.reduce<Array<{ companyId: number; companyName: string; projects: Project[] }>>((groups, project) => {
    const group = groups.find((candidate) => candidate.companyId === project.companyId);
    if (group) group.projects.push(project);
    else groups.push({ companyId: project.companyId, companyName: project.companyName, projects: [project] });
    return groups;
  }, []);
  const projectCard = (project: Project) => (
    <ProjectCard project={project} canViewArchitects={canViewArchitects} key={project.id} />
  );

  return <PortalShell>
    <header className="mock-page-header">
      <div><p className="mock-eyebrow">Portefólio</p><h1>Projetos</h1><p>Consulta, pesquisa e acompanha os projetos{profile?.profileType === "client" ? " das empresas associadas" : " do atelier"}.</p></div>
      {profile?.companyRole === "owner" && <button className="primary-action" onClick={() => navigate("/projects/new")}><Plus size={18} />Criar projeto</button>}
    </header>
    <label className="mock-search mock-project-search"><Search size={19} /><span className="sr-only">Pesquisar projetos</span><input type="search" placeholder="Pesquisar por projeto, empresa, cliente ou morada" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <ErrorMessage value={error} />
    {profile?.profileType === "client"
      ? groupedProjects.map((group) => <section className="client-project-company" key={group.companyId}><h2>{group.companyName}</h2><div className="mock-project-grid">{group.projects.map(projectCard)}</div></section>)
      : <div className="mock-project-grid">{filtered.map(projectCard)}</div>}
    {!error && !filtered.length && <p>Não existem projetos a apresentar.</p>}
  </PortalShell>;
}
