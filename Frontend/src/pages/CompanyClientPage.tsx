import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Mail, Plus, Search, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import {
  associateClientProject,
  ClientDetail,
  ClientInvitation,
  ClientListItem,
  ClientManagementApiError,
  createClientInvitation,
  getClient,
  getClientInvitations,
  getClients,
  getProjects,
  Project,
  removeClientProject,
  saveClientNotes,
} from "../api/projects";
import { phaseLabel } from "../projectPhases";
import { useProfile } from "../profile/ProfileContext";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase();
const normalizedSearch = (value: string) => value.toLocaleLowerCase("pt-PT");

function ConfirmedClientGrid({ clients, onOpen, searching = false }: { clients: ClientListItem[]; onOpen: (id: number) => void; searching?: boolean }) {
  if (!clients.length) return <p className="mock-empty-state">{searching ? "Nenhum cliente confirmado corresponde à pesquisa." : "Não existem clientes confirmados."}</p>;
  return (
    <div className="mock-client-grid">
      {clients.map((client) => (
        <button className="mock-client-card" type="button" key={client.id} onClick={() => onOpen(client.id)}>
          <span className="mock-client-avatar mock-client-avatar--blue">{initials(client.displayName)}</span>
          <span><strong>{client.displayName}</strong><small>{client.email}</small></span>
          <span className="mock-client-projects">{client.projectCount} {client.projectCount === 1 ? "projeto" : "projetos"}</span>
          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}

function PendingClientGrid({ invitations }: { invitations: ClientInvitation[] }) {
  if (!invitations.length) return <p className="mock-empty-state">Nenhum convite pendente corresponde à pesquisa.</p>;
  return (
    <div className="mock-client-grid">
      {invitations.map((invitation) => (
        <article className="mock-client-card mock-client-card--pending" key={invitation.id}>
          <span className="mock-client-avatar mock-client-avatar--pending" aria-hidden="true"><Mail size={20} /></span>
          <span><strong>{invitation.email}</strong></span>
        </article>
      ))}
    </div>
  );
}

export function CompanyClientPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(true);
  const [confirmedOpen, setConfirmedOpen] = useState(true);
  const navigate = useNavigate();
  const { profile } = useProfile();
  const canInvite = profile?.profileType === "employee" && profile.companyRole === "owner";

  useEffect(() => {
    Promise.all([getClients(), getClientInvitations()])
      .then(([confirmed, pending]) => { setClients(confirmed); setInvitations(pending); setError(""); })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const term = normalizedSearch(query);
  const filteredClients = useMemo(() => clients.filter((client) =>
    normalizedSearch(`${client.displayName} ${client.email}`).includes(term)), [clients, term]);
  const filteredInvitations = useMemo(() => invitations.filter((invitation) =>
    normalizedSearch(invitation.email).includes(term)), [invitations, term]);

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setEmailError(""); setError(""); setNotice("");
    try {
      const invitation = await createClientInvitation(email);
      setInviteOpen(false);
      setEmail("");
      setPendingOpen(true);
      setNotice(`Convite criado para ${invitation.email}.`);
      try {
        setInvitations(await getClientInvitations());
      } catch {
        setInvitations((current) => [invitation, ...current]);
      }
    } catch (reason) {
      if (reason instanceof ClientManagementApiError) {
        setEmailError(reason.fieldErrors.email ?? "");
        setError(reason.fieldErrors.email ? "" : reason.message);
      } else {
        setError("Não foi possível contactar o servidor.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell>
      <header className="mock-page-header">
        <div><p className="mock-eyebrow">Relações</p><h1>Clientes</h1><p>Consulta os clientes do atelier e os convites pendentes.</p></div>
        {canInvite && <button className="primary-action" type="button" onClick={() => { setInviteOpen(true); setEmail(""); setEmailError(""); setError(""); }}><Plus size={18} />Convidar cliente</button>}
      </header>
      <div className="mock-toolbar">
        <label className="mock-search"><Search size={19} /><span className="sr-only">Pesquisar clientes</span><input type="search" placeholder="Pesquisar por nome ou email" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")}><X size={16} /></button>}</label>
        <span className="mock-result-count">{filteredClients.length} clientes{invitations.length > 0 ? ` · ${filteredInvitations.length} pendentes` : ""}</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}

      {invitations.length > 0 ? (
        <>
          <section className="mock-collapsible">
            <button className="mock-section-heading" type="button" aria-expanded={pendingOpen} onClick={() => setPendingOpen((open) => !open)}>
              <span><ChevronDown className={pendingOpen ? "" : "is-collapsed"} size={19} /><strong>Convites pendentes</strong><small>{filteredInvitations.length}</small></span>
            </button>
            {pendingOpen && <PendingClientGrid invitations={filteredInvitations} />}
          </section>
          <section className="mock-collapsible">
            <button className="mock-section-heading" type="button" aria-expanded={confirmedOpen} onClick={() => setConfirmedOpen((open) => !open)}>
              <span><ChevronDown className={confirmedOpen ? "" : "is-collapsed"} size={19} /><strong>Clientes</strong><small>{filteredClients.length}</small></span>
            </button>
            {confirmedOpen && <ConfirmedClientGrid clients={filteredClients} searching={Boolean(term)} onOpen={(id) => navigate(`/clients/${id}`)} />}
          </section>
        </>
      ) : <ConfirmedClientGrid clients={filteredClients} searching={Boolean(term)} onOpen={(id) => navigate(`/clients/${id}`)} />}

      {inviteOpen && (
        <div className="mock-modal-backdrop" role="presentation">
          <form className="mock-modal company-client-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-client-title" onSubmit={submitInvite}>
            <button type="button" className="mock-modal-close" aria-label="Fechar" onClick={() => setInviteOpen(false)}><X size={19} /></button>
            <h2 id="invite-client-title">Convidar cliente</h2>
            <label className="mock-field">Email do cliente<input required type="email" maxLength={320} value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(""); }} autoFocus />{emailError && <small role="alert">{emailError}</small>}</label>
            <div className="mock-form-actions">
              <button className="primary-action" disabled={submitting}>{submitting ? "A convidar…" : "Enviar convite"}</button>
            </div>
          </form>
        </div>
      )}
    </PortalShell>
  );
}

export function CompanyClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () => {
    if (!id) return;
    getClient(id).then((value) => { setClient(value); setNotes(value.internalNotes); setError(""); }).catch((reason: Error) => setError(reason.message));
  };
  useEffect(load, [id]);
  useEffect(() => { if (client?.canManageProjects) getProjects().then(setProjects).catch((reason: Error) => setError(reason.message)); }, [client?.canManageProjects]);

  const save = async () => {
    if (!id) return;
    try { await saveClientNotes(id, notes); setNotice("Notas guardadas com sucesso."); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao guardar."); }
  };
  const associate = async (projectId: number) => { if (id) { await associateClientProject(id, projectId); load(); } };
  const remove = async (projectId: number) => { if (id) { await removeClientProject(id, projectId); load(); } };

  if (!client && !error) return <PortalShell><p>A carregar…</p></PortalShell>;
  if (!client) return <PortalShell><p role="alert">{error}</p></PortalShell>;
  const unassigned = projects.filter((project) => !project.client);

  return (
    <PortalShell>
      <button className="mock-back-link" type="button" onClick={() => navigate("/clients")}><ArrowLeft size={17} />Clientes</button>
      <header className="mock-page-header"><div><h1>{client.displayName}</h1><p>Dados do cliente e projetos associados.</p></div><button className="primary-action" type="button" onClick={save}>Guardar notas</button></header>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <div className="mock-client-detail-grid">
        <div className="mock-form-column">
          <section className="mock-surface"><div className="mock-section-title"><div><h2>Informação do cliente</h2><p>Dados de identificação e contacto.</p></div></div><div className="mock-form-grid">
            <label className="mock-field">Nome completo<input readOnly value={client.fullName} /></label>
            <label className="mock-field">Nome de apresentação<input readOnly value={client.displayName} /></label>
            <label className="mock-field">NIF<input readOnly value={client.nif} /></label>
            <label className="mock-field">Email<input readOnly value={client.email} /></label>
            <label className="mock-field">Telefone<input readOnly value={client.phoneNumber} /></label>
            <label className="mock-field mock-field--wide">Morada<input readOnly value={client.address} /></label>
            <label className="mock-field mock-field--wide">Notas internas<textarea value={notes} maxLength={4000} onChange={(event) => { setNotes(event.target.value); setNotice(""); }} /></label>
          </div></section>
          <section className="mock-surface"><div className="mock-section-title"><div><h2>Projetos associados</h2><p>{client.projects.length} projetos com acesso.</p></div>{client.canManageProjects && <select aria-label="Associar projeto" defaultValue="" onChange={(event) => { if (event.target.value) associate(Number(event.target.value)); event.currentTarget.value = ""; }}><option value="">Associar projeto</option>{unassigned.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select>}</div>{client.projects.map((project) => <div className="mock-compact-project" key={project.id}><div><strong>{project.title}</strong><small>{project.code} · {phaseLabel(project.currentPhaseCode) ?? "Sem fase atual"}</small></div>{client.canManageProjects && <button type="button" onClick={() => remove(project.id)}>Remover</button>}</div>)}</section>
        </div>
        <aside className="mock-client-sidebar"><section className="mock-surface mock-client-identity"><span className="mock-client-avatar mock-client-avatar--blue">{initials(client.displayName)}</span><dl><div><dt>Contacto</dt><dd><Mail size={14} />{client.email}</dd></div></dl></section></aside>
      </div>
    </PortalShell>
  );
}
