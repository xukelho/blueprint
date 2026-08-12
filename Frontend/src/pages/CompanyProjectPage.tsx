import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, ExternalLink, MapPin, Milestone, MoreHorizontal, Pencil, Search, UsersRound, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { GoogleMapPicker } from "../components/GoogleMapPicker";
import { ProjectTimelineEditor, ProjectTimelineView, TimelinePhase, newTimelinePhase } from "../components/ProjectTimelineEditor";
import { ProjectDocuments, ProjectDocumentsByPhase, ProjectFloorPlan, ProjectWorkspacePanel } from "../components/ProjectWorkspace";
import { archiveProject, deleteProjectDocument, getClients, getCompanyMembers, getProject, getProjectDocuments, Project, ProjectMember, reactivateProject, updateMembers, updateProject, updateProjectPhases, uploadProjectDocument } from "../api/projects";
import { useProfile } from "../profile/ProfileContext";
import { phaseLabel, PROJECT_PHASES, QUICK_FILL_PHASE_CODES } from "../projectPhases";

type ProjectFormData = { title: string; code: string; address: string; googleMapsUrl: string; clientId: string };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-PT");
const projectFormData = (project: Project): ProjectFormData => ({ title: project.title, code: project.code, address: project.address, googleMapsUrl: project.googleMapsUrl ?? "", clientId: String(project.client?.id ?? "") });
const sameMemberIds = (left: number[], right: number[]) => left.length === right.length && left.every((id) => right.includes(id));

