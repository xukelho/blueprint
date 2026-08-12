import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, File, FilePlus2, FileSpreadsheet, FileText, FileType2, Folder, FolderOpen, LockKeyhole, MessageSquare, MessagesSquare, PanelRightClose, PanelRightOpen, PanelsTopLeft, Send } from "lucide-react";
import { phaseDefinition, phaseLabel } from "../projectPhases";
import type { TimelinePhase } from "./ProjectTimelineEditor";

type ProjectFloorPlanProps = { phaseCode: string | null };
type MockMessage = { id: string; author: string; time: string; body: string; own?: boolean };
type MockConversation = { id: string; title: string; scope: "global" | string; messages: MockMessage[] };
export type MockProjectDocument = { id: string; name: string; type: string; size: string; author: string; date: string };
export type MockProjectDocuments = Record<string, MockProjectDocument[]>;

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

export const createMockProjectDocuments = (phases: TimelinePhase[]): MockProjectDocuments => Object.fromEntries(phases.map((phase, index) => {
  if (index === 0) return [phase.id, [
    { id: `${phase.id}:plan`, name: "Planta_Piso_0_R03.pdf", type: "PDF", size: "8,4 MB", author: "Ana Martins", date: "Hoje, 09:38" },
    { id: `${phase.id}:brief`, name: "Memoria_Descritiva.docx", type: "DOCX", size: "1,2 MB", author: "Pedro Sousa", date: "Ontem, 16:12" },
  ]];
  if (index > 0 && index % 3 === 0) return [phase.id, [
    { id: `${phase.id}:model`, name: "Modelo_Coordenacao.ifc", type: "IFC", size: "42,1 MB", author: "Ana Martins", date: "18 jul. 2026" },
    { id: `${phase.id}:specification`, name: "Especificacoes_Tecnicas.pdf", type: "PDF", size: "2,8 MB", author: "Pedro Sousa", date: "17 jul. 2026" },
    { id: `${phase.id}:report`, name: "Relatorio_de_Coordenacao.docx", type: "DOCX", size: "860 KB", author: "Ana Martins", date: "16 jul. 2026" },
    { id: `${phase.id}:measurements`, name: "Mapa_de_Medicoes.xlsx", type: "XLSX", size: "540 KB", author: "Marta Silva", date: "15 jul. 2026" },
    { id: `${phase.id}:notes`, name: "Notas_de_Revisao.txt", type: "TXT", size: "18 KB", author: "Pedro Sousa", date: "14 jul. 2026" },
  ]];
  return [phase.id, []];
}));

