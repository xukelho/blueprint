import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, ChevronDown, Download, File, FileArchive, FileImage, FilePlus2, FileSpreadsheet, FileText, FileType2, Folder, FolderOpen, LoaderCircle, LockKeyhole, MessageSquare, MessagesSquare, PanelRightClose, PanelRightOpen, PanelsTopLeft, Plus, Presentation, Send, Trash2, X } from "lucide-react";
import type { ProjectDocument } from "../api/projects";
import { phaseLabel } from "../projectPhases";
import type { TimelinePhase } from "./ProjectTimelineEditor";

type MockMessage = { id: string; author: string; time: string; body: string; own?: boolean };
type MockConversation = { id: string; title: string; scope: "global" | string; messages: MockMessage[] };
export type ProjectDocumentsByPhase = Record<string, ProjectDocument[]>;

const globalConversation: MockConversation = {
  id: "global",
  title: "Conversa geral do projeto",
  scope: "global",
  messages: [
    { id: "global-1", author: "Ana Martins", time: "09:42", body: "Partilhei a atualização do projeto para revisão." },
    { id: "global-2", author: "Marta Silva", time: "10:06", body: "Obrigada. Vamos rever e deixamos comentários ainda hoje." },
  ],
};

const phaseConversations = (phase: TimelinePhase): MockConversation[] => {
  const label = phaseLabel(phase.code) ?? phase.code;
  return [
    {
      id: `${phase.id}:decisions`, title: "Decisões e validações", scope: phase.id,
      messages: [
        { id: `${phase.id}-d1`, author: "Ana Martins", time: "Ontem", body: `Reuni neste tópico as decisões relativas a ${label.toLocaleLowerCase("pt-PT")}.` },
        { id: `${phase.id}-d2`, author: "Marta Silva", time: "08:35", body: "A solução apresentada está alinhada. Podemos avançar." },
      ],
    },
    {
      id: `${phase.id}:details`, title: "Dúvidas sobre a planta", scope: phase.id,
      messages: [
        { id: `${phase.id}-p1`, author: "Marta Silva", time: "11:18", body: "Podemos confirmar a dimensão livre junto à entrada da sala?" },
      ],
    },
  ];
};