const googleMapsEmbedUrl = (googleMapsUrl: string, address: string) => {
  let query = address.trim();

  try {
    const url = new URL(googleMapsUrl);
    query = url.searchParams.get("query") ?? url.searchParams.get("q") ?? url.searchParams.get("destination") ?? query;
    const coordinates = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (!query && coordinates) query = `${coordinates[1]},${coordinates[2]}`;
  } catch {
    // The saved link remains available even when it cannot be converted to an embed query.
  }

  return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : null;
};

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
  const [viewedPhaseId, setViewedPhaseId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProjectDocumentsByPhase>({});
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isTimelineEditing, setIsTimelineEditing] = useState(false);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState(false);
  const [timelineMenuOpen, setTimelineMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTimeline, setIsSavingTimeline] = useState(false);
  const [isUpdatingArchiveStatus, setIsUpdatingArchiveStatus] = useState(false);
  const [archiveStatusDialogOpen, setArchiveStatusDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadProject = (loadedProject: Project) => {
    setProject(loadedProject);
    setData(projectFormData(loadedProject));
    setSelected(loadedProject.members?.map((member) => member.employeeId) ?? []);
    const loadedPhases = (loadedProject.phases ?? []).map((phase) => ({ id: String(phase.id), code: phase.code }));
    const loadedCurrentPhaseId = (loadedProject.phases ?? []).find((phase) => phase.isCurrent)?.id.toString() ?? null;
    setTimelinePhases(loadedPhases);
    setCurrentPhaseId(loadedCurrentPhaseId);
    setViewedPhaseId(loadedCurrentPhaseId ?? loadedPhases[0]?.id ?? null);
  };
  useEffect(() => {
    if (!owner) return;
    Promise.all([getClients(), getCompanyMembers()]).then(([loadedClients, loadedMembers]) => { setClients(loadedClients); setMembers(loadedMembers); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Erro ao carregar."));
  }, [owner]);
  useEffect(() => { if (id) getProject(id).then(loadProject).catch((caught) => setError(caught instanceof Error ? caught.message : "Erro ao carregar.")); }, [id]);
  useEffect(() => {
    if (!id) return;
    setDocumentsLoading(true);
    setDocumentsError("");
    getProjectDocuments(id)
      .then((loadedDocuments) => setDocuments(loadedDocuments.reduce<ProjectDocumentsByPhase>((grouped, document) => {
        const phaseId = String(document.phaseId);
        grouped[phaseId] = [...(grouped[phaseId] ?? []), document];
        return grouped;
      }, {})))
      .catch((caught) => setDocumentsError(caught instanceof Error ? caught.message : "Não foi possível carregar os documentos."))
      .finally(() => setDocumentsLoading(false));
  }, [id]);

  const displayedMembers = isEditing ? members : project?.members ?? [];
  const projectPhases = useMemo(() => (project?.phases ?? []).map((phase) => ({ id: String(phase.id), code: phase.code })), [project?.phases]);
  const officialCurrentPhaseId = project?.phases?.find((phase) => phase.isCurrent)?.id.toString() ?? null;
  const viewedPhase = projectPhases.find((phase) => phase.id === viewedPhaseId) ?? projectPhases[0] ?? null;
  const currentPhaseCode = project?.phases?.find((phase) => phase.isCurrent)?.code ?? project?.currentPhaseCode;
  const currentPhaseLabel = phaseLabel(currentPhaseCode) ?? "Sem fase atual";
  const CurrentPhaseIcon = PROJECT_PHASES.find((phase) => phase.code === currentPhaseCode)?.icon ?? Milestone;
  const filteredMembers = useMemo(() => { const normalizedQuery = query.trim().toLocaleLowerCase("pt-PT"); return displayedMembers.filter((member) => member.displayName.toLocaleLowerCase("pt-PT").includes(normalizedQuery)); }, [displayedMembers, query]);
  const hasChanges = Boolean(project) && (Object.entries(projectFormData(project!)).some(([key, value]) => data[key as keyof ProjectFormData] !== value) || !sameMemberIds(selected, project!.members?.map((member) => member.employeeId) ?? []));
  const toggleMember = (employeeId: number, checked: boolean) => setSelected((current) => checked ? [...current, employeeId] : current.filter((memberId) => memberId !== employeeId));
  const uploadDocument = async (phaseId: string, file: File) => {
    if (!id) throw new Error("Projeto indisponível.");
    const uploaded = await uploadProjectDocument(id, phaseId, file);
    const uploadedPhaseId = String(uploaded.phaseId);
    setDocuments((current) => ({ ...current, [uploadedPhaseId]: [...(current[uploadedPhaseId] ?? []), uploaded] }));
  };
  const removeDocument = async (documentId: string) => {
    if (!id) throw new Error("Projeto indisponível.");
    await deleteProjectDocument(id, documentId);
    setDocuments((current) => Object.fromEntries(Object.entries(current).map(([phaseId, phaseDocuments]) => [phaseId, phaseDocuments.filter((document) => document.id !== documentId)])));
  };
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
  const updateArchiveStatus = async () => {
    if (!id || !project || isUpdatingArchiveStatus) return;
    setIsUpdatingArchiveStatus(true); setNotice(null);
    try { if (project.isArchived) await reactivateProject(id); else await archiveProject(id); navigate("/projects"); }
    catch (caught) { setNotice({ type: "error", message: caught instanceof Error ? caught.message : `Não foi possível ${project.isArchived ? "reativar" : "arquivar"} o projeto.` }); setArchiveStatusDialogOpen(false); }
    finally { setIsUpdatingArchiveStatus(false); }
  };

  if (!project && !error) return <PortalShell><p>A carregar…</p></PortalShell>;
  return <PortalShell wide>
    <button className="mock-back-link" onClick={() => navigate("/projects")}><ArrowLeft size={17} />Projetos</button>
    {error && <p role="alert">{error}</p>}
    {notice && <p className={`mock-project-notice mock-project-notice--${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.message}</p>}
    {project && <>
      <div className="project-page-content">
      <form id="project-details-form" className={`project-hero ${isEditing ? "is-editing" : ""}`} onSubmit={submit}>
        <div className="project-hero__content">
          {isEditing ? <>
            <div className="project-hero__edit-heading">
              <div><p className="project-hero__eyebrow">Editar projeto</p><h1>Informação do projeto</h1></div>
              {project.isArchived && <span className="project-hero__status is-archived">Arquivado</span>}
            </div>
            <div className="project-hero__edit-grid">
              <label className="mock-field project-hero__title-field">Título<input required value={data.title} onChange={(event) => setData({ ...data, title: event.target.value })} /></label>
              <label className="mock-field">Código<input required value={data.code} onChange={(event) => setData({ ...data, code: event.target.value })} /></label>
              <label className="mock-field">Cliente<select value={data.clientId} onChange={(event) => setData({ ...data, clientId: event.target.value })}><option value="">Sem cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.displayName}</option>)}</select></label>
              <label className="mock-field project-hero__wide-field">Morada<input value={data.address} onChange={(event) => setData({ ...data, address: event.target.value })} /></label>
              <label className="mock-field project-hero__wide-field">Localização (Google Maps)<input type="url" value={data.googleMapsUrl} placeholder="Cole um link do Google Maps" onChange={(event) => setData({ ...data, googleMapsUrl: event.target.value })} /><small>Opcional. Pode colar um link ou selecionar no mapa.</small></label>
            </div>
            <div className="project-hero__architect-editor">
              <div><strong>Arquitetos atribuídos</strong><small>Seleciona os arquitetos que podem colaborar neste projeto.</small></div>
              <div className="mock-toolbar mock-project-members-toolbar"><label className="mock-search"><Search size={19} /><span className="sr-only">Pesquisar colaboradores</span><input type="search" placeholder="Pesquisar por colaborador" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}</label><span className="mock-result-count">{filteredMembers.length} {filteredMembers.length === 1 ? "arquiteto" : "arquitetos"}</span></div>
              <div className="mock-project-member-grid">{filteredMembers.map((member) => <label className="mock-project-member-card" key={member.employeeId}><input type="checkbox" checked={selected.includes(member.employeeId)} onChange={(event) => toggleMember(member.employeeId, event.target.checked)} /><span className="mock-client-avatar mock-client-avatar--blue" aria-hidden="true">{initials(member.displayName)}</span><span><strong>{member.displayName}</strong></span></label>)}</div>
              {!filteredMembers.length && <p className="mock-empty-state">Não existem arquitetos a apresentar.</p>}
            </div>
          </> : <>
            {(project.isArchived || owner) && <div className="project-hero__topline">
              {project.isArchived && <span className="project-hero__status is-archived">Arquivado</span>}
              {owner && <button className="project-hero__edit-action" type="button" onClick={startEditing}><Pencil size={16} />Editar projeto</button>}
            </div>}
            <p className="project-hero__eyebrow">{project.companyName ? `${project.code} · ${project.companyName}` : project.code}</p>
            <h1 id="project-title">{project.title}</h1>
            <div className="project-hero__metadata">
              {project.client && <div><span className="project-hero__meta-icon"><Building2 size={18} aria-hidden="true" /></span><span><small>Cliente</small><strong>{project.client.displayName}</strong></span></div>}
              {project.address && <div className="project-hero__metadata-address"><span className="project-hero__meta-icon"><MapPin size={18} aria-hidden="true" /></span><span><small>Morada</small><strong>{project.address}</strong></span></div>}
              <div className="project-hero__metadata-architects"><span className="project-hero__meta-icon"><UsersRound size={18} aria-hidden="true" /></span><span><small>Arquitetos atribuídos</small><strong>{project.members?.length ? project.members.map((member) => member.displayName).join(", ") : "Sem arquitetos atribuídos"}</strong></span></div>
            </div>
          </>}
        </div>
        <aside className={`project-hero__location ${isEditing ? "is-editing" : ""}`} aria-label={isEditing ? "Editar localização do projeto" : "Localização do projeto"}>
          {isEditing ? <><div className="project-hero__location-heading"><span className="project-hero__location-icon"><MapPin size={18} aria-hidden="true" /></span><div><strong>Localização</strong><small>Pesquise ou assinale o ponto no mapa.</small></div></div><GoogleMapPicker onLocationChange={(googleMapsUrl) => setData((current) => ({ ...current, googleMapsUrl }))} /></> : project.googleMapsUrl && googleMapsEmbedUrl(project.googleMapsUrl, project.address) ? <>
            <div className="project-hero__map"><iframe src={googleMapsEmbedUrl(project.googleMapsUrl, project.address)!} title={`Mapa da localização do projeto ${project.title}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
            <div className="project-hero__location-footer"><span><small>Localização do projeto</small><strong>{project.address || "Ponto assinalado no mapa"}</strong></span><a href={project.googleMapsUrl} target="_blank" rel="noreferrer">Abrir no Google Maps<ExternalLink size={14} aria-hidden="true" /></a></div>
          </> : <div className="project-hero__location-empty"><span className="project-hero__location-mark"><MapPin size={28} aria-hidden="true" /></span><div><small>Localização</small><strong>Localização por definir</strong><p>Adicione uma morada ou um ponto no mapa para completar o enquadramento do projeto.</p></div></div>}
        </aside>
        {!isEditing && <aside className="project-hero__phase" aria-label="Fase atual do projeto">
          <span className="project-hero__phase-icon"><CurrentPhaseIcon size={32} strokeWidth={1.7} aria-hidden="true" /></span>
          <span><small>Fase atual</small><strong>{currentPhaseLabel}</strong></span>
        </aside>}
      </form>
      <div className={`project-workspace ${isWorkspaceCollapsed ? "is-sidebar-collapsed" : ""}`}>
        <div className="project-workspace__main">
          <section className={`mock-surface project-timeline-section project-timeline-section--workspace ${isTimelineEditing ? "is-editing" : ""} ${isTimelineExpanded ? "is-expanded" : ""}`}>
            <div className="mock-section-title project-timeline-heading"><div><h2>Timeline do projeto</h2></div>
              {!isTimelineEditing && <div className="project-timeline-options" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setTimelineMenuOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setTimelineMenuOpen(false); event.currentTarget.querySelector<HTMLButtonElement>(".project-icon-action")?.focus(); } }}>
                <button type="button" className="project-icon-action" aria-label="Opções da timeline" aria-haspopup="menu" aria-expanded={timelineMenuOpen} onClick={() => setTimelineMenuOpen((open) => !open)}><MoreHorizontal size={19} aria-hidden="true" /></button>
                {timelineMenuOpen && <div className="project-options-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setIsTimelineExpanded((expanded) => !expanded); setTimelineMenuOpen(false); }}>{isTimelineExpanded ? "Recolher timeline" : "Expandir timeline"}</button>
                  {project.canEditTimeline && <button type="button" role="menuitem" onClick={() => { setIsTimelineEditing(true); setTimelineMenuOpen(false); }}>Editar timeline</button>}
                </div>}
              </div>}
            </div>
            {isTimelineEditing ? <><ProjectTimelineEditor phases={timelinePhases} currentPhaseId={currentPhaseId} onPhasesChange={setTimelinePhases} onCurrentPhaseIdChange={setCurrentPhaseId} onQuickFill={() => { setTimelinePhases(QUICK_FILL_PHASE_CODES.map(newTimelinePhase)); setCurrentPhaseId(null); }} /><div className="mock-project-form-actions"><button type="button" className="secondary-action" onClick={cancelTimeline}>Cancelar</button><button type="button" className="primary-action" disabled={isSavingTimeline} onClick={saveTimeline}>{isSavingTimeline ? "A guardar…" : "Guardar timeline"}</button></div></> : projectPhases.length ? <ProjectTimelineView phases={projectPhases} currentPhaseId={officialCurrentPhaseId} viewedPhaseId={viewedPhaseId} expanded={isTimelineExpanded} onPhaseSelect={setViewedPhaseId} /> : <p className="mock-empty-state">Timeline opcional ainda não configurada.</p>}
          </section>
          <ProjectFloorPlan phaseCode={viewedPhase?.code ?? null} />
          <ProjectDocuments phases={projectPhases} viewedPhaseId={viewedPhaseId} documents={documents} loading={documentsLoading} error={documentsError} readOnly={project.isArchived} onUploadFile={uploadDocument} onDeleteDocument={removeDocument} />
        </div>
        <ProjectWorkspacePanel projectTitle={project.title} phases={projectPhases} viewedPhaseId={viewedPhaseId} currentUser={profile?.displayName ?? "Utilizador"} documents={documents} onCollapsedChange={setIsWorkspaceCollapsed} />
      </div>
      {owner && isEditing && <div className="mock-project-form-actions project-page-actions"><button className="secondary-action" type="button" onClick={() => setArchiveStatusDialogOpen(true)}>{project.isArchived ? "Reativar" : "Arquivar"}</button><button className="secondary-action" type="button" onClick={cancelEditing}>Cancelar</button><button className="primary-action" type="submit" form="project-details-form" disabled={isSaving}>{isSaving ? "A guardar…" : "Guardar"}</button></div>}
      </div>
    </>}
    {archiveStatusDialogOpen && <div className="mock-modal-backdrop" role="presentation"><section className="mock-modal" role="alertdialog" aria-modal="true" aria-labelledby="archive-project-title" aria-describedby="archive-project-description"><button className="mock-modal-close" type="button" aria-label="Fechar" disabled={isUpdatingArchiveStatus} onClick={() => setArchiveStatusDialogOpen(false)}><X size={19} /></button><h2 id="archive-project-title">{project?.isArchived ? "Reativar projeto?" : "Arquivar projeto?"}</h2><p id="archive-project-description">{project?.isArchived ? "Pretende reativar este projeto? O projeto voltará a estar disponível na lista de projetos ativos." : "Pretende arquivar este projeto? O projeto deixará de estar disponível na lista de projetos ativos."}</p><div className="mock-form-actions"><button className="secondary-action" type="button" disabled={isUpdatingArchiveStatus} onClick={() => setArchiveStatusDialogOpen(false)}>Cancelar</button><button className="primary-action" type="button" disabled={isUpdatingArchiveStatus} onClick={updateArchiveStatus}>{isUpdatingArchiveStatus ? (project?.isArchived ? "A reativar…" : "A arquivar…") : (project?.isArchived ? "Reativar projeto" : "Arquivar projeto")}</button></div></section></div>}
    {discardDialogOpen && <div className="mock-modal-backdrop" role="presentation"><section className="mock-modal" role="alertdialog" aria-modal="true" aria-labelledby="discard-project-changes-title" aria-describedby="discard-project-changes-description"><button className="mock-modal-close" type="button" aria-label="Fechar" onClick={() => setDiscardDialogOpen(false)}><X size={19} /></button><h2 id="discard-project-changes-title">Descartar alterações?</h2><p id="discard-project-changes-description">Existem alterações por guardar. Pretende descartá-las e sair do modo de edição?</p><div className="mock-form-actions"><button className="secondary-action" type="button" onClick={() => setDiscardDialogOpen(false)}>Voltar a editar</button><button className="primary-action" type="button" onClick={discardChanges}>Descartar alterações</button></div></section></div>}
  </PortalShell>;
}
