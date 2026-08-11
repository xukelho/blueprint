import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import PortalShell from "../components/PortalShell";
import {
  acceptClientInvitation,
  getReceivedClientInvitations,
  ReceivedClientInvitation,
  rejectClientInvitation,
} from "../api/projects";
import { useProfile } from "../profile/ProfileContext";

function companyInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join("").toLocaleUpperCase("pt-PT");
}

export function ClientNotificationsPage() {
  const { refresh } = useProfile();
  const [invitations, setInvitations] = useState<ReceivedClientInvitation[]>([]);
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getReceivedClientInvitations()
      .then(setInvitations)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Não foi possível carregar os convites."))
      .finally(() => setIsLoading(false));
  }, []);

  const respond = async (invitation: ReceivedClientInvitation, action: "accept" | "reject") => {
    if (respondingId !== null) return;
    setRespondingId(invitation.id);
    setError("");
    try {
      if (action === "accept") {
        await acceptClientInvitation(invitation.id);
        await refresh();
      } else {
        await rejectClientInvitation(invitation.id);
      }
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível responder ao convite.");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <PortalShell>
      <header className="mock-page-header">
        <div><p className="mock-eyebrow">Convites</p><h1>Notificações</h1><p>Consulte os convites enviados para o seu email.</p></div>
      </header>
      {isLoading && <p role="status">A carregar convites…</p>}
      {error && <p role="alert">{error}</p>}
      {!isLoading && !error && invitations.length === 0 && <p>Não tem convites pendentes</p>}
      <div className="client-invitation-list mock-client-grid">
        {invitations.map((invitation) => {
          const isResponding = respondingId === invitation.id;
          return (
            <article className="mock-client-card mock-client-card--pending client-invitation-card" key={invitation.id}>
              <span className="mock-client-avatar mock-client-avatar--blue" aria-hidden="true">{companyInitials(invitation.companyName)}</span>
              <p>Recebeu um convite da empresa {invitation.companyName}.</p>
              <div className="client-invitation-actions">
                <button className="client-invitation-action client-invitation-action--accept" type="button" aria-label={`Aceitar convite da empresa ${invitation.companyName}`} title={`Aceitar convite da empresa ${invitation.companyName}`} disabled={isResponding} onClick={() => void respond(invitation, "accept")}><Check size={19} aria-hidden="true" /></button>
                <button className="client-invitation-action client-invitation-action--reject" type="button" aria-label={`Recusar convite da empresa ${invitation.companyName}`} title={`Recusar convite da empresa ${invitation.companyName}`} disabled={isResponding} onClick={() => void respond(invitation, "reject")}><X size={19} aria-hidden="true" /></button>
              </div>
            </article>
          );
        })}
      </div>
    </PortalShell>
  );
}