const fileType = (name: string) => name.includes(".") ? name.split(".").pop()!.toLocaleLowerCase("pt-PT") : "file";
const fileSize = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1_000))} KB`;
const fileDate = (value: string | null) => value ? new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Upload pendente";
const documentKind = (name: string) => {
  const extension = fileType(name);
  if (extension === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(extension)) return "document";
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(extension)) return "presentation";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "tif", "tiff", "bmp"].includes(extension)) return "image";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  if (["dwg", "dxf", "ifc"].includes(extension)) return "model";
  if (["txt", "md"].includes(extension)) return "text";
  return "generic";
};
const documentIcon = (name: string, size = 25) => {
  const kind = documentKind(name);
  if (kind === "pdf" || kind === "text") return <FileText size={size} aria-hidden="true" />;
  if (kind === "document") return <FileType2 size={size} aria-hidden="true" />;
  if (kind === "spreadsheet") return <FileSpreadsheet size={size} aria-hidden="true" />;
  if (kind === "presentation") return <Presentation size={size} aria-hidden="true" />;
  if (kind === "image") return <FileImage size={size} aria-hidden="true" />;
  if (kind === "archive") return <FileArchive size={size} aria-hidden="true" />;
  if (kind === "model") return <Box size={size} aria-hidden="true" />;
  return <File size={size} aria-hidden="true" />;
};

type ProjectDocumentsProps = {
  phases: TimelinePhase[];
  viewedPhaseId: string | null;
  documents: ProjectDocumentsByPhase;
  loading?: boolean;
  error?: string;
  readOnly?: boolean;
  previewDocumentId?: string | null;
  onUploadFile: (phaseId: string, file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onDownloadDocument?: (document: ProjectDocument) => Promise<void>;
  onPreviewDocumentSelect?: (document: ProjectDocument) => void;
};

type PendingFile = { id: string; name: string; size: number };

export function ProjectDocuments({ phases, viewedPhaseId, documents, loading = false, error = "", readOnly = false, previewDocumentId = null, onUploadFile, onDeleteDocument, onDownloadDocument, onPreviewDocumentSelect }: ProjectDocumentsProps) {
  const phase = phases.find((candidate) => candidate.id === viewedPhaseId) ?? null;
  const phaseDocuments = phase ? documents[phase.id] ?? [] : [];
  const [expandedByPhase, setExpandedByPhase] = useState<Record<string, boolean>>(() => Object.fromEntries(phases.map((item) => [item.id, true])));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [operationError, setOperationError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingDocumentIds, setDownloadingDocumentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const expanded = phase ? expandedByPhase[phase.id] ?? true : false;
  const panelId = `phase-documents-${phase?.id ?? "none"}`;

  useEffect(() => {
    setExpandedByPhase((current) => ({ ...Object.fromEntries(phases.map((item) => [item.id, true])), ...current }));
  }, [phases]);
  useEffect(() => {
    setSelectedIds([]);
    setSelectionAnchor(null);
    setOperationError("");
    setDeleteDialogOpen(false);
  }, [viewedPhaseId]);

  const uploadFiles = async (files: File[]) => {
    if (!phase || readOnly || !files.length) return;
    setExpandedByPhase((current) => ({ ...current, [phase.id]: true }));
    setOperationError("");
    const batch = files.map((file, index) => ({ id: `${Date.now()}:${index}:${file.name}`, file }));
    setPendingFiles((current) => [...current, ...batch.map(({ id, file }) => ({ id, name: file.name, size: file.size }))]);
    const failures: string[] = [];
    await Promise.all(batch.map(async ({ id, file }) => {
      try { await onUploadFile(phase.id, file); }
      catch { failures.push(file.name); }
      finally { setPendingFiles((current) => current.filter((pending) => pending.id !== id)); }
    }));
    if (failures.length) setOperationError(`Não foi possível carregar: ${failures.join(", ")}.`);
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) void uploadFiles(Array.from(event.target.files));
    event.target.value = "";
  };

  const selectDocument = (event: MouseEvent<HTMLButtonElement>, documentId: string) => {
    const additive = event.ctrlKey || event.metaKey;
    if (event.shiftKey && selectionAnchor) {
      const anchorIndex = phaseDocuments.findIndex((document) => document.id === selectionAnchor);
      const selectedIndex = phaseDocuments.findIndex((document) => document.id === documentId);
      if (anchorIndex >= 0 && selectedIndex >= 0) {
        const range = phaseDocuments.slice(Math.min(anchorIndex, selectedIndex), Math.max(anchorIndex, selectedIndex) + 1).map((document) => document.id);
        setSelectedIds((current) => additive ? Array.from(new Set([...current, ...range])) : range);
        return;
      }
    }
    if (additive) setSelectedIds((current) => current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]);
    else setSelectedIds([documentId]);
    setSelectionAnchor(documentId);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setOperationError("");
    const ids = [...selectedIds];
    const results = await Promise.allSettled(ids.map((documentId) => onDeleteDocument(documentId)));
    const failedIds = ids.filter((_, index) => results[index].status === "rejected");
    setSelectedIds(failedIds);
    setSelectionAnchor(failedIds.at(-1) ?? null);
    setDeleting(false);
    setDeleteDialogOpen(false);
    if (failedIds.length) setOperationError(`Não foi possível eliminar ${failedIds.length === 1 ? "o ficheiro selecionado" : `${failedIds.length} ficheiros`}.`);
  };

  const downloadDocument = async (document: ProjectDocument) => {
    if (!onDownloadDocument || downloadingDocumentIds.includes(document.id)) return;
    setOperationError("");
    setDownloadingDocumentIds((current) => [...current, document.id]);
    try { await onDownloadDocument(document); }
    catch { setOperationError(`Não foi possível transferir ${document.fileName}.`); }
    finally { setDownloadingDocumentIds((current) => current.filter((id) => id !== document.id)); }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.key !== "Delete" || !selectedIds.length || readOnly || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
    event.preventDefault();
    setDeleteDialogOpen(true);
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    if (readOnly || !phase || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!dragging) return;
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); }
  };
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (readOnly || !phase) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  };

  return <section className={`mock-surface project-documents ${expanded ? "is-expanded" : ""} ${dragging ? "is-dragging" : ""}`} aria-labelledby="project-documents-title" onKeyDown={handleKeyDown} onDragEnter={handleDragEnter} onDragOver={(event) => { if (!readOnly && phase) event.preventDefault(); }} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    <input ref={inputRef} className="sr-only" type="file" multiple aria-label="Adicionar documentos" disabled={!phase || readOnly} onChange={addFiles} />
    <div className="project-documents__bar">
      <button type="button" className="project-documents__toggle" aria-expanded={expanded} aria-controls={panelId} disabled={!phase} onClick={() => phase && setExpandedByPhase((current) => ({ ...current, [phase.id]: !expanded }))}>
        <span className="project-documents__icon"><Folder size={19} aria-hidden="true" /></span>
        <span><strong id="project-documents-title">Documentos</strong></span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {phase && !readOnly && <button className="project-documents__upload" type="button" title="Adicionar documentos" aria-label="Escolher documentos" onClick={() => inputRef.current?.click()}><FilePlus2 size={16} aria-hidden="true" /></button>}
    </div>
    {expanded && phase && <div className="project-documents__content" id={panelId}>
      {(error || operationError) && <p className="project-documents__error" role="alert">{operationError || error}</p>}
      {loading ? <div className="project-documents__loading" role="status"><LoaderCircle size={24} aria-hidden="true" />A carregar documentos…</div> : phaseDocuments.length || pendingFiles.length ? <div className="project-documents__list" role="listbox" aria-label="Documentos da fase" aria-multiselectable="true">
        {phaseDocuments.map((document) => {
          const downloading = downloadingDocumentIds.includes(document.id);
          return <div className={`project-document ${selectedIds.includes(document.id) ? "is-selected" : ""} ${previewDocumentId === document.id ? "is-previewing" : ""}`} key={document.id}>
            <button type="button" role="option" aria-selected={selectedIds.includes(document.id)} aria-current={previewDocumentId === document.id ? "true" : undefined} className="project-document__select" onClick={(event) => { selectDocument(event, document.id); onPreviewDocumentSelect?.(document); }}>
          <span className={`project-document__file project-document__file--${documentKind(document.fileName)}`}>{documentIcon(document.fileName)}</span>
          <span className="project-document__name"><strong title={document.fileName}>{document.fileName}</strong><small>{document.createdByDisplayName} · {fileDate(document.uploadedAt ?? document.createdAt)}</small><small>{fileSize(document.length)}{document.status !== "Available" ? ` · ${document.status}` : ""}</small></span>
            </button>
            {document.status === "Available" && onDownloadDocument && <button type="button" className="project-document__download" aria-label={downloading ? `A transferir ${document.fileName}` : `Transferir ${document.fileName}`} title={`Transferir ${document.fileName}`} disabled={downloading} onClick={() => void downloadDocument(document)}>{downloading ? <LoaderCircle className="project-document__download-spinner" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}</button>}
          </div>;
        })}
        {pendingFiles.map((pending) => <div className="project-document--uploading" role="status" key={pending.id}>
          <span className="project-document__file"><LoaderCircle size={25} aria-hidden="true" /></span>
          <span className="project-document__name"><strong title={pending.name}>{pending.name}</strong><small>A carregar… · {fileSize(pending.size)}</small></span>
        </div>)}
      </div> : <button type="button" className="project-documents__empty" disabled={readOnly} onClick={() => inputRef.current?.click()}><Plus size={44} aria-hidden="true" /><span><strong>Adicionar documentos</strong><small>{readOnly ? "Este projeto está arquivado." : "Clique ou arraste ficheiros para esta fase do projeto."}</small></span></button>}
    </div>}
    {deleteDialogOpen && <div className="mock-modal-backdrop" role="presentation"><section className="mock-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-documents-title" aria-describedby="delete-documents-description">
      <button className="mock-modal-close" type="button" aria-label="Fechar" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}><X size={19} /></button>
      <h2 id="delete-documents-title">Eliminar {selectedIds.length === 1 ? "documento?" : `${selectedIds.length} documentos?`}</h2>
      <p id="delete-documents-description">Esta ação é permanente. Pretende eliminar {selectedIds.length === 1 ? "o documento selecionado" : "os documentos selecionados"}?</p>
      <div className="mock-form-actions"><button className="secondary-action" type="button" disabled={deleting} onClick={() => setDeleteDialogOpen(false)}>Cancelar</button><button className="project-documents__delete" type="button" disabled={deleting} onClick={() => void confirmDelete()}><Trash2 size={16} aria-hidden="true" />{deleting ? "A eliminar…" : "Eliminar"}</button></div>
    </section></div>}
  </section>;
}

function ConversationChat({ thread, messages, currentUser, phaseName, onMessagesChange, onBack }: { thread: MockConversation; messages: MockMessage[]; currentUser: string; phaseName: string | null; onMessagesChange: (messages: MockMessage[]) => void; onBack?: () => void }) {
  const [draft, setDraft] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    onMessagesChange([...messages, { id: `${thread.id}-${Date.now()}`, author: currentUser, time: "Agora", body, own: true }]);
    setDraft("");
  };

  return <section className="project-conversations__chat" aria-label={thread.title}>
    <header>
      {onBack && <button className="project-conversations__back" type="button" onClick={onBack} aria-label="Voltar à lista de conversas"><ArrowLeft size={17} aria-hidden="true" /></button>}
      <div><strong>{thread.title}</strong><small>{thread.scope === "global" ? "Todo o projeto" : phaseName}</small></div>
      {thread.scope === "global" && <MessageSquare size={15} aria-label="Conversa global" />}
    </header>
    <div className="project-conversations__messages" aria-live="polite">
      {messages.map((message) => <article className={message.own ? "is-own" : ""} key={message.id}><div><strong>{message.author}</strong><time>{message.time}</time></div><p>{message.body}</p></article>)}
    </div>
    <form className="project-conversations__composer" onSubmit={submit}>
      <label className="sr-only" htmlFor={`project-conversation-message-${thread.id}`}>Nova mensagem</label>
      <textarea id={`project-conversation-message-${thread.id}`} rows={2} placeholder="Escrever uma mensagem…" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="submit" aria-label="Enviar mensagem" disabled={!draft.trim()}><Send size={17} aria-hidden="true" /></button>
    </form>
  </section>;
}

type WorkspaceTab = "global" | "conversations" | "files";

export function ProjectWorkspacePanel({ projectTitle, phases, viewedPhaseId, currentUser, documents, onCollapsedChange }: { projectTitle: string; phases: TimelinePhase[]; viewedPhaseId: string | null; currentUser: string; documents: ProjectDocumentsByPhase; onCollapsedChange?: (collapsed: boolean) => void }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("global");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedPhaseThreadId, setSelectedPhaseThreadId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => Object.fromEntries(phases.map((phase) => [phase.id, phase.id === viewedPhaseId])));
  const selectedPhase = phases.find((phase) => phase.id === viewedPhaseId) ?? null;
  const scopedConversations = useMemo(() => selectedPhase ? phaseConversations(selectedPhase) : [], [selectedPhase]);
  const initialMessages = useMemo(() => Object.fromEntries([globalConversation, ...phases.flatMap(phaseConversations)].map((thread) => [thread.id, thread.messages])), [phases]);
  const [messages, setMessages] = useState<Record<string, MockMessage[]>>(initialMessages);
  const selectedPhaseThread = scopedConversations.find((thread) => thread.id === selectedPhaseThreadId) ?? null;

  useEffect(() => { setMessages((current) => ({ ...initialMessages, ...current })); }, [initialMessages]);
  useEffect(() => {
    setSelectedPhaseThreadId(null);
    if (viewedPhaseId) setExpandedFolders((current) => ({ ...current, [viewedPhaseId]: true }));
  }, [viewedPhaseId]);

  const selectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (tab !== "conversations") setSelectedPhaseThreadId(null);
    if (isCollapsed) setCollapsed(false);
  };
  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };
  const updateThreadMessages = (threadId: string, nextMessages: MockMessage[]) => setMessages((current) => ({ ...current, [threadId]: nextMessages }));

  return <aside className={`mock-surface project-conversations ${isCollapsed ? "is-collapsed" : ""}`} aria-labelledby="project-workspace-panel-title">
    <header className="project-conversations__header"><div className="project-conversations__header-content"><PanelsTopLeft className="project-conversations__header-icon" size={20} aria-hidden="true" /><div><h2 id="project-workspace-panel-title">Área do projeto</h2></div></div><button className="project-conversations__collapse" type="button" aria-label={isCollapsed ? "Expandir área do projeto" : "Recolher área do projeto"} aria-expanded={!isCollapsed} onClick={() => setCollapsed(!isCollapsed)}>{isCollapsed ? <PanelRightOpen size={19} aria-hidden="true" /> : <PanelRightClose size={19} aria-hidden="true" />}</button></header>
    <div className="project-workspace-tabs" role="tablist" aria-label="Área do projeto" onKeyDown={handleTabKeyDown}>
      <button type="button" role="tab" id="workspace-tab-global" aria-selected={activeTab === "global"} aria-controls="workspace-panel-global" tabIndex={activeTab === "global" ? 0 : -1} onClick={() => selectTab("global")}><MessageSquare size={14} aria-hidden="true" />Geral</button>
      <button type="button" role="tab" id="workspace-tab-conversations" aria-selected={activeTab === "conversations"} aria-controls="workspace-panel-conversations" tabIndex={activeTab === "conversations" ? 0 : -1} onClick={() => selectTab("conversations")}><MessagesSquare size={14} aria-hidden="true" />Conversas</button>
      <button type="button" role="tab" id="workspace-tab-files" aria-selected={activeTab === "files"} aria-controls="workspace-panel-files" tabIndex={activeTab === "files" ? 0 : -1} onClick={() => selectTab("files")}><Folder size={14} aria-hidden="true" />Ficheiros</button>
    </div>

    {activeTab === "global" && <div className="project-workspace-tabpanel" id="workspace-panel-global" role="tabpanel" aria-labelledby="workspace-tab-global">
      <ConversationChat thread={globalConversation} messages={messages[globalConversation.id] ?? globalConversation.messages} currentUser={currentUser} phaseName={null} onMessagesChange={(next) => updateThreadMessages(globalConversation.id, next)} />
    </div>}

    {activeTab === "conversations" && <div className="project-workspace-tabpanel" id="workspace-panel-conversations" role="tabpanel" aria-labelledby="workspace-tab-conversations">
      {selectedPhaseThread ? <ConversationChat thread={selectedPhaseThread} messages={messages[selectedPhaseThread.id] ?? selectedPhaseThread.messages} currentUser={currentUser} phaseName={phaseLabel(selectedPhase?.code)} onMessagesChange={(next) => updateThreadMessages(selectedPhaseThread.id, next)} onBack={() => setSelectedPhaseThreadId(null)} /> : <div className="project-conversation-index">
        <header><strong>Conversas da fase</strong><small>{selectedPhase ? phaseLabel(selectedPhase.code) : "Sem fase selecionada"}</small></header>
        {scopedConversations.length ? <div className="project-conversation-index__list">{scopedConversations.map((thread) => <button type="button" key={thread.id} onClick={() => setSelectedPhaseThreadId(thread.id)}><span className="project-conversation-dot" aria-hidden="true" /><span><strong>{thread.title}</strong><small>{messages[thread.id]?.length ?? thread.messages.length} mensagens</small></span><span aria-hidden="true">›</span></button>)}</div> : <p className="project-workspace-panel__empty">Selecione uma fase na timeline para consultar as respetivas conversas.</p>}
      </div>}
    </div>}

    {activeTab === "files" && <div className="project-workspace-tabpanel" id="workspace-panel-files" role="tabpanel" aria-labelledby="workspace-tab-files">
      <div className="project-folder-tree__heading"><div><strong>Estrutura do projeto</strong><small>Pastas ligadas às fases da timeline</small></div><LockKeyhole size={16} aria-label="Estrutura protegida" /></div>
      <div className="project-folder-tree" role="tree" aria-label={`Pastas de ${projectTitle}`}>
        <div role="treeitem" aria-expanded="true" className="project-folder-tree__root">
          <span><FolderOpen size={17} aria-hidden="true" /><strong>{projectTitle}</strong></span>
          <div role="group">{phases.map((phase) => {
            const folderExpanded = expandedFolders[phase.id] ?? false;
            const phaseDocuments = documents[phase.id] ?? [];
            return <div role="treeitem" aria-expanded={folderExpanded} aria-current={phase.id === viewedPhaseId ? "true" : undefined} className={phase.id === viewedPhaseId ? "is-current" : ""} key={phase.id}>
              <button type="button" onClick={() => setExpandedFolders((current) => ({ ...current, [phase.id]: !folderExpanded }))}>
                <ChevronDown className="project-folder-tree__chevron" size={14} aria-hidden="true" />
                {folderExpanded ? <FolderOpen size={17} aria-hidden="true" /> : <Folder size={17} aria-hidden="true" />}
                <span><strong>{phaseLabel(phase.code)}</strong><small>{phaseDocuments.length} {phaseDocuments.length === 1 ? "ficheiro" : "ficheiros"}</small></span>
                <LockKeyhole size={13} aria-label="Pasta protegida" />
              </button>
              {folderExpanded && <div role="group" className="project-folder-tree__files">{phaseDocuments.length ? phaseDocuments.map((document) => <div role="treeitem" key={document.id}>{documentIcon(document.fileName, 14)}<span>{document.fileName}</span></div>) : <p>Pasta vazia</p>}</div>}
            </div>;
          })}</div>
        </div>
        {!phases.length && <p className="project-workspace-panel__empty">A timeline ainda não contém fases.</p>}
      </div>
      <p className="project-folder-tree__note"><LockKeyhole size={13} aria-hidden="true" />As pastas são criadas pela timeline e não podem ser movidas, renomeadas ou eliminadas.</p>
    </div>}
  </aside>;
}
