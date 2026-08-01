import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  Link2,
  Settings,
  Users,
} from "lucide-react";
import {
  CompanyApiError,
  loadCurrentCompany,
  saveCurrentCompany,
  UpdateCurrentCompany,
} from "../api/company";
import PortalShell from "../components/PortalShell";
import MembersSettings from "../components/MembersSettings";

function PageHeader({
  eyebrow,
  title,
  description,
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
    </header>
  );
}

const settingsNav = [
  { label: "Atelier", icon: Building2 },
  { label: "Membros e permissões", icon: Users },
  { label: "Faturação e subscrição", icon: CreditCard },
  { label: "Integrações", icon: Link2 },
];

const emptyForm: UpdateCurrentCompany = {
  name: "",
  legalName: "",
  nif: "",
  email: "",
  phoneNumber: "",
  address: "",
  website: "",
};

export default function CompanySettingsPage() {
  const [section, setSection] = useState("Atelier");
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const company = await loadCurrentCompany();
        if (!active) return;
        setForm({
          name: company.name,
          legalName: company.legalName,
          nif: company.nif,
          email: company.email,
          phoneNumber: company.phoneNumber,
          address: company.address,
          website: company.website ?? "",
        });
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error
            ? caught.message
            : "Não foi possível carregar o atelier.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const setField = (field: keyof UpdateCurrentCompany, value: string) => {
    setSaved(false);
    setFieldErrors((current) => ({ ...current, [field]: "" }));
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaved(false);
    setError("");
    setFieldErrors({});
    try {
      const company = await saveCurrentCompany(form);
      setForm({
        name: company.name,
        legalName: company.legalName,
        nif: company.nif,
        email: company.email,
        phoneNumber: company.phoneNumber,
        address: company.address,
        website: company.website ?? "",
      });
      setSaved(true);
    } catch (caught) {
      if (caught instanceof CompanyApiError) {
        setError(caught.message);
        setFieldErrors(caught.fieldErrors);
      } else {
        setError("Não foi possível guardar o atelier.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const field = (
    name: keyof UpdateCurrentCompany,
    label: string,
    options?: { wide?: boolean; type?: string; textarea?: boolean },
  ) => (
    <label className={`mock-field${options?.wide ? " mock-field--wide" : ""}`}>
      {label}
      {options?.textarea ? (
        <textarea
          value={form[name]}
          onChange={(event) => setField(name, event.target.value)}
          aria-invalid={Boolean(fieldErrors[name])}
        />
      ) : (
        <input
          type={options?.type ?? "text"}
          value={form[name]}
          onChange={(event) => setField(name, event.target.value)}
          aria-invalid={Boolean(fieldErrors[name])}
        />
      )}
      {fieldErrors[name] && <span className="admin-field-error">{fieldErrors[name]}</span>}
    </label>
  );

  return (
    <PortalShell>
      <PageHeader
        eyebrow="Administração"
        title="Definições"
        description="Gere o atelier, a subscrição e as regras de acesso."
      />
      <div className="mock-settings-layout">
        <nav className="mock-settings-nav" aria-label="Secções de definições">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={section === item.label ? "is-active" : ""}
                type="button"
                key={item.label}
                onClick={() => setSection(item.label)}
              >
                <Icon size={18} />
                {item.label}
                {(item.icon === CreditCard || item.icon === Link2) && <span className="nav-status nav-status--mock">Mock</span>}
                <ChevronRight size={16} />
              </button>
            );
          })}
        </nav>
        <section className="mock-surface mock-settings-content">
          <div className="mock-section-title">
            <div>
              <h2>{section}</h2>
              <p>
                {section === "Atelier"
                  ? "Informação visível nos projetos e comunicações do atelier."
                  : `Configura as opções de ${section.toLocaleLowerCase("pt-PT")}.`}
              </p>
            </div>
          </div>
          {section === settingsNav[1].label ? <MembersSettings /> : section === "Atelier" ? (
            isLoading ? (
              <div className="mock-settings-placeholder" role="status">
                <Building2 size={28} />
                <h3>A carregar atelier…</h3>
              </div>
            ) : (
              <form id="company-settings-form" onSubmit={save}>
                {error && <div className="admin-form-error" role="alert">{error}</div>}
                <div className="mock-form-grid">
                  {field("name", "Nome do atelier", { wide: true })}
                  {field("legalName", "Nome legal", { wide: true })}
                  {field("email", "Email geral", { type: "email" })}
                  {field("phoneNumber", "Telefone")}
                  {field("address", "Morada", { wide: true, textarea: true })}
                  {field("nif", "NIF")}
                  {field("website", "Website")}
                </div>
                <div className="mock-form-actions">
                  <button
                    className="primary-action"
                    type="submit"
                    disabled={isSaving}
                  >
                    {saved ? (
                      <><Check size={17} />Alterações guardadas</>
                    ) : isSaving ? (
                      "A guardar…"
                    ) : (
                      "Guardar alterações"
                    )}
                  </button>
                </div>
              </form>
            )
          ) : (
            <div className="mock-settings-placeholder">
              <Settings size={28} />
              <h3>{section}</h3>
              <p>As opções desta área foram organizadas para manter cada decisão clara e contextual.</p>
              <button className="secondary-action" type="button">Configurar</button>
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
