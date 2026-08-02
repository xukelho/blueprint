import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Search, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { GoogleMapPicker } from "../components/GoogleMapPicker";
import { ProjectTimelineEditor, ProjectTimelineView, TimelinePhase, newTimelinePhase } from "../components/ProjectTimelineEditor";
import { archiveProject, getClients, getCompanyMembers, getProject, Project, ProjectMember, updateMembers, updateProject, updateProjectPhases } from "../api/projects";
import { useProfile } from "../profile/ProfileContext";
import { QUICK_FILL_PHASE_CODES } from "../projectPhases";

type ProjectFormData = { title: string; code: string; address: string; googleMapsUrl: string; clientId: string };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-PT");
const projectFormData = (project: Project): ProjectFormData => ({ title: project.title, code: project.code, address: project.address, googleMapsUrl: project.googleMapsUrl ?? "", clientId: String(project.client?.id ?? "") });
const sameMemberIds = (left: number[], right: number[]) => left.length === right.length && left.every((id) => right.includes(id));

export function CompanyProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const owner = profile?.companyRole === "owner";
  const [data, setData] = useState<ProjectFormData>({ title: "", code: "", address: "", googleMapsUrl: "", clientId: "" });
  const [clients, setClients] = useState<Array<{ id: number; displayName: string }>>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [timelinePhases, setTimelinePhases] = useState<TimelinePhase[]>([]);
  const [currentPhaseId, setCurrentPhaseId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTimelineEditing, setIsTimelineEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadProject = (loadedProject: Project) => {
    setProject(loadedProject);
    setData(projectFormData(loadedProject));
    setSelected(loadedProject.members?.map((member) => member.employeeId) ?? []);
    setTimelinePhases((loadedProject.phases ?? []).map((phase) => ({ id: String(phase.id), code: phase.code })));
    setCurrentPhaseId((loadedProject.phases ?? []).find((phase) => phase.isCurrent)?.id.toString() ?? null);
  };
  useEffect(() => {
    if (!owner) return;
    Promise.all([getClients(), getCompanyMembers()]).then(([loadedClients, loadedMembers]) => { setClients(loadedClients); setMembers(loadedMembers); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Erro ao carregar."));
  }, [owner]);
  useEffect(() => { if (id) getProject(id).then(loadProject).catch((caught) => setError(caught instanceof Error ? caught.message : "Erro ao carregar.")); }, [id]);

  const displayedMembers = isEditing ? members : project?.members ?? [];
  const filteredMembers = useMemo(() => { const normalizedQuery = query.trim().toLocaleLowerCase("pt-PT"); return displayedMembers.filter((member) => member.displayName.toLocaleLowerCase("pt-PT").includes(normalizedQuery)); }, [displayedMembers, query]);
  const hasChanges = Boolean(project) && (Object.entries(projectFormData(project!)).some(([key, value]) => data[key as keyof ProjectFormData] !== value) || !sameMemberIds(selected, project!.members?.map((member) => member.employeeId) ?? []));
  const toggleMember = (employeeId: number, checked: boolean) => setSelected((current) => checked ? [...current, employeeId] : current.filter((memberId) => memberId !== employeeId));
  const startEditing = () => { setNotice(null); setQuery(""); setIsEditing(true); };
  const discardChanges = () => { if (project) { setData(projectFormData(project)); setSelected(project.members?.map((member) => member.employeeId) ?? []); } setQuery(""); setDiscardDialogOpen(false); setIsEditing(false); };
  const cancelEditing = () => { if (hasChanges) setDiscardDialogOpen(true); else discardChanges(); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!id || isSaving) return;
    setIsSaving(true); setNotice(null);
    try { await updateProject(id, { ...data, clientId: data.clientId ? Number(data.clientId) : null }); await updateMembers(id, selected); const updatedProject = await getProject(id); loadProject(updatedProject); setIsEditing(false); setNotice({ type: "success", message: "Alterações guardadas com sucesso." }); }
    catch (caught) { setNotice({ type: "error", message: caught instanceof Error ? caught.message : "Não foi possível guardar as alterações." }); }
    finally { setIsSaving(false); }
  };
  const saveTimeline = async () => {
    if (!id || isSavingTimeline) return;
    setIsSavingTimeline(true); setNotice(null);
    try { const updatedProject = await updateProjectPhases(id, { phaseCodes: timelinePhases.map((phase) => phase.code), currentPhaseIndex: currentPhaseId ? timelinePhases.findIndex((phase) => phase.id === currentPhaseId) : null }); loadProject(updatedProject); setIsTimelineEditing(false); setNotice({ type: "success", message: "Timeline guardada com sucesso." }); }
    catch (caught) { setNotice({ type: "error", message: caught instanceof Error ? caught.message : "Não foi possível guardar a timeline." }); }
    finally { setIsSavingTimeline(false); }
  };
  const cancelTimeline = () => { if (project) { setTimelinePhases((project.phases ?? []).map((phase) => ({ id: String(phase.id), code: phase.code }))); setCurrentPhaseId((project.phases ?? []).find((phase) => phase.isCurrent)?.id.toString() ?? null); } setIsTimelineEditing(false); };
  const archive = async () => { if (!id || !confirm("Arquivar este projeto?")) return; try { await archiveProject(id); navigate("/projects"); } catch (caught) { setNotice({ type: "error", message: caught instanceof Error ? caught.message : "Não foi possível arquivar o projeto." }); } };

  if (!project && !error) return <PortalShell><p>A carregar…</p></PortalShell>;
  return <PortalShell>
    <button className="mock-back-link" onClick={() => navigate("/projects")}><ArrowLeft size={17} />Projetos</button>
    <header className="mock-page-header"><div><h1>{project?.title}</h1><p>Informação essencial, participantes e fases do projeto.</p></div>{owner && !isEditing && <button className="secondary-action" type="button" onClick={startEditing}><Pencil size={17} />Editar</button>}</header>
    {error && <p role="alert">{error}</p>}
    {notice && <p className={`mock-project-notice mock-project-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.message}</p>}
    {project && <form className="mock-form-column" onSubmit={submit}>
      <section className="mock-surface">
        {isEditing ? <div className="mock-form-grid">
          <label className="mock-field mock-field--wide">Título<input required value={data.title} onChange={(event) => setData({ ...data, title: event.target.value })} /></label><label className="mock-field">Código<input required value={data.code} onChange={(event) => setData({ ...data, code: event.target.value })} /></label><label className="mock-field">Cliente<select value={data.clientId} onChange={(event) => setData({ ...data, clientId: event.target.value })}><option value="">Sem cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label>
          <label className="mock-field mock-field--wide">Morada<input value={data.address} onChange={(event) => setData({ ...data, address: event.target.value })} /></label><label className="mock-field mock-field--wide">Localização (Google Maps)<input type="url" value={data.googleMapsUrl} placeholder="Cole um link do Google Maps" onChange={(event) => setData({ ...data, googleMapsUrl: event.target.value })} /><small>Opcional. Pode colar um link ou selecionar no mapa.</small></label><div className="mock-field--wide"><GoogleMapPicker onLocationChange={(googleMapsUrl) => setData((current) => ({ ...current, googleMapsUrl }))} /></div>
        </div> : <dl className="mock-project-details"><div className="mock-field mock-field--wide"><dt>Título</dt><dd>{project.title}</dd></div><div className="mock-field"><dt>Código</dt><dd>{project.code}</dd></div>{project.client && <div className="mock-field"><dt>Cliente</dt><dd>{project.client.displayName}</dd></div>}{project.address && <div className="mock-field mock-field--wide"><dt>Morada</dt><dd>{project.address}</dd></div>}{project.googleMapsUrl && <div className="mock-field mock-field--wide"><dt>Localização</dt><dd><a href={project.googleMapsUrl} target="_blank" rel="noreferrer">Abrir no Google Maps</a></dd></div>}</dl>}
      </section>
      <section className="mock-surface project-timeline-section"><div className="mock-section-title"><div><h2>Timeline do projeto</h2><p>{(project.phases ?? []).length ? "Sequência de fases definida para este projeto." : "Ainda não foram definidas fases para este projeto."}</p></div>{project.canEditTimeline && !isTimelineEditing && <button type="button" className="secondary-action" onClick={() => setIsTimelineEditing(true)}><Pencil size={16} />Editar timeline</button>}</div>
        {isTimelineEditing ? <><ProjectTimelineEditor phases={timelinePhases} currentPhaseId={currentPhaseId} onPhasesChange={setTimelinePhases} onCurrentPhaseIdChange={setCurrentPhaseId} onQuickFill={() => { setTimelinePhases(QUICK_FILL_PHASE_CODES.map(newTimelinePhase)); setCurrentPhaseId(null); }} /><div className="mock-project-form-actions"><button type="button" className="secondary-action" onClick={cancelTimeline}>Cancelar</button><button type="button" className="primary-action" disabled={isSavingTimeline} onClick={saveTimeline}>{isSavingTimeline ? "A guardar…" : "Guardar timeline"}</button></div></> : (project.phases ?? []).length ? <ProjectTimelineView phases={(project.phases ?? []).map((phase) => ({ id: String(phase.id), code: phase.code }))} currentPhaseId={(project.phases ?? []).find((phase) => phase.isCurrent)?.id.toString() ?? null} /> : <p className="mock-empty-state">Timeline opcional ainda não configurada.</p>}
      </section>
      <section className="mock-surface"><div className="mock-section-title"><div><h2>Arquitetos atribuídos</h2><p>{isEditing ? "Seleciona os arquitetos que podem colaborar neste projeto." : "Arquitetos que colaboram neste projeto."}</p></div></div>
        {isEditing && <div className="mock-toolbar mock-project-members-toolbar"><label className="mock-search"><Search size={19} /><span className="sr-only">Pesquisar colaboradores</span><input type="search" placeholder="Pesquisar por colaborador" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}</label><span className="mock-result-count">{filteredMembers.length} {filteredMembers.length === 1 ? "arquiteto" : "arquitetos"}</span></div>}
        <div className="mock-project-member-grid">{filteredMembers.map((member) => isEditing ? <label className="mock-project-member-card" key={member.employeeId}><input type="checkbox" checked={selected.includes(member.employeeId)} onChange={(event) => toggleMember(member.employeeId, event.target.checked)} /><span className="mock-client-avatar mock-client-avatar--blue" aria-hidden="true">{initials(member.displayName)}</span><span><strong>{member.displayName}</strong></span></label> : <div className="mock-project-member-card mock-project-member-card--readonly" key={member.employeeId}><span className="mock-client-avatar mock-client-avatar--blue" aria-hidden="true">{initials(member.displayName)}</span><span><strong>{member.displayName}</strong></span></div>)}</div>{!filteredMembers.length && <p className="mock-empty-state">Não existem arquitetos a apresentar.</p>}
      </section>
      {owner && isEditing && <div className="mock-project-form-actions"><button className="secondary-action" type="button" onClick={archive}>Arquivar</button><button className="secondary-action" type="button" onClick={cancelEditing}>Cancelar</button><button className="primary-action" type="submit" disabled={isSaving}>{isSaving ? "A guardar…" : "Guardar"}</button></div>}
    </form>}
    {discardDialogOpen && <div className="mock-modal-backdrop" role="presentation"><section className="mock-modal" role="alertdialog" aria-modal="true" aria-labelledby="discard-project-changes-title" aria-describedby="discard-project-changes-description"><button className="mock-modal-close" type="button" aria-label="Fechar" onClick={() => setDiscardDialogOpen(false)}><X size={19} /></button><h2 id="discard-project-changes-title">Descartar alterações?</h2><p id="discard-project-changes-description">Existem alterações por guardar. Pretende descartá-las e sair do modo de edição?</p><div className="mock-form-actions"><button className="secondary-action" type="button" onClick={() => setDiscardDialogOpen(false)}>Voltar a editar</button><button className="primary-action" type="button" onClick={discardChanges}>Descartar alterações</button></div></section></div>}
  </PortalShell>;
}
