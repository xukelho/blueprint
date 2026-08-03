import { useEffect, useState } from "react";
import { ChevronRight, FolderKanban, MapPin, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { getProjects, Project } from "../api/projects";
import { useProfile } from "../profile/ProfileContext";
import { phaseLabel } from "../projectPhases";

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

  const filtered = projects.filter((project) => `${project.title} ${project.code} ${project.address} ${project.client?.displayName ?? ""}`.toLocaleLowerCase("pt-PT").includes(query.toLocaleLowerCase("pt-PT")));
  const canViewArchitects = profile?.profileType === "client" || (profile?.profileType === "employee" && profile.companyRole === "owner");

  return <PortalShell>
    <header className="mock-page-header">
      <div><p className="mock-eyebrow">Portefólio</p><h1>Projetos</h1><p>Consulta, pesquisa e acompanha os projetos do atelier.</p></div>
      {profile?.companyRole === "owner" && <button className="primary-action" onClick={() => navigate("/projects/new")}><Plus size={18} />Criar projeto</button>}
    </header>
    <label className="mock-search mock-project-search"><Search size={19} /><span className="sr-only">Pesquisar projetos</span><input type="search" placeholder="Pesquisar por projeto, cliente ou morada" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <ErrorMessage value={error} />
    <div className="mock-project-grid">
      {filtered.map((project) => <article className="mock-project-card mock-project-card--dashboard" key={project.id}>
        <button className="mock-project-preview" aria-label={`Abrir projeto ${project.title}`} onClick={() => navigate(`/projects/${project.id}`)}>
          <span className="mock-project-code">{project.code}</span>
          <FolderKanban aria-hidden="true" size={42} strokeWidth={1.35} />
        </button>
        <button className="mock-project-content" onClick={() => navigate(`/projects/${project.id}`)}>
          <span className="mock-project-title"><strong>{project.title}</strong><ChevronRight size={17} /></span>
          <span>{project.client?.displayName ?? "Sem cliente"}</span>
          <span className="mock-muted-row"><MapPin size={14} aria-hidden="true" />{project.address}</span>
          {canViewArchitects && project.members?.length ? <span className="mock-project-members">Arquiteto{project.members.length === 1 ? "" : "s"}: {project.members.map((member) => member.displayName).join(", ")}</span> : null}
          <span className="mock-project-meta"><span>{phaseLabel(project.currentPhaseCode) ?? "Sem fase atual"}</span><span>{project.code}</span></span>
        </button>
      </article>)}
    </div>
    {!error && !filtered.length && <p>Não existem projetos a apresentar.</p>}
  </PortalShell>;
}
