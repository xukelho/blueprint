import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Globe2,
  KeyRound,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ProfileType, UpdateCurrentProfile } from "../api/profile";
import { changeCurrentPassword } from "../api/profile";
import PortalShell from "../components/PortalShell";
import {
  profileInitials,
  profileRoleLabel,
  useProfile,
} from "../profile/ProfileContext";

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

type ProfileForm = UpdateCurrentProfile & {
  website: string;
  linkedIn: string;
  instagram: string;
};

const emptyForm: ProfileForm = {
  username: "",
  displayName: "",
  fullName: "",
  nif: "",
  email: "",
  phoneNumber: "",
  address: "",
  companyId: null,
  isArchitect: false,
  website: "",
  linkedIn: "",
  instagram: "",
};

export default function UserPage({
  expectedProfileType,
  roleLabel,
  simplifiedNavigation = false,
  simplifiedPersonalData = false,
  simplifiedSecurity = false,
  securityOnlyDeactivation = false,
}: {
  expectedProfileType: ProfileType;
  roleLabel: string;
  simplifiedNavigation?: boolean;
  simplifiedPersonalData?: boolean;
  simplifiedSecurity?: boolean;
  securityOnlyDeactivation?: boolean;
}) {
  const { profile, isLoading, error, fieldErrors, updateProfile } = useProfile();
  const [section, setSection] = useState("Dados pessoais");
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const sections = [
    "Dados pessoais",
    "Contactos",
    "Segurança",
    ...(!simplifiedNavigation ? ["Notificações", "Dados financeiros"] : []),
  ];

  useEffect(() => {
    if (!profile) return;
    setForm((current) => ({
      ...current,
      username: profile.username,
      displayName: profile.displayName,
      fullName: profile.fullName,
      nif: profile.nif,
      email: profile.email,
      phoneNumber: profile.phoneNumber,
      address: profile.address,
      companyId: profile.companyId,
      isArchitect: profile.isArchitect ?? false,
    }));
  }, [profile]);

  const setField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaved(false);
    try {
      await updateProfile({
        username: form.username,
        displayName: form.displayName,
        fullName: form.fullName,
        nif: form.nif,
        email: form.email,
        phoneNumber: form.phoneNumber,
        address: form.address,
        companyId: form.companyId,
        isArchitect: expectedProfileType === "employee" && form.isArchitect,
      });
      setSaved(true);
    } catch {
      // The shared profile state exposes the actionable error and field messages.
    } finally {
      setIsSaving(false);
    }
  };

  const header = (
    <PageHeader
      eyebrow="Conta"
      title={`Perfil de ${roleLabel.toLocaleLowerCase("pt-PT")}`}
      description="Gere os teus dados pessoais, segurança e preferências."
      actions={
        <button
          className="primary-action"
          type="submit"
          form="profile-form"
          disabled={isLoading || !profile || isSaving}
        >
          {saved ? (
            <>
              <Check size={17} />
              Guardado
            </>
          ) : isSaving ? (
            "A guardar…"
          ) : (
            "Guardar alterações"
          )}
        </button>
      }
    />
  );

  const changePassword = async () => {
    const currentPassword = window.prompt("Palavra-passe atual");
    const newPassword = window.prompt("Nova palavra-passe");
    if (!currentPassword || !newPassword) return;
    try { await changeCurrentPassword(currentPassword, newPassword); setSaved(true); }
    catch { /* Profile error state remains the source for profile edits. */ }
  };

  if (isLoading && !profile) {
    return (
      <PortalShell>
        {header}
        <section className="mock-surface mock-settings-placeholder" role="status">
          <UserRound size={28} />
          <h3>A carregar perfil…</h3>
        </section>
      </PortalShell>
    );
  }

  if (!profile || profile.profileType !== expectedProfileType) {
    return (
      <PortalShell>
        {header}
        <section className="mock-surface mock-settings-placeholder" role="alert">
          <UserRound size={28} />
          <h3>Perfil indisponível</h3>
          <p>{error || "Esta conta não tem acesso a este tipo de perfil."}</p>
        </section>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      {header}

      <div className="mock-profile-hero mock-surface">
        <span className="mock-profile-avatar">
          {profileInitials(profile.displayName)}
        </span>
        <div>
          <h2>{profile.displayName}</h2>
          <p>
            {profileRoleLabel(profile)}
            {profile.profileType === "employee" && <> {" · "} {profile.companyName ?? "Independente"}</>}
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

          <form id="profile-form" onSubmit={save} noValidate>
            {section === "Dados pessoais" ? (
              <div className="mock-form-grid">
                <ProfileField label="Nome de utilizador" error={fieldErrors.username}>
                  <input
                    value={form.username}
                    maxLength={256}
                    onChange={(event) => setField("username", event.target.value)}
                  />
                </ProfileField>
                {/* NIF is obsolete for employee profiles. */}
                {!simplifiedPersonalData && (
                  <ProfileField label="NIF" error={fieldErrors.nif}>
                    <input
                      value={form.nif}
                      maxLength={32}
                      onChange={(event) => setField("nif", event.target.value)}
                    />
                  </ProfileField>
                )}
                <ProfileField label="Nome completo" error={fieldErrors.fullName}>
                  <input
                    value={form.fullName}
                    maxLength={512}
                    onChange={(event) => setField("fullName", event.target.value)}
                  />
                </ProfileField>
                <ProfileField
                  label="Nome de apresentação"
                  error={fieldErrors.displayName}
                >
                  <input
                    value={form.displayName}
                    maxLength={256}
                    onChange={(event) => setField("displayName", event.target.value)}
                  />
                </ProfileField>
                {expectedProfileType === "employee" ? (
                  <ProfileField label="Empresa" wide error={fieldErrors.companyId}>
                    <select
                      value={form.companyId ?? ""}
                      onChange={(event) => setField("companyId", event.target.value ? Number(event.target.value) : null)}
                    >
                      {profile.availableCompanies.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}
                    </select>
                  </ProfileField>
                ) : (
                  <div className="mock-field mock-field--wide client-associated-companies">
                    <span>Empresas associadas</span>
                    {profile.availableCompanies.length > 0
                      ? <ul>{profile.availableCompanies.map((company) => <li key={company.id}>{company.name}</li>)}</ul>
                      : <p>Sem empresas associadas.</p>}
                  </div>
                )}
                {expectedProfileType === "employee" && (
                  <label className="mock-profile-check mock-field--wide">
                    <input
                      type="checkbox"
                      checked={form.isArchitect}
                      onChange={(event) => setField("isArchitect", event.target.checked)}
                    />
                    <span>
                      <strong>Arquiteta</strong>
                      <small>Adicionar a função opcional de arquiteta a esta conta.</small>
                    </span>
                  </label>
                )}
              </div>
            ) : section === "Contactos" ? (
              <div className="mock-form-grid">
                <ProfileField label="Email" error={fieldErrors.email}>
                  <input
                    type="email"
                    value={form.email}
                    maxLength={320}
                    onChange={(event) => setField("email", event.target.value)}
                  />
                </ProfileField>
                <ProfileField label="Telefone" error={fieldErrors.phoneNumber}>
                  <input
                    value={form.phoneNumber}
                    maxLength={64}
                    onChange={(event) => setField("phoneNumber", event.target.value)}
                  />
                </ProfileField>
                <ProfileField label="Morada" wide error={fieldErrors.address}>
                  <input
                    value={form.address}
                    maxLength={1024}
                    onChange={(event) => setField("address", event.target.value)}
                  />
                </ProfileField>
                <ProfileField label="Website">
                  <input
                    value={form.website}
                    onChange={(event) => setField("website", event.target.value)}
                  />
                </ProfileField>
                <ProfileField label="LinkedIn">
                  <input
                    value={form.linkedIn}
                    onChange={(event) => setField("linkedIn", event.target.value)}
                  />
                </ProfileField>
                <ProfileField label="Instagram">
                  <input
                    value={form.instagram}
                    onChange={(event) => setField("instagram", event.target.value)}
                  />
                </ProfileField>
              </div>
            ) : section === "Segurança" ? (
              <div className="mock-security-list">
                <div>
                  <span><KeyRound size={20} /></span>
                  <div>
                    <strong>Palavra-passe</strong>
                    <small>Alterada há 3 meses</small>
                  </div>
                      <button className="secondary-action" type="button" onClick={() => void changePassword()}>Alterar</button>
                </div>
                {!simplifiedSecurity && (
                  <>
                    <div>
                      <span><ShieldCheck size={20} /></span>
                      <div>
                        <strong>Autenticação multifator</strong>
                        <small>Protege a conta com um segundo fator</small>
                      </div>
                      <StatusPill tone="success">Ativa</StatusPill>
                    </div>
                    <div>
                      <span><Globe2 size={20} /></span>
                      <div>
                        <strong>Sessões ativas</strong>
                        <small>2 dispositivos com sessão iniciada</small>
                      </div>
                      <button className="secondary-action" type="button">Gerir</button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="mock-settings-placeholder">
                <UserRound size={28} />
                <h3>{section}</h3>
                <p>As opções desta área estão prontas para personalização.</p>
                <button className="secondary-action" type="button">Configurar</button>
              </div>
            )}
          </form>

          {error && <p className="profile-form-error" role="alert">{error}</p>}

          {(!securityOnlyDeactivation || section === "Segurança") && (
            <div className="mock-danger-zone">
              <div>
                <strong>Desativar conta</strong>
                <p>O acesso fica suspenso até um administrador reativar a conta.</p>
              </div>
              <button type="button">Desativar conta</button>
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

function ProfileField({
  label,
  error,
  wide = false,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`mock-field ${wide ? "mock-field--wide" : ""}`}>
      {label}
      {children}
      {error && <small className="admin-field-error">{error}</small>}
    </label>
  );
}