const fileType = (name: string) => name.includes(".") ? name.split(".").pop()!.toLocaleUpperCase("pt-PT") : "FICHEIRO";
const fileSize = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1_000))} KB`;
const documentIcon = (type: string) => {
  const normalizedType = type.toLocaleLowerCase("pt-PT");
  if (normalizedType === "pdf") return <FileText size={25} aria-hidden="true" />;
  if (["doc", "docx"].includes(normalizedType)) return <FileType2 size={25} aria-hidden="true" />;
  if (["xls", "xlsx", "csv"].includes(normalizedType)) return <FileSpreadsheet size={25} aria-hidden="true" />;
  return <File size={25} aria-hidden="true" />;
};

export function ProjectFloorPlan({ phaseCode }: ProjectFloorPlanProps) {
  const phase = phaseCode ? phaseDefinition(phaseCode) : null;
  const PhaseIcon = phase?.icon;
  return <section className="mock-surface project-floor-plan" aria-labelledby="floor-plan-title">
    <header className="project-workspace-heading">
      <div><h2 id="floor-plan-title">Planta do projeto</h2><p>Planta ilustrativa · Piso 0</p></div>
      {phase && <span className="project-context-label">{PhaseIcon && <PhaseIcon size={15} aria-hidden="true" />}{phase.label}</span>}
    </header>
    <div className="project-floor-plan__canvas">
      <svg viewBox="0 0 920 560" role="img" aria-label="Planta ilustrativa do piso térreo">
        <title id="floor-plan-svg-title">Planta ilustrativa do piso térreo</title>
        <desc id="floor-plan-svg-description">Distribuição de sala, cozinha, escritório, quartos, instalações sanitárias e circulação.</desc>
        <defs>
          <pattern id="floor-plan-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" /></pattern>
        </defs>
        <rect className="floor-plan-grid" x="0" y="0" width="920" height="560" />
        <g className="floor-plan-walls">
          <path d="M90 58H830V500H90Z" />
          <path d="M90 300H545M545 58V500M690 58V300M545 196H830M295 300V500" />
        </g>
        <g className="floor-plan-windows">
          <path d="M170 58H310M380 58H500M830 105V165M830 350V430M365 500H485M130 500H230" />
        </g>
        <g className="floor-plan-doors">
          <path d="M545 236V294A58 58 0 0 1 487 236M690 142V194A52 52 0 0 1 638 142M295 385V438A53 53 0 0 1 242 385M545 385V442A57 57 0 0 1 488 385" />
        </g>
        <g className="floor-plan-fixtures">
          <rect x="115" y="84" width="174" height="42" rx="3" /><circle cx="145" cy="105" r="13" /><circle cx="185" cy="105" r="13" />
          <rect x="344" y="105" width="116" height="66" rx="3" /><rect x="365" y="120" width="74" height="36" rx="2" />
          <rect x="584" y="84" width="68" height="35" rx="3" /><rect x="720" y="89" width="74" height="78" rx="3" />
          <rect x="122" y="349" width="122" height="64" rx="4" /><rect x="334" y="350" width="164" height="90" rx="4" />
          <rect x="608" y="345" width="165" height="94" rx="4" /><circle cx="723" cy="247" r="23" />
        </g>
        <g className="floor-plan-labels">
          <text x="318" y="248">Sala de estar</text><text x="195" y="175">Cozinha</text><text x="612" y="156">I.S.</text>
          <text x="758" y="247">Escritório</text><text x="190" y="466">Quarto 1</text><text x="420" y="466">Quarto 2</text>
          <text x="688" y="468">Suite</text><text x="607" y="285">Circulação</text>
        </g>
        {phaseCode && <g className="floor-plan-annotations">
          <circle cx="545" cy="300" r="17" /><text x="545" y="305">1</text>
          <path d="M562 300H635" /><rect x="635" y="276" width="170" height="48" rx="5" />
          <text className="floor-plan-annotation-title" x="649" y="296">Ponto em revisão</text><text x="649" y="313">Encontro entre espaços</text>
        </g>}
        <g className="floor-plan-scale"><path d="M716 528H816M716 522V534M766 522V534M816 522V534" /><text x="716" y="551">0</text><text x="808" y="551">5 m</text></g>
      </svg>
    </div>
  </section>;
}

export function ProjectDocuments({ phases, viewedPhaseId, documents, onDocumentsAdded }: { phases: TimelinePhase[]; viewedPhaseId: string | null; documents: MockProjectDocuments; onDocumentsAdded: (phaseId: string, documents: MockProjectDocument[]) => void }) {
  const phase = phases.find((candidate) => candidate.id === viewedPhaseId) ?? null;
  const phaseDocuments = phase ? documents[phase.id] ?? [] : [];
  const [expandedByPhase, setExpandedByPhase] = useState<Record<string, boolean>>(() => Object.fromEntries(phases.map((item) => [item.id, (documents[item.id]?.length ?? 0) > 0])));
  const expanded = phase ? expandedByPhase[phase.id] ?? phaseDocuments.length > 0 : false;
  const panelId = `phase-documents-${phase?.id ?? "none"}`;

  useEffect(() => {
    setExpandedByPhase((current) => ({ ...Object.fromEntries(phases.map((item) => [item.id, (documents[item.id]?.length ?? 0) > 0])), ...current }));
  }, [documents, phases]);

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    if (!phase || !event.target.files?.length) return;
    const added = Array.from(event.target.files).map((file, index) => ({
      id: `${phase.id}:upload:${Date.now()}:${index}`,
      name: file.name,
      type: fileType(file.name),
      size: fileSize(file.size),
      author: "Utilizador atual",
      date: "Agora",
    }));
    onDocumentsAdded(phase.id, added);
    setExpandedByPhase((current) => ({ ...current, [phase.id]: true }));
    event.target.value = "";
  };

  return <section className={`mock-surface project-documents ${expanded ? "is-expanded" : ""}`} aria-labelledby="project-documents-title">
    <div className="project-documents__bar">
      <button type="button" className="project-documents__toggle" aria-expanded={expanded} aria-controls={panelId} disabled={!phase} onClick={() => phase && setExpandedByPhase((current) => ({ ...current, [phase.id]: !expanded }))}>
        <span className="project-documents__icon"><Folder size={19} aria-hidden="true" /></span>
        <span><strong id="project-documents-title">Documentos</strong></span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {phase && <label className="project-documents__upload" title="Adicionar documentos"><FilePlus2 size={16} aria-hidden="true" /><span className="sr-only">Adicionar documentos</span><input type="file" multiple aria-label="Adicionar documentos" onChange={addFiles} /></label>}
    </div>
    {expanded && phase && <div className="project-documents__content" id={panelId}>
      {phaseDocuments.length ? <div className="project-documents__list">
        {phaseDocuments.map((document) => <article key={document.id}>
          <span className={`project-document__file project-document__file--${document.type.toLocaleLowerCase("pt-PT")}`}>{documentIcon(document.type)}</span>
          <span className="project-document__name"><strong>{document.name}</strong><small>{document.author} · {document.date}</small></span>
        </article>)}
      </div> : <div className="project-documents__empty"><Folder size={25} aria-hidden="true" /><div><strong>Esta pasta está vazia</strong><p>Adicione documentos relativos a esta fase do projeto.</p></div></div>}
    </div>}
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

export function ProjectWorkspacePanel({ projectTitle, phases, viewedPhaseId, currentUser, documents, onCollapsedChange }: { projectTitle: string; phases: TimelinePhase[]; viewedPhaseId: string | null; currentUser: string; documents: MockProjectDocuments; onCollapsedChange?: (collapsed: boolean) => void }) {
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
              {folderExpanded && <div role="group" className="project-folder-tree__files">{phaseDocuments.length ? phaseDocuments.map((document) => <div role="treeitem" key={document.id}><File size={14} aria-hidden="true" /><span>{document.name}</span></div>) : <p>Pasta vazia</p>}</div>}
            </div>;
          })}</div>
        </div>
        {!phases.length && <p className="project-workspace-panel__empty">A timeline ainda não contém fases.</p>}
      </div>
      <p className="project-folder-tree__note"><LockKeyhole size={13} aria-hidden="true" />As pastas são criadas pela timeline e não podem ser movidas, renomeadas ou eliminadas.</p>
    </div>}
  </aside>;
}
