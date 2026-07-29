import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudUpload,
  CreditCard,
  FileCheck2,
  FileText,
  FolderOpen,
  GripVertical,
  Headphones,
  Image,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PortalShell from "../components/PortalShell";

type Project = {
  id: number;
  title: string;
  code: string;
  client: string;
  address: string;
  phase: string;
  revision: string;
  status: "Ativo" | "A aguardar cliente" | "Em análise" | "Arquivado";
  notifications: number;
  plan: "courtyard" | "linear" | "compact";
};

const activeProjects: Project[] = [
  { id: 1, title: "Casa do Vale", code: "CV-024", client: "Marta e João Silva", address: "Azeitão, Setúbal", phase: "Projeto de execução", revision: "R07", status: "A aguardar cliente", notifications: 3, plan: "courtyard" },
  { id: 2, title: "Apartamento Alvalade", code: "AA-018", client: "Inês Costa", address: "Alvalade, Lisboa", phase: "Estudo prévio", revision: "R03", status: "Em análise", notifications: 1, plan: "linear" },
  { id: 3, title: "Atelier da Ribeira", code: "AR-031", client: "Ribeira Criativa, Lda.", address: "Alcântara, Lisboa", phase: "Licenciamento", revision: "R05", status: "Ativo", notifications: 0, plan: "compact" },
  { id: 4, title: "Moradia Monte Estoril", code: "ME-029", client: "Pedro Almeida", address: "Monte Estoril, Cascais", phase: "Projeto de execução", revision: "R09", status: "Ativo", notifications: 2, plan: "courtyard" },
];

const archivedProjects: Project[] = [
  { id: 5, title: "Casa Pátio", code: "CP-017", client: "Leonor Ferreira", address: "Comporta, Grândola", phase: "Concluído", revision: "R12", status: "Arquivado", notifications: 0, plan: "compact" },
  { id: 6, title: "Escritório do Chiado", code: "EC-012", client: "Vértice Partners", address: "Chiado, Lisboa", phase: "Concluído", revision: "R08", status: "Arquivado", notifications: 0, plan: "linear" },
];

function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mock-page-header">
      <div>
        {eyebrow && <p className="mock-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="mock-page-actions">{actions}</div>}
    </header>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "info" | "neutral" | "danger" }) {
  return <span className={`mock-status mock-status--${tone}`}><i aria-hidden="true" />{children}</span>;
}

