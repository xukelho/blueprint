import { useEffect, useState } from "react";
import { Check, CheckCheck, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PortalShell from "../components/PortalShell";
import { NotificationList } from "../components/NotificationList";
import { acceptClientInvitation, getReceivedClientInvitations, ReceivedClientInvitation, rejectClientInvitation } from "../api/projects";
import { notifyNotificationsChanged } from "../api/notifications";
import { useNotifications } from "../hooks/useNotifications";
import { useProfile } from "../profile/ProfileContext";

const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("pt-PT");

export function NotificationsPage() {
  const { profile, refresh: refreshProfile } = useProfile();
  const isClient = profile?.profileType === "client";
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const notifications = useNotifications({ unreadOnly });
  const [invitations, setInvitations] = useState<ReceivedClientInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(isClient);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [invitationError, setInvitationError] = useState("");

  useEffect(() => {
    if (!isClient) { setInvitations([]); setInvitationsLoading(false); return; }
    let active = true;
    setInvitationsLoading(true);
    const loadInvitations = () => {
      setInvitationError("");
      return getReceivedClientInvitations()
        .then((received) => { if (active) setInvitations(received); })
        .catch((caught) => { if (active) setInvitationError(caught instanceof Error ? caught.message : "Não foi possível carregar os convites."); })
        .finally(() => { if (active) setInvitationsLoading(false); });
    };
    void loadInvitations();
    const refresh = () => void loadInvitations();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [isClient]);

  const setUnreadOnly = (value: boolean) => setSearchParams(value ? { unreadOnly: "true" } : {}, { replace: true });

  const respond = async (invitation: ReceivedClientInvitation, action: "accept" | "reject") => {
    if (respondingId !== null) return;
    setRespondingId(invitation.id); setInvitationError("");
    try {
      if (action === "accept") { await acceptClientInvitation(invitation.id); await refreshProfile(); }
      else await rejectClientInvitation(invitation.id);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      notifyNotificationsChanged();
    } catch (caught) { setInvitationError(caught instanceof Error ? caught.message : "Não foi possível responder ao convite."); }
    finally { setRespondingId(null); }
  };

  return <PortalShell>
    <header className="mock-page-header notifications-header">
      <div><p className="mock-eyebrow">Atividade</p><h1>Notificações</h1><p>Acompanhe as alterações dos projetos em que participa.</p></div>
      <button className="secondary-action" type="button" disabled={!notifications.items.some((item) => !item.readAt)} onClick={() => void notifications.readAll()}><CheckCheck size={17} />Marcar tudo como lido</button>
    </header>
    {(notifications.error || invitationError) && <p className="mock-project-notice mock-project-notice--error" role="alert">{notifications.error || invitationError}</p>}
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
      <NotificationList items={notifications.items} loading={notifications.loading || invitationsLoading} emptyText={unreadOnly ? "Não tem notificações por ler." : "Ainda não existem notificações de projetos."} onRead={notifications.read} />
      {notifications.hasMore && <button className="secondary-action notifications-more" type="button" disabled={notifications.loadingMore} onClick={() => void notifications.loadMore()}>{notifications.loadingMore ? "A carregar…" : "Carregar mais"}</button>}
    </section>
  </PortalShell>;
}
