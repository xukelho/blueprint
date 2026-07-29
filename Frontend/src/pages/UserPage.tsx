import { ReactNode, useState } from "react";
import {
  Check,
  ChevronRight,
  Globe2,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import PortalShell from "../components/PortalShell";

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
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

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "neutral";
}) {
  return (
    <span className={`mock-status mock-status--${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export type UserPageProfile = {
  initials: string;
  name: string;
  fullName: string;
  roleLabel: string;
  additionalRoleLabels?: string[];
  organization: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  linkedIn: string;
  instagram: string;
};

export default function UserPage({ profile }: { profile: UserPageProfile }) {
  const [section, setSection] = useState("Dados pessoais");
  const [saved, setSaved] = useState(false);
  const sections = [
    "Dados pessoais",
    "Contactos",
    "Segurança",
    "Notificações",
    "Dados financeiros",
  ];

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PortalShell>
      <PageHeader
        eyebrow="Conta"
        title={`Perfil de ${profile.roleLabel.toLocaleLowerCase("pt-PT")}`}
        description="Gere os teus dados pessoais, segurança e preferências."
        actions={
          <button className="primary-action" type="button" onClick={save}>
            {saved ? (
              <>
                <Check size={17} />
                Guardado
              </>
            ) : (
              "Guardar alterações"
            )}
          </button>
        }
      />

      <div className="mock-profile-hero mock-surface">
        <span className="mock-profile-avatar">{profile.initials}</span>
        <div>
          <h2>{profile.name}</h2>
          <p>
            {[profile.roleLabel, ...(profile.additionalRoleLabels ?? [])].join(" · ")}
            {" · "}{profile.organization}
          </p>
        </div>
        <button className="secondary-action" type="button">
          Alterar fotografia
        </button>
      </div>

      <div className="mock-settings-layout">
        <nav className="mock-settings-nav" aria-label="Secções do perfil">
          {sections.map((item) => (
            <button
              className={section === item ? "is-active" : ""}
              type="button"
              key={item}
              onClick={() => setSection(item)}
            >
              {item}
              <ChevronRight size={16} />
            </button>
          ))}
        </nav>

        <section className="mock-surface mock-settings-content">
          <div className="mock-section-title">
            <div>
              <h2>{section}</h2>
              <p>Informação associada à tua conta Blueprint.</p>
            </div>
          </div>

          {section === "Dados pessoais" ? (
            <div className="mock-form-grid">
              <label className="mock-field">
                Nome completo
                <input defaultValue={profile.fullName} />
              </label>
              <label className="mock-field">
                Nome de apresentação
                <input defaultValue={profile.name} />
              </label>
              <label className="mock-field mock-field--wide">
                Email de acesso
                <input type="email" defaultValue={profile.email} />
                <small>A alteração deste email requer verificação.</small>
              </label>
              <label className="mock-field">
                Telefone
                <input defaultValue={profile.phone} />
              </label>
              <label className="mock-field">
                Website
                <input defaultValue={profile.website} />
              </label>
              <label className="mock-field mock-field--wide">
                Morada
                <input defaultValue={profile.address} />
              </label>
              <label className="mock-field">
                LinkedIn
                <input defaultValue={profile.linkedIn} />
              </label>
              <label className="mock-field">
                Instagram
                <input defaultValue={profile.instagram} />
              </label>
            </div>
          ) : section === "Segurança" ? (
            <div className="mock-security-list">
              <div>
                <span>
                  <KeyRound size={20} />
                </span>
                <div>
                  <strong>Palavra-passe</strong>
                  <small>Alterada há 3 meses</small>
                </div>
                <button className="secondary-action" type="button">
                  Alterar
                </button>
              </div>
              <div>
                <span>
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <strong>Autenticação multifator</strong>
                  <small>Protege a conta com um segundo fator</small>
                </div>
                <StatusPill tone="success">Ativa</StatusPill>
              </div>
              <div>
                <span>
                  <Globe2 size={20} />
                </span>
                <div>
                  <strong>Sessões ativas</strong>
                  <small>2 dispositivos com sessão iniciada</small>
                </div>
                <button className="secondary-action" type="button">
                  Gerir
                </button>
              </div>
            </div>
          ) : (
            <div className="mock-settings-placeholder">
              <UserRound size={28} />
              <h3>{section}</h3>
              <p>As opções desta área estão prontas para personalização.</p>
              <button className="secondary-action" type="button">
                Configurar
              </button>
            </div>
          )}

          <div className="mock-danger-zone">
            <div>
              <strong>Desativar conta</strong>
              <p>O acesso fica suspenso até um administrador reativar a conta.</p>
            </div>
            <button type="button">Desativar conta</button>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