function PlanPreview({ variant }: { variant: Project["plan"] }) {
  return (
    <div className={`mock-plan mock-plan--${variant}`} aria-hidden="true">
      <span className="mock-room mock-room--a" />
      <span className="mock-room mock-room--b" />
      <span className="mock-room mock-room--c" />
      <span className="mock-room mock-room--d" />
      <span className="mock-dimension mock-dimension--a">4.20</span>
      <span className="mock-dimension mock-dimension--b">3.60</span>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = project.status === "Ativo" ? "success" : project.status === "Em análise" ? "info" : project.status === "Arquivado" ? "neutral" : "warning";
  return (
    <article className="mock-project-card">
      <div className="mock-project-preview">
        <span className="mock-project-code">{project.code}</span>
        <button className="mock-icon-button mock-project-menu-button" type="button" aria-label={`Opções de ${project.title}`} onClick={() => setMenuOpen((open) => !open)}>
          <MoreHorizontal size={19} />
        </button>
        {menuOpen && (
          <div className="mock-popover">
            <button type="button" onClick={() => navigate("/projects/casa-do-vale?tab=settings")}>Abrir definições</button>
            <button type="button" onClick={() => navigate("/projects/casa-do-vale?tab=activity")}>Ver atividade</button>
          </div>
        )}
        <button className="mock-project-open" type="button" aria-label={`Abrir projeto ${project.title}`} onClick={() => navigate("/projects/casa-do-vale")}>
          <PlanPreview variant={project.plan} />
        </button>
      </div>
      <button className="mock-project-content" type="button" onClick={() => navigate("/projects/casa-do-vale")}>
        <span className="mock-project-title"><strong>{project.title}</strong><ChevronRight size={17} /></span>
        <span>{project.client}</span>
        <span className="mock-muted-row"><MapPin size={14} />{project.address}</span>
        <span className="mock-project-meta"><span>{project.phase}</span><span>{project.revision}</span></span>
      </button>
      <footer className="mock-project-footer">
        <StatusPill tone={tone}>{project.status}</StatusPill>
        <span className="mock-notification-count"><Bell size={15} />{project.notifications}</span>
      </footer>
    </article>
  );
}

export function ProjectsPage() {
  const [query, setQuery] = useState("");
  const [activeOpen, setActiveOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(true);
  const navigate = useNavigate();
  const filterProjects = (items: Project[]) => {
    const term = query.trim().toLocaleLowerCase("pt-PT");
    return term ? items.filter((project) => [project.title, project.client, project.address, project.code].join(" ").toLocaleLowerCase("pt-PT").includes(term)) : items;
  };
  const filteredActive = filterProjects(activeProjects);
  const filteredArchived = filterProjects(archivedProjects);

  return (
    <PortalShell>
      <PageHeader
        eyebrow="Portefólio"
        title="Projetos"
        description="Consulta, pesquisa e acompanha todos os projetos do atelier."
        actions={<button className="primary-action" type="button" onClick={() => navigate("/projects/new")}><Plus size={18} />Criar projeto</button>}
      />
      <div className="mock-toolbar">
        <label className="mock-search">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Pesquisar projetos</span>
          <input autoFocus type="search" placeholder="Pesquisar por projeto, cliente ou morada" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}
        </label>
        <button className="secondary-action" type="button"><SlidersHorizontal size={17} />Filtros</button>
      </div>

      <section className="mock-collapsible">
        <button className="mock-section-heading" type="button" aria-expanded={activeOpen} onClick={() => setActiveOpen((open) => !open)}>
          <span><ChevronDown className={activeOpen ? "" : "is-collapsed"} size={19} /><strong>Projetos ativos</strong><small>{filteredActive.length}</small></span>
          <span className="mock-heading-action" onClick={(event) => { event.stopPropagation(); navigate("/projects/new"); }}><Plus size={17} />Novo projeto</span>
        </button>
        {activeOpen && <div className="mock-project-grid">{filteredActive.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
      </section>

      <section className="mock-collapsible">
        <button className="mock-section-heading" type="button" aria-expanded={archivedOpen} onClick={() => setArchivedOpen((open) => !open)}>
          <span><ChevronDown className={archivedOpen ? "" : "is-collapsed"} size={19} /><strong>Projetos arquivados</strong><small>{filteredArchived.length}</small></span>
        </button>
        {archivedOpen && <div className="mock-project-grid">{filteredArchived.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
      </section>
    </PortalShell>
  );
}

const defaultPhases = ["Levantamento topográfico", "Estudo prévio", "Licenciamento", "Especialidades", "Início de execução"];

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [phases, setPhases] = useState(defaultPhases);
  const [payment, setPayment] = useState("30%");
  const [saved, setSaved] = useState(false);
  const removePhase = (phase: string) => setPhases((current) => current.filter((item) => item !== phase));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => navigate("/projects/casa-do-vale"), 900);
  };

  return (
    <PortalShell>
      <button className="mock-back-link" type="button" onClick={() => navigate("/projects")}><ArrowLeft size={17} />Projetos</button>
      <PageHeader eyebrow="Novo projeto" title="Criar projeto" description="Define a informação essencial, reúne os primeiros ficheiros e prepara a timeline." />
      <form className="mock-create-layout" onSubmit={submit}>
        <div className="mock-form-column">
          <section className="mock-surface">
            <div className="mock-card-heading"><span className="mock-step">1</span><div><h2>Informação do projeto</h2><p>Estes dados ajudam a identificar o projeto em todo o portal.</p></div></div>
            <div className="mock-form-grid">
              <label className="mock-field mock-field--wide">Título do projeto<span aria-hidden="true">*</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Casa do Vale" /></label>
              <label className="mock-field">Código<input defaultValue="CV-025" /></label>
              <label className="mock-field">Cliente<select defaultValue=""><option value="" disabled>Selecionar cliente</option><option>Marta e João Silva</option><option>Inês Costa</option></select></label>
              <label className="mock-field mock-field--wide">Morada<input placeholder="Rua, localidade e código postal" /></label>
              <label className="mock-field">Fase inicial<select defaultValue="Estudo prévio"><option>Estudo prévio</option><option>Licenciamento</option><option>Projeto de execução</option></select></label>
              <label className="mock-field">Responsável<select defaultValue="Ana Martins"><option>Ana Martins</option><option>Pedro Sousa</option></select></label>
            </div>
          </section>

          <section className="mock-surface">
            <div className="mock-card-heading"><span className="mock-step">2</span><div><h2>Ficheiros iniciais</h2><p>Carrega a planta principal e documentos de apoio.</p></div></div>
            <div className="mock-upload-grid">
              <button className="mock-upload-zone mock-upload-zone--primary" type="button"><CloudUpload size={25} /><strong>Carregar planta</strong><span>PDF até 100 MB</span></button>
              <button className="mock-upload-zone" type="button"><Paperclip size={23} /><strong>Adicionar documentos</strong><span>PDF, DOCX ou XLSX</span></button>
              <button className="mock-upload-zone" type="button"><Image size={23} /><strong>Adicionar fotografias</strong><span>JPG ou PNG</span></button>
            </div>
          </section>
        </div>

        <section className="mock-surface mock-timeline-builder">
          <div className="mock-card-heading"><span className="mock-step">3</span><div><h2>Timeline do projeto</h2><p>Personaliza fases e marcos. Podes reorganizá-los mais tarde.</p></div></div>
          <div className="mock-node-tray">
            <span>Marcos disponíveis</span>
            <button type="button"><GripVertical size={15} />Pagamento</button>
            <button type="button"><GripVertical size={15} />Reunião</button>
            <button type="button"><GripVertical size={15} />Entrega</button>
            <button type="button"><Plus size={15} />Criar marco</button>
          </div>
          <div className="mock-timeline-editor">
            {phases.map((phase, index) => (
              <div className="mock-timeline-item" key={phase}>
                <button type="button" className="mock-phase-node"><span>{index + 1}</span><strong>{phase}</strong></button>
                <button type="button" className="mock-remove-node" aria-label={`Remover ${phase}`} onClick={() => removePhase(phase)}><X size={14} /></button>
                {index < phases.length - 1 && <span className="mock-timeline-line" />}
              </div>
            ))}
          </div>
          <div className="mock-payment-milestone">
            <CreditCard size={18} />
            <div><strong>Pagamento</strong><span>Após Estudo prévio</span></div>
            <label>Valor<input value={payment} onChange={(event) => setPayment(event.target.value)} /></label>
            <button type="button" aria-label="Remover marco"><Trash2 size={16} /></button>
          </div>
          <div className="mock-form-actions">
            <button className="secondary-action" type="button" onClick={() => navigate("/projects")}>Cancelar</button>
            <button className="primary-action" type="submit">{saved ? <><Check size={18} />Projeto criado</> : "Criar projeto"}</button>
          </div>
        </section>
      </form>
    </PortalShell>
  );
}

const projectTabs = ["Visão geral", "Revisões", "Assuntos", "Aprovações", "Ficheiros", "Atividade", "Definições"];

export function ProjectPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get("tab") === "settings" ? "Definições" : params.get("tab") === "activity" ? "Atividade" : "Visão geral";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  return (
    <PortalShell wide>
      <div className="mock-breadcrumbs"><button type="button" onClick={() => navigate("/projects")}>Projetos</button><ChevronRight size={14} /><span>Casa do Vale</span></div>
      <PageHeader
        eyebrow="CV-024 · Projeto de execução"
        title="Casa do Vale"
        description="Azeitão, Setúbal"
        actions={<><button className="secondary-action" type="button"><MoreHorizontal size={18} />Mais ações</button><button className="primary-action" type="button" onClick={() => notify("Fluxo de carregamento de revisão iniciado.")}><CloudUpload size={18} />Carregar revisão</button></>}
      />
      <div className="mock-project-summary">
        <div><span>Estado</span><StatusPill tone="warning">A aguardar cliente</StatusPill></div>
        <div><span>Cliente</span><strong>Marta e João Silva</strong></div>
        <div><span>Responsável</span><strong>Ana Martins</strong></div>
        <div><span>Última revisão</span><strong>R07 · 24 jul. 2026</strong></div>
        <div><span>Aprovação</span><StatusPill tone="warning">Pendente</StatusPill></div>
      </div>
      <nav className="mock-tabs" aria-label="Navegação do projeto">
        {projectTabs.map((tab) => <button className={activeTab === tab ? "is-active" : ""} type="button" key={tab} onClick={() => setActiveTab(tab)}>{tab}{tab === "Assuntos" && <span>6</span>}</button>)}
      </nav>

      {activeTab === "Visão geral" ? (
        <>
          <section className="mock-surface mock-project-timeline">
            <button className="mock-timeline-toggle" type="button" onClick={() => setTimelineOpen((open) => !open)}>
              <span><CalendarDays size={18} /><strong>Timeline do projeto</strong><small>Fase atual: Projeto de execução</small></span>
              <ChevronDown className={timelineOpen ? "" : "is-collapsed"} size={18} />
            </button>
            <div className="mock-phase-track">
              {["Levantamento", "Estudo prévio", "Licenciamento", "Especialidades", "Execução"].map((phase, index) => (
                <div className={`mock-track-phase ${index < 3 ? "is-done" : index === 3 ? "is-current" : ""}`} key={phase}>
                  <span>{index < 3 ? <Check size={13} /> : index + 1}</span>
                  <strong>{phase}</strong>
                  {timelineOpen && <small>{index < 3 ? "Concluída" : index === 3 ? "Em curso · até 18 set." : "Prevista · out. 2026"}</small>}
                </div>
              ))}
            </div>
          </section>
          <div className="mock-overview-grid">
            <div className="mock-overview-main">
              <section className="mock-surface">
                <div className="mock-section-title"><div><h2>O que requer atenção</h2><p>Ordenado por urgência e impacto.</p></div><span>3 itens</span></div>
                <div className="mock-attention-list">
                  <button type="button" onClick={() => setActiveTab("Aprovações")}><span className="mock-attention-icon mock-attention-icon--warning"><FileCheck2 size={19} /></span><span><strong>Aprovação da revisão R07</strong><small>Marta Silva ainda não respondeu · termina em 2 dias</small></span><ChevronRight size={18} /></button>
                  <button type="button" onClick={() => setActiveTab("Assuntos")}><span className="mock-attention-icon mock-attention-icon--info"><MessageSquare size={19} /></span><span><strong>3 assuntos aguardam resposta</strong><small>O mais antigo foi atualizado há 2 dias</small></span><ChevronRight size={18} /></button>
                  <button type="button"><span className="mock-attention-icon mock-attention-icon--neutral"><CalendarDays size={19} /></span><span><strong>Entrega de especialidades</strong><small>Marco previsto para 18 de setembro</small></span><ChevronRight size={18} /></button>
                </div>
              </section>
              <section className="mock-surface">
                <div className="mock-section-title"><div><h2>Atividade recente</h2><p>Últimas alterações neste projeto.</p></div><button type="button" onClick={() => setActiveTab("Atividade")}>Ver atividade</button></div>
                <div className="mock-activity-list">
                  <div><span className="mock-activity-dot" /><p><strong>Ana Martins</strong> publicou a revisão <strong>R07</strong>.<small>Hoje, 09:42</small></p></div>
                  <div><span className="mock-activity-dot" /><p><strong>Marta Silva</strong> respondeu ao assunto “Janela da sala”.<small>Ontem, 16:18</small></p></div>
                  <div><span className="mock-activity-dot" /><p><strong>Pedro Sousa</strong> concluiu o assunto #14.<small>24 jul., 11:03</small></p></div>
                </div>
              </section>
            </div>
            <aside className="mock-overview-side">
              <section className="mock-surface">
                <div className="mock-section-title"><div><h2>Equipa</h2></div><button type="button">Gerir</button></div>
                <div className="mock-person"><span className="mock-avatar mock-avatar--coral">MS</span><div><span>Cliente</span><strong>Marta e João Silva</strong></div></div>
                <div className="mock-person"><span className="mock-avatar">AM</span><div><span>Arquiteta responsável</span><strong>Ana Martins</strong></div></div>
                <div className="mock-person"><span className="mock-avatar mock-avatar--green">PS</span><div><span>Equipa</span><strong>Pedro Sousa +2</strong></div></div>
              </section>
              <section className="mock-surface">
                <div className="mock-section-title"><div><h2>Resumo</h2></div></div>
                <dl className="mock-summary-list"><div><dt>Assuntos abertos</dt><dd>6</dd></div><div><dt>A aguardar cliente</dt><dd>3</dd></div><div><dt>Ficheiros</dt><dd>24</dd></div><div><dt>Revisões</dt><dd>7</dd></div></dl>
              </section>
            </aside>
          </div>
        </>
      ) : <ProjectTabContent tab={activeTab} notify={notify} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </PortalShell>
  );
}

function ProjectTabContent({ tab, notify }: { tab: string; notify: (message: string) => void }) {
  const content: Record<string, { title: string; description: string; rows: Array<[string, string, string]> }> = {
    Revisões: { title: "Revisões", description: "Histórico imutável dos conjuntos publicados.", rows: [["R07 · Soluções de caixilharia", "Publicada por Ana Martins · 24 jul. 2026", "Em análise"], ["R06 · Ajustes da cozinha", "Publicada por Pedro Sousa · 11 jul. 2026", "Substituída"], ["R05 · Projeto de especialidades", "Publicada por Ana Martins · 28 jun. 2026", "Aprovada"]] },
    Assuntos: { title: "Assuntos", description: "Conversas com contexto, responsável e estado.", rows: [["#18 · Janela da sala", "Marta Silva · Planta do piso 0 · R07", "A aguardar arquiteto"], ["#17 · Material do pavimento", "Ana Martins · Mapa de acabamentos · R07", "A aguardar cliente"], ["#14 · Porta da despensa", "Pedro Sousa · Planta do piso 0 · R06", "Resolvido"]] },
    Aprovações: { title: "Aprovações", description: "Decisões formais associadas a uma revisão exata.", rows: [["Revisão R07", "Pedido enviado a Marta Silva · termina 29 jul.", "A aguardar cliente"], ["Revisão R05", "Aprovada por Marta Silva · 30 jun. 2026", "Aprovada"]] },
    Ficheiros: { title: "Ficheiros", description: "Documentos organizados por revisão e contexto.", rows: [["CV024_R07_PlantaPiso0.pdf", "PDF · 8,4 MB · Ana Martins", "R07"], ["CV024_R07_Especialidades.ifc", "IFC · 42,1 MB · Ana Martins", "R07"], ["Mapa_de_acabamentos.xlsx", "XLSX · 740 KB · Pedro Sousa", "R06"]] },
    Atividade: { title: "Atividade", description: "Registo cronológico de todas as decisões e alterações.", rows: [["Revisão R07 publicada", "Ana Martins · Hoje, 09:42", "Revisão"], ["Nova resposta no assunto #18", "Marta Silva · Ontem, 16:18", "Assunto"], ["Assunto #14 concluído", "Pedro Sousa · 24 jul., 11:03", "Assunto"]] },
    Definições: { title: "Definições do projeto", description: "Gere informação, equipa e permissões deste projeto.", rows: [["Informação geral", "Nome, código, morada e descrição", "Editar"], ["Equipa e acessos", "5 membros com acesso", "Gerir"], ["Arquivo do projeto", "Move o projeto para a área de arquivo", "Arquivar"]] },
  };
  const current = content[tab] ?? content.Revisões;
  return (
    <section className="mock-surface mock-tab-panel">
      <div className="mock-section-title">
        <div><h2>{current.title}</h2><p>{current.description}</p></div>
        {tab === "Revisões" && <button className="primary-action" type="button" onClick={() => notify("Fluxo de carregamento de revisão iniciado.")}><CloudUpload size={17} />Carregar revisão</button>}
        {tab === "Assuntos" && <button className="primary-action" type="button" onClick={() => notify("Novo assunto criado.")}><Plus size={17} />Criar assunto</button>}
        {tab === "Aprovações" && <button className="primary-action" type="button" onClick={() => notify("Novo pedido de aprovação preparado.")}><Plus size={17} />Pedir aprovação</button>}
      </div>
      <div className="mock-data-list">
        {current.rows.map((row) => <button type="button" key={row[0]}><span className="mock-file-icon">{tab === "Ficheiros" ? <FileText size={19} /> : tab === "Assuntos" ? <MessageSquare size={19} /> : tab === "Atividade" ? <Activity size={19} /> : <FileCheck2 size={19} />}</span><span><strong>{row[0]}</strong><small>{row[1]}</small></span><StatusPill tone={row[2].includes("Aprov") || row[2].includes("Resolvido") ? "success" : row[2].includes("aguardar") || row[2].includes("análise") ? "warning" : "neutral"}>{row[2]}</StatusPill><ChevronRight size={17} /></button>)}
      </div>
    </section>
  );
}

const clients = [
  { initials: "MS", name: "Marta e João Silva", email: "marta.silva@email.pt", projects: "2 projetos ativos", tone: "coral" },
  { initials: "IC", name: "Inês Costa", email: "ines.costa@email.pt", projects: "1 projeto ativo", tone: "blue" },
  { initials: "RC", name: "Ribeira Criativa, Lda.", email: "geral@ribeiracriativa.pt", projects: "1 projeto ativo", tone: "green" },
  { initials: "PA", name: "Pedro Almeida", email: "pedro.almeida@email.pt", projects: "1 projeto ativo", tone: "sand" },
  { initials: "LF", name: "Leonor Ferreira", email: "leonor.ferreira@email.pt", projects: "Sem projetos ativos", tone: "purple" },
  { initials: "VP", name: "Vértice Partners", email: "office@vertice.pt", projects: "Sem projetos ativos", tone: "blue" },
];

export function ClientsPage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const filtered = useMemo(() => clients.filter((client) => `${client.name} ${client.email}`.toLocaleLowerCase("pt-PT").includes(query.toLocaleLowerCase("pt-PT"))), [query]);
  return (
    <PortalShell>
      <PageHeader eyebrow="Relações" title="Clientes" description="Consulta os clientes do atelier e os projetos associados." actions={<button className="primary-action" type="button"><Plus size={18} />Adicionar cliente</button>} />
      <div className="mock-toolbar">
        <label className="mock-search"><Search size={19} /><span className="sr-only">Pesquisar clientes</span><input autoFocus type="search" placeholder="Pesquisar por nome ou email" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}</label>
        <span className="mock-result-count">{filtered.length} clientes</span>
      </div>
      <div className="mock-client-grid">
        {filtered.map((client) => (
          <button className="mock-client-card" type="button" key={client.email} onClick={() => navigate("/clients/marta-silva")}>
            <span className={`mock-client-avatar mock-client-avatar--${client.tone}`}>{client.initials}</span>
            <span><strong>{client.name}</strong><small>{client.email}</small></span>
            <span className="mock-client-projects">{client.projects}</span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </PortalShell>
  );
}

export function ClientPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  return (
    <PortalShell>
      <button className="mock-back-link" type="button" onClick={() => navigate("/clients")}><ArrowLeft size={17} />Clientes</button>
      <PageHeader title="Marta Silva" description="Cliente particular · Acesso ativo" actions={<><button className="secondary-action" type="button"><Mail size={17} />Reenviar convite</button><button className="primary-action" type="button" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2200); }}>{saved ? <><Check size={17} />Guardado</> : "Guardar alterações"}</button></>} />
      <div className="mock-client-detail-grid">
        <div className="mock-form-column">
          <section className="mock-surface">
            <div className="mock-section-title"><div><h2>Informação do cliente</h2><p>Dados de identificação e contacto.</p></div></div>
            <div className="mock-form-grid">
              <label className="mock-field">Nome completo<input defaultValue="Marta Isabel Silva" /></label>
              <label className="mock-field">Nome de apresentação<input defaultValue="Marta Silva" /></label>
              <label className="mock-field">Tipo de cliente<select defaultValue="Particular"><option>Particular</option><option>Organização</option><option>Empresa</option></select></label>
              <label className="mock-field">NIF<input defaultValue="245 891 320" /></label>
              <label className="mock-field">Email principal<input type="email" defaultValue="marta.silva@email.pt" /><small>A alteração requer confirmação do novo endereço.</small></label>
              <label className="mock-field">Telefone<input defaultValue="+351 912 345 678" /></label>
              <label className="mock-field mock-field--wide">Morada<input defaultValue="Rua do Pinhal, 14 · 2925-468 Azeitão" /></label>
              <label className="mock-field mock-field--wide">Notas internas<textarea defaultValue="Prefere contacto ao final da tarde. Decisões conjuntas com João Silva." /></label>
            </div>
          </section>
          <section className="mock-surface">
            <div className="mock-section-title"><div><h2>Projetos associados</h2><p>2 projetos com acesso.</p></div><button type="button">Associar projeto</button></div>
            <div className="mock-compact-project"><PlanPreview variant="courtyard" /><div><strong>Casa do Vale</strong><small>CV-024 · Projeto de execução</small></div><StatusPill tone="warning">A aguardar cliente</StatusPill><ChevronRight size={17} /></div>
            <div className="mock-compact-project"><PlanPreview variant="compact" /><div><strong>Casa Pátio</strong><small>CP-017 · Concluído</small></div><StatusPill>Arquivado</StatusPill><ChevronRight size={17} /></div>
          </section>
        </div>
        <aside className="mock-client-sidebar">
          <section className="mock-surface mock-client-identity"><span className="mock-client-avatar mock-client-avatar--coral">MS</span><button type="button">Alterar fotografia</button><dl><div><dt>Estado</dt><dd><StatusPill tone="success">Ativo</StatusPill></dd></div><div><dt>Último acesso</dt><dd>Hoje, 08:54</dd></div><div><dt>Convite aceite</dt><dd>12 mar. 2026</dd></div></dl></section>
          <section className="mock-surface"><div className="mock-section-title"><div><h2>Atividade</h2></div></div><div className="mock-mini-activity"><p>Respondeu ao assunto #18<small>Ontem, 16:18</small></p><p>Consultou a revisão R07<small>Ontem, 15:52</small></p><p>Aprovou a revisão R05<small>30 jun., 10:14</small></p></div></section>
        </aside>
      </div>
    </PortalShell>
  );
}

