import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, MessageSquare, X } from "lucide-react";
import PortalShell from "../components/PortalShell";
import { acceptClientInvitation, getReceivedClientInvitations, ReceivedClientInvitation, rejectClientInvitation } from "../api/projects";
import { getNotifications, markAllNotificationsRead, markNotificationRead, notifyNotificationsChanged, ProjectNotification } from "../api/notifications";
import { useProfile } from "../profile/ProfileContext";

const dayLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-PT");

export function NotificationsPage() {
  const { profile, refresh: refreshProfile } = useProfile();
  const isClient = profile?.profileType === "client";
  const [items, setItems] = useState<ProjectNotification[]>([]);
  const [invitations, setInvitations] = useState<ReceivedClientInvitation[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [page, received] = await Promise.all([
        getNotifications({ unreadOnly }),
        isClient ? getReceivedClientInvitations() : Promise.resolve([]),
      ]);
      setItems(page.items);
      setHasMore(page.hasMore);
      setInvitations(received);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [isClient, unreadOnly]);

  useEffect(() => {
    setLoading(true);
    void load();
    const refresh = () => void load();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [load]);

  const groups = useMemo(() => Object.entries(items.reduce<Record<string, ProjectNotification[]>>((result, item) => {
    const day = dayLabel(item.createdAt);
    result[day] = [...(result[day] ?? []), item];
    return result;
  }, {})), [items]);

  const read = async (item: ProjectNotification) => {
    if (item.readAt) return;
    try {
      await markNotificationRead(item.id);
      const readAt = new Date().toISOString();
      setItems((current) => unreadOnly ? current.filter((candidate) => candidate.id !== item.id) : current.map((candidate) => candidate.id === item.id ? { ...candidate, readAt } : candidate));
      notifyNotificationsChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível marcar a notificação como lida."); }
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => unreadOnly ? [] : current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      notifyNotificationsChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível marcar as notificações como lidas."); }
  };

  const loadMore = async () => {
    const beforeId = items.at(-1)?.id;
    if (!beforeId || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getNotifications({ beforeId, unreadOnly });
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar mais notificações."); }
    finally { setLoadingMore(false); }
  };

  const respond = async (invitation: ReceivedClientInvitation, action: "accept" | "reject") => {
    if (respondingId !== null) return;
    setRespondingId(invitation.id); setError("");
    try {
      if (action === "accept") { await acceptClientInvitation(invitation.id); await refreshProfile(); }
      else await rejectClientInvitation(invitation.id);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      notifyNotificationsChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível responder ao convite."); }
    finally { setRespondingId(null); }
  };

  return <PortalShell>
    <header className="mock-page-header notifications-header">
      <div><p className="mock-eyebrow">Atividade</p><h1>Notificações</h1><p>Acompanhe as alterações dos projetos em que participa.</p></div>
      <button className="secondary-action" type="button" disabled={!items.some((item) => !item.readAt)} onClick={() => void readAll()}><CheckCheck size={17} />Marcar tudo como lido</button>
    </header>
    {error && <p className="mock-project-notice mock-project-notice--error" role="alert">{error}</p>}
    {isClient && invitations.length > 0 && <section className="notifications-section" aria-labelledby="notification-invitations-title">
      <h2 id="notification-invitations-title">Convites</h2>
      <div className="client-invitation-list mock-client-grid">{invitations.map((invitation) => <article className="mock-client-card mock-client-card--pending client-invitation-card" key={invitation.id}>
        <span className="mock-client-avatar mock-client-avatar--blue" aria-hidden="true">{initials(invitation.companyName)}</span>
        <p>Recebeu um convite da empresa {invitation.companyName}.</p>
        <div className="client-invitation-actions">
          <button className="client-invitation-action client-invitation-action--accept" type="button" aria-label={`Aceitar convite da empresa ${invitation.companyName}`} title={`Aceitar convite da empresa ${invitation.companyName}`} disabled={respondingId === invitation.id} onClick={() => void respond(invitation, "accept")}><Check size={19} /></button>
          <button className="client-invitation-action client-invitation-action--reject" type="button" aria-label={`Recusar convite da empresa ${invitation.companyName}`} title={`Recusar convite da empresa ${invitation.companyName}`} disabled={respondingId === invitation.id} onClick={() => void respond(invitation, "reject")}><X size={19} /></button>
        </div>
      </article>)}</div>
    </section>}
    <section className="notifications-section" aria-labelledby="notification-activity-title">
      <div className="notifications-toolbar"><h2 id="notification-activity-title">Atividade dos projetos</h2><div role="group" aria-label="Filtrar notificações"><button type="button" className={!unreadOnly ? "is-active" : ""} onClick={() => setUnreadOnly(false)}>Todas</button><button type="button" className={unreadOnly ? "is-active" : ""} onClick={() => setUnreadOnly(true)}>Não lidas</button></div></div>
      {loading ? <p role="status">A carregar notificações…</p> : groups.length === 0 ? <div className="notifications-empty"><Bell size={25} /><p>{unreadOnly ? "Não tem notificações por ler." : "Ainda não existem notificações de projetos."}</p></div> : groups.map(([day, notifications]) => <div className="notification-day" key={day}><h3>{day}</h3><div className="notification-list">{notifications.map((item) => <button type="button" className={`notification-card ${item.readAt ? "" : "is-unread"}`} key={item.id} onClick={() => void read(item)}>
        <span className="notification-card__icon"><MessageSquare size={18} /></span><span className="notification-card__copy"><strong>{item.actorDisplayName} {item.summary}</strong><small>{item.projectTitle}</small></span><time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>{!item.readAt && <span className="notification-card__dot" aria-label="Não lida" />}
      </button>)}</div></div>)}
      {hasMore && <button className="secondary-action notifications-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "A carregar…" : "Carregar mais"}</button>}
    </section>
  </PortalShell>;
}
