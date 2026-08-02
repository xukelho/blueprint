import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { GoogleMapPicker } from "../components/GoogleMapPicker";
import { ProjectTimelineEditor, TimelinePhase, newTimelinePhase } from "../components/ProjectTimelineEditor";
import { createProject, getClients, getCompanyMembers, ProjectMember } from "../api/projects";
import { useProfile } from "../profile/ProfileContext";
import { QUICK_FILL_PHASE_CODES } from "../projectPhases";

const blank = { title: "", code: "", address: "", googleMapsUrl: "", clientId: "" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-PT");

export function CompanyProjectsCreatePage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const owner = profile?.companyRole === "owner";
  const [data, setData] = useState(blank);
  const [clients, setClients] = useState<Array<{ id: number; displayName: string }>>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [currentPhaseId, setCurrentPhaseId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!owner) return;
    Promise.all([getClients(), getCompanyMembers()])
      .then(([loadedClients, loadedMembers]) => { setClients(loadedClients); setMembers(loadedMembers); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Erro ao carregar."));
  }, [owner]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-PT");
    return members.filter((member) => member.displayName.toLocaleLowerCase("pt-PT").includes(normalizedQuery));
  }, [members, query]);
  const toggleMember = (employeeId: number, checked: boolean) => setSelected((current) => checked ? [...current, employeeId] : current.filter((id) => id !== employeeId));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await createProject({ ...data, clientId: data.clientId ? Number(data.clientId) : null, employeeIds: selected, phaseCodes: timelinePhases.map((phase) => phase.code), currentPhaseIndex: currentPhaseId ? timelinePhases.findIndex((phase) => phase.id === currentPhaseId) : null });
      navigate(`/projects/${result.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao guardar.");
    }
  };

  return <PortalShell>
    <button className="mock-back-link" onClick={() => navigate("/projects")}><ArrowLeft size={17} />Projetos</button>
    <header className="mock-page-header"><div><h1>Criar projeto</h1><p>Informação essencial, participantes e timeline do projeto.</p></div></header>
    {error && <p role="alert">{error}</p>}
    {owner && <form className="mock-form-column" onSubmit={submit}>
      <section className="mock-surface"><div className="mock-form-grid">
        <label className="mock-field mock-field--wide">Título<input required value={data.title} onChange={(event) => setData({ ...data, title: event.target.value })} /></label>
        <label className="mock-field">Código<input required value={data.code} onChange={(event) => setData({ ...data, code: event.target.value })} /></label>
        <label className="mock-field">Cliente<select value={data.clientId} onChange={(event) => setData({ ...data, clientId: event.target.value })}><option value="">Sem cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label>
        <label className="mock-field mock-field--wide">Morada<input value={data.address} onChange={(event) => setData({ ...data, address: event.target.value })} /></label>
        <label className="mock-field mock-field--wide">Localização (Google Maps)<input type="url" value={data.googleMapsUrl} placeholder="Cole um link do Google Maps" onChange={(event) => setData({ ...data, googleMapsUrl: event.target.value })} /><small>Opcional. Pode colar um link ou selecionar no mapa.</small></label>
        <div className="mock-field--wide"><GoogleMapPicker onLocationChange={(googleMapsUrl) => setData((current) => ({ ...current, googleMapsUrl }))} /></div>
      </div></section>
      <section className="mock-surface project-timeline-section"><div className="mock-section-title"><div><h2>Timeline do projeto</h2><p>Opcional. Define a sequência de fases e, se aplicável, a fase atual.</p></div></div><ProjectTimelineEditor phases={timelinePhases} currentPhaseId={currentPhaseId} onPhasesChange={setTimelinePhases} onCurrentPhaseIdChange={setCurrentPhaseId} onQuickFill={() => { setTimelinePhases(QUICK_FILL_PHASE_CODES.map(newTimelinePhase)); setCurrentPhaseId(null); }} /></section>
      <section className="mock-surface">
        <div className="mock-section-title"><div><h2>Arquitetos atribuídos</h2><p>Seleciona os arquitetos que podem colaborar neste projeto.</p></div></div>
        <div className="mock-toolbar mock-project-members-toolbar"><label className="mock-search"><Search size={19} /><span className="sr-only">Pesquisar colaboradores</span><input type="search" placeholder="Pesquisar por colaborador" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}</label><span className="mock-result-count">{filteredMembers.length} {filteredMembers.length === 1 ? "arquiteto" : "arquitetos"}</span></div>
        <div className="mock-project-member-grid">{filteredMembers.map((member) => <label className="mock-project-member-card" key={member.employeeId}><input type="checkbox" checked={selected.includes(member.employeeId)} onChange={(event) => toggleMember(member.employeeId, event.target.checked)} /><span className="mock-client-avatar mock-client-avatar--blue" aria-hidden="true">{initials(member.displayName)}</span><span><strong>{member.displayName}</strong></span></label>)}</div>
        {!filteredMembers.length && <p className="mock-empty-state">Não existem arquitetos a apresentar.</p>}
      </section>
      <button className="primary-action" type="submit">Guardar</button>
    </form>}
  </PortalShell>;
}