const settingsNav = [
  { label: "Perfil e conta", icon: UserRound },
  { label: "Atelier", icon: Building2 },
  { label: "Membros e permissões", icon: Users },
  { label: "Faturação e subscrição", icon: CreditCard },
  { label: "Integrações", icon: Link2 },
  { label: "Segurança e sessões", icon: ShieldCheck },
  { label: "Preferências gerais", icon: Settings },
];

export function SettingsPage() {
  const [section, setSection] = useState("Atelier");
  const [saved, setSaved] = useState(false);
  return (
    <PortalShell>
      <PageHeader eyebrow="Administração" title="Definições" description="Gere o atelier, a subscrição e as regras de acesso." />
      <div className="mock-settings-layout">
        <nav className="mock-settings-nav" aria-label="Secções de definições">{settingsNav.map((item) => { const Icon = item.icon; return <button className={section === item.label ? "is-active" : ""} type="button" key={item.label} onClick={() => setSection(item.label)}><Icon size={18} />{item.label}<ChevronRight size={16} /></button>; })}</nav>
        <section className="mock-surface mock-settings-content">
          <div className="mock-section-title"><div><h2>{section}</h2><p>{section === "Atelier" ? "Informação visível nos projetos e comunicações do atelier." : `Configura as opções de ${section.toLocaleLowerCase("pt-PT")}.`}</p></div></div>
          {section === "Atelier" ? (
            <div className="mock-form-grid">
              <label className="mock-field mock-field--wide">Nome do atelier<input defaultValue="Forma Norte — Arquitetura" /></label>
              <label className="mock-field">Email geral<input defaultValue="geral@formanorte.pt" /></label>
              <label className="mock-field">Telefone<input defaultValue="+351 213 445 890" /></label>
              <label className="mock-field mock-field--wide">Morada<input defaultValue="Rua das Flores, 28 · 1200-195 Lisboa" /></label>
              <label className="mock-field">NIF<input defaultValue="517 403 920" /></label>
              <label className="mock-field">Website<input defaultValue="https://formanorte.pt" /></label>
              <label className="mock-field mock-field--wide">Idioma do atelier<select defaultValue="Português (Portugal)"><option>Português (Portugal)</option><option>English</option></select></label>
            </div>
          ) : (
            <div className="mock-settings-placeholder"><Settings size={28} /><h3>{section}</h3><p>As opções desta área foram organizadas para manter cada decisão clara e contextual.</p><button className="secondary-action" type="button">Configurar</button></div>
          )}
          <div className="mock-form-actions"><button className="primary-action" type="button" onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2000); }}>{saved ? <><Check size={17} />Alterações guardadas</> : "Guardar alterações"}</button></div>
        </section>
      </div>
    </PortalShell>
  );
}

const notificationGroups = [
  { title: "Projetos e revisões", rows: ["Nova revisão publicada", "Alteração de fase ou prazo", "Ficheiro processado com erro"] },
  { title: "Assuntos", rows: ["Novo assunto, resposta ou menção", "Alteração de estado ou responsável"] },
  { title: "Aprovações e acesso", rows: ["Pedido, concessão ou rejeição de aprovação", "Convite e alteração de acesso"] },
  { title: "Resumos", rows: ["Resumo diário", "Resumo semanal"] },
];

export function NotificationsPage() {
  const [preferences, setPreferences] = useState<Record<string, { app: boolean; email: boolean }>>(() => Object.fromEntries(notificationGroups.flatMap((group) => group.rows).map((row) => [row, { app: true, email: !row.includes("erro") }])));
  const toggle = (row: string, channel: "app" | "email") => setPreferences((current) => ({ ...current, [row]: { ...current[row], [channel]: !current[row][channel] } }));
  return (
    <PortalShell>
      <PageHeader eyebrow="Preferências" title="Notificações" description="Escolhe os eventos e os canais pelos quais queres ser notificada." actions={<button className="primary-action" type="button"><Check size={17} />Guardar preferências</button>} />
      <div className="mock-notification-head"><span>Evento</span><span>Na aplicação</span><span>Email</span></div>
      <div className="mock-notification-groups">
        {notificationGroups.map((group) => <section className="mock-surface" key={group.title}><h2>{group.title}</h2>{group.rows.map((row) => <div className="mock-preference-row" key={row}><span>{row}</span><Toggle checked={preferences[row].app} label={`${row} na aplicação`} onChange={() => toggle(row, "app")} /><Toggle checked={preferences[row].email} label={`${row} por email`} onChange={() => toggle(row, "email")} /></div>)}</section>)}
      </div>
      <section className="mock-surface mock-digest-card"><div><Clock3 size={21} /><span><strong>Horário dos resumos</strong><small>Recebe resumos às 08:30, no teu fuso horário.</small></span></div><button className="secondary-action" type="button">Alterar horário</button></section>
    </PortalShell>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <button className={`mock-toggle ${checked ? "is-on" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

const guides = [
  { icon: FolderOpen, title: "Começar um projeto", text: "Cria um projeto, convida clientes e prepara a timeline." },
  { icon: CloudUpload, title: "Publicar uma revisão", text: "Carrega, valida e publica um novo conjunto de ficheiros." },
  { icon: MessageSquare, title: "Gerir assuntos", text: "Cria marcações e acompanha cada decisão até à resolução." },
  { icon: FileCheck2, title: "Pedir uma aprovação", text: "Envia um pedido claro e consulta o histórico da decisão." },
];

export function HelpPage() {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <PortalShell>
      <PageHeader eyebrow="Centro de ajuda" title="Como podemos ajudar?" description="Encontra respostas rápidas ou fala diretamente com a equipa 2Rivr." />
      <label className="mock-help-search"><Search size={21} /><span className="sr-only">Pesquisar guias</span><input type="search" placeholder="Pesquisar guias, funcionalidades ou dúvidas" /></label>
      <section className="mock-help-section"><div className="mock-section-title"><div><h2>Guias essenciais</h2><p>Passos curtos para as tarefas mais frequentes.</p></div><button type="button">Ver todos os guias</button></div><div className="mock-guide-grid">{guides.map((guide) => { const Icon = guide.icon; return <button type="button" className="mock-guide-card" key={guide.title}><span><Icon size={21} /></span><strong>{guide.title}</strong><p>{guide.text}</p><small>Ler guia <ChevronRight size={14} /></small></button>; })}</div></section>
      <div className="mock-support-grid">
        <section className="mock-surface mock-support-card"><span className="mock-support-icon"><Headphones size={24} /></span><div><h2>Contactar o suporte</h2><p>Reporta um erro ou pede ajuda com outra questão. Respondemos normalmente num dia útil.</p><button className="primary-action" type="button" onClick={() => setTicketOpen(true)}>Criar pedido de suporte</button></div></section>
        <section className="mock-surface mock-contact-card"><h2>2Rivr</h2><p>Equipa responsável pelo Blueprint.</p><a href="mailto:suporte@2rivr.com"><Mail size={17} />suporte@2rivr.com</a><a href="tel:+351210000000"><Phone size={17} />+351 210 000 000</a><span><Clock3 size={17} />Dias úteis, 09:00–18:00</span></section>
      </div>
      {ticketOpen && <div className="mock-modal-backdrop" role="presentation"><section className="mock-modal" role="dialog" aria-modal="true" aria-labelledby="support-title"><button className="mock-modal-close" type="button" aria-label="Fechar" onClick={() => setTicketOpen(false)}><X size={19} /></button><h2 id="support-title">Novo pedido de suporte</h2><p>Descreve o que aconteceu e inclui o contexto necessário.</p><label className="mock-field">Assunto<input placeholder="Resumo do pedido" /></label><label className="mock-field">Categoria<select><option>Problema técnico</option><option>Dúvida de utilização</option><option>Faturação</option></select></label><label className="mock-field">Descrição<textarea placeholder="O que estavas a tentar fazer?" /></label><div className="mock-form-actions"><button className="secondary-action" type="button" onClick={() => setTicketOpen(false)}>Cancelar</button><button className="primary-action" type="button" onClick={() => { setSent(true); window.setTimeout(() => { setTicketOpen(false); setSent(false); }, 900); }}>{sent ? <><Check size={17} />Pedido enviado</> : "Enviar pedido"}</button></div></section></div>}
    </PortalShell>
  );
}
