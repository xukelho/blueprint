import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import PortalShell from "../components/PortalShell";

type TabId = "users" | "architects" | "clients" | "companies";

type UserResponse = {
  id: number;
  roleId: number;
  role: string;
  username: string;
  createdAt: string;
  createdBy: number;
  updatedAt: string;
  updatedBy: number;
};

type ProfileResponse = {
  id: number;
  userId: number;
  displayName: string;
  fullName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
};

type UserForm = {
  username: string;
  roleId: number;
  password: string;
};

type ProfileForm = {
  username: string;
  password: string;
  displayName: string;
  fullName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
};

type FieldErrors = Record<string, string>;

type AdministrationData = {
  users: UserResponse[];
  architects: ProfileResponse[];
  clients: ProfileResponse[];
  companies: ProfileResponse[];
};

const roleIds = {
  administrator: 1,
  client: 2,
  company: 3,
  architect: 4,
} as const;

const roleLabels: Record<number, string> = {
  [roleIds.administrator]: "Administrador da plataforma",
  [roleIds.client]: "Cliente",
  [roleIds.company]: "Empresa",
  [roleIds.architect]: "Arquiteto",
};

const tabs: Array<{
  id: TabId;
  label: string;
  singular: string;
  icon: typeof ShieldCheck;
  roleId?: number;
}> = [
  { id: "users", label: "Utilizadores", singular: "utilizador", icon: ShieldCheck },
  { id: "architects", label: "Arquitetos", singular: "arquiteto", icon: UserRound, roleId: roleIds.architect },
  { id: "clients", label: "Clientes", singular: "cliente", icon: Users, roleId: roleIds.client },
  { id: "companies", label: "Empresas", singular: "empresa", icon: Building2, roleId: roleIds.company },
];

const emptyUserForm = (): UserForm => ({
  username: "",
  roleId: roleIds.administrator,
  password: "",
});

const emptyProfileForm = (): ProfileForm => ({
  username: "",
  password: "",
  displayName: "",
  fullName: "",
  nif: "",
  email: "",
  phoneNumber: "",
  address: "",
});

const emptyData: AdministrationData = {
  users: [],
  architects: [],
  clients: [],
  companies: [],
};

class AdministrationApiError extends Error {
  fieldErrors: FieldErrors;

  constructor(message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

async function administrationRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const hasJson = response.headers.get("content-type")?.includes("application/json");
  const body = hasJson ? await response.json() as Record<string, unknown> : null;

  if (!response.ok) {
    const problemErrors = body?.errors as Record<string, string[]> | undefined;
    const fieldErrors = Object.fromEntries(
      Object.entries(problemErrors ?? {}).map(([key, messages]) => [key, messages.join(" ")]),
    );
    const message =
      typeof body?.error === "string"
        ? body.error
        : response.status === 404
          ? "O registo já não existe."
          : response.status >= 500
            ? "O servidor não conseguiu concluir o pedido."
            : "Não foi possível concluir o pedido.";
    throw new AdministrationApiError(message, fieldErrors);
  }

  return body as T;
}

const jsonRequest = (method: "POST" | "PUT", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const normalizeUserForm = (form: UserForm) => JSON.stringify({
  username: form.username.trim(),
  roleId: form.roleId,
  password: form.password,
});

const normalizeProfileForm = (form: ProfileForm) => JSON.stringify({
  username: form.username.trim(),
  password: form.password,
  displayName: form.displayName.trim(),
  fullName: form.fullName.trim(),
  nif: form.nif.trim(),
  email: form.email.trim(),
  phoneNumber: form.phoneNumber.trim(),
  address: form.address.trim(),
});

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-PT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const validateRequired = (
  errors: FieldErrors,
  key: string,
  value: string,
  label: string,
  maximumLength: number,
) => {
  if (!value.trim()) errors[key] = `${label} é obrigatório.`;
  else if (value.length > maximumLength) errors[key] = `${label} não pode exceder ${maximumLength} caracteres.`;
};

export default function AdministrationPage() {
  const [data, setData] = useState<AdministrationData>(emptyData);
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [selectedIds, setSelectedIds] = useState<Record<TabId, number | null>>({
    users: null,
    architects: null,
    clients: null,
    companies: null,
  });
  const [creating, setCreating] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [baseline, setBaseline] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toast, setToast] = useState("");

  const activeDefinition = tabs.find((tab) => tab.id === activeTab)!;
  const activeItems = data[activeTab];
  const selectedId = selectedIds[activeTab];
  const selectedUser = activeTab === "users"
    ? data.users.find((candidate) => candidate.id === selectedId) ?? null
    : null;
  const selectedProfile = activeTab !== "users"
    ? data[activeTab].find((candidate) => candidate.id === selectedId) ?? null
    : null;
  const linkedUser = selectedProfile
    ? data.users.find((candidate) => candidate.id === selectedProfile.userId) ?? null
    : null;

  const currentSnapshot = activeTab === "users"
    ? normalizeUserForm(userForm)
    : normalizeProfileForm(profileForm);
  const dirty = creating || currentSnapshot !== baseline;

  const fetchAll = useCallback(async () => {
    const [users, architects, clients, companies] = await Promise.all([
      administrationRequest<UserResponse[]>("/api/admin/users"),
      administrationRequest<ProfileResponse[]>("/api/admin/architects"),
      administrationRequest<ProfileResponse[]>("/api/admin/clients"),
      administrationRequest<ProfileResponse[]>("/api/admin/companies"),
    ]);
    return { users, architects, clients, companies };
  }, []);

  const applyLoadedData = useCallback((
    nextData: AdministrationData,
    preferred?: { tab: TabId; id: number },
  ) => {
    setData(nextData);
    setSelectedIds((current) => {
      const next = { ...current };
      for (const tab of tabs) {
        const candidates = nextData[tab.id];
        const preferredId = preferred?.tab === tab.id ? preferred.id : current[tab.id];
        next[tab.id] = candidates.some((candidate) => candidate.id === preferredId)
          ? preferredId
          : candidates[0]?.id ?? null;
      }
      return next;
    });
  }, []);

  const reload = useCallback(async (preferred?: { tab: TabId; id: number }) => {
    const nextData = await fetchAll();
    applyLoadedData(nextData, preferred);
    return nextData;
  }, [applyLoadedData, fetchAll]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAll()
      .then((nextData) => {
        if (!cancelled) {
          applyLoadedData(nextData);
          setLoadError("");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar os dados de administração.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyLoadedData, fetchAll]);

  useEffect(() => {
    if (creating) return;

    setFieldErrors({});
    setFormError("");
    if (activeTab === "users") {
      const nextForm = selectedUser
        ? { username: selectedUser.username, roleId: selectedUser.roleId, password: "" }
        : emptyUserForm();
      setUserForm(nextForm);
      setBaseline(normalizeUserForm(nextForm));
    } else {
      const nextForm = selectedProfile
        ? {
          username: linkedUser?.username ?? "",
          password: "",
          displayName: selectedProfile.displayName,
          fullName: selectedProfile.fullName,
          nif: selectedProfile.nif,
          email: selectedProfile.email,
          phoneNumber: selectedProfile.phoneNumber,
          address: selectedProfile.address,
        }
        : emptyProfileForm();
      setProfileForm(nextForm);
      setBaseline(normalizeProfileForm(nextForm));
    }
  }, [activeTab, creating, linkedUser?.username, selectedProfile, selectedUser]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const preventAccidentalNavigation = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventAccidentalNavigation);
    return () => window.removeEventListener("beforeunload", preventAccidentalNavigation);
  }, [dirty]);

  const confirmDiscard = () =>
    !dirty || window.confirm("Existem alterações por guardar. Pretende descartá-las?");

  const changeTab = (tab: TabId) => {
    if (tab === activeTab || !confirmDiscard()) return;
    setCreating(false);
    setActiveTab(tab);
  };

  const selectItem = (id: number) => {
    if (id === selectedId && !creating) return;
    if (!confirmDiscard()) return;
    setCreating(false);
    setSelectedIds((current) => ({ ...current, [activeTab]: id }));
  };

  const beginCreate = () => {
    if (!confirmDiscard()) return;
    setCreating(true);
    setFieldErrors({});
    setFormError("");
    if (activeTab === "users") {
      const nextForm = emptyUserForm();
      setUserForm(nextForm);
      setBaseline(normalizeUserForm(nextForm));
    } else {
      const nextForm = emptyProfileForm();
      setProfileForm(nextForm);
      setBaseline(normalizeProfileForm(nextForm));
    }
  };

  const updateUserField = <K extends keyof UserForm>(key: K, value: UserForm[K]) => {
    setUserForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setFormError("");
  };

  const updateProfileField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setProfileForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setFormError("");
  };

  const validateUser = () => {
    const errors: FieldErrors = {};
    validateRequired(errors, "username", userForm.username, "Nome de utilizador", 256);
    if (creating) validateRequired(errors, "password", userForm.password, "Palavra-passe", 1024);
    else if (userForm.password.length > 1024) errors.password = "A palavra-passe não pode exceder 1024 caracteres.";
    if (!roleLabels[userForm.roleId]) errors.roleId = "Selecione um perfil válido.";
    return errors;
  };

  const validateProfile = () => {
    const errors: FieldErrors = {};
    if (creating) {
      validateRequired(errors, "username", profileForm.username, "Nome de utilizador", 256);
      validateRequired(errors, "password", profileForm.password, "Palavra-passe", 1024);
    }
    validateRequired(errors, "displayName", profileForm.displayName, "Nome de apresentação", 256);
    validateRequired(errors, "fullName", profileForm.fullName, "Nome completo", 512);
    validateRequired(errors, "nif", profileForm.nif, "NIF", 32);
    validateRequired(errors, "email", profileForm.email, "Email", 320);
    validateRequired(errors, "phoneNumber", profileForm.phoneNumber, "Telefone", 64);
    validateRequired(errors, "address", profileForm.address, "Morada", 1024);
    return errors;
  };

  const handleApiError = (error: unknown) => {
    if (error instanceof AdministrationApiError) {
      setFieldErrors(error.fieldErrors);
      setFormError(error.message);
    } else {
      setFormError("Não foi possível contactar o servidor. Tente novamente.");
    }
  };

  const saveUser = async () => {
    const errors = validateUser();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Corrija os campos assinalados.");
      return;
    }

    const body = {
      roleId: userForm.roleId,
      username: userForm.username.trim(),
      password: creating ? userForm.password : userForm.password || null,
    };
    const saved = creating
      ? await administrationRequest<UserResponse>("/api/admin/users", jsonRequest("POST", body))
      : await administrationRequest<UserResponse>(
        `/api/admin/users/${selectedUser!.id}`,
        jsonRequest("PUT", body),
      );
    await reload({ tab: "users", id: saved.id });
    setCreating(false);
    setToast(creating ? "Utilizador criado com sucesso." : "Utilizador atualizado com sucesso.");
  };

  const saveProfile = async () => {
    const errors = validateProfile();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Corrija os campos assinalados.");
      return;
    }

    const profileBody = {
      displayName: profileForm.displayName.trim(),
      fullName: profileForm.fullName.trim(),
      nif: profileForm.nif.trim(),
      email: profileForm.email.trim(),
      phoneNumber: profileForm.phoneNumber.trim(),
      address: profileForm.address.trim(),
    };

    if (!creating) {
      const saved = await administrationRequest<ProfileResponse>(
        `/api/admin/${activeTab}/${selectedProfile!.id}`,
        jsonRequest("PUT", profileBody),
      );
      await reload({ tab: activeTab, id: saved.id });
      setToast(`${activeDefinition.singular[0].toLocaleUpperCase("pt-PT")}${activeDefinition.singular.slice(1)} atualizado com sucesso.`);
      return;
    }

    let createdUser: UserResponse | null = null;
    try {
      createdUser = await administrationRequest<UserResponse>(
        "/api/admin/users",
        jsonRequest("POST", {
          roleId: activeDefinition.roleId,
          username: profileForm.username.trim(),
          password: profileForm.password,
        }),
      );
      const saved = await administrationRequest<ProfileResponse>(
        `/api/admin/${activeTab}`,
        jsonRequest("POST", { userId: createdUser.id, ...profileBody }),
      );
      await reload({ tab: activeTab, id: saved.id });
      setCreating(false);
      setToast(`${activeDefinition.singular[0].toLocaleUpperCase("pt-PT")}${activeDefinition.singular.slice(1)} criado com sucesso.`);
    } catch (error) {
      if (createdUser) {
        try {
          await administrationRequest<void>(`/api/admin/users/${createdUser.id}`, { method: "DELETE" });
        } catch {
          await reload().catch(() => undefined);
          throw new AdministrationApiError(
            "O perfil não foi criado e não foi possível remover a conta criada. Reveja o separador Utilizadores.",
          );
        }
      }
      throw error;
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError("");
    try {
      if (activeTab === "users") await saveUser();
      else await saveProfile();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = () => {
    if (!confirmDiscard()) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const userId = activeTab === "users" ? selectedUser?.id : selectedProfile?.userId;
    if (!userId) return;

    setSubmitting(true);
    setFormError("");
    try {
      await administrationRequest<void>(`/api/admin/users/${userId}`, { method: "DELETE" });
      setDeleteDialogOpen(false);
      await reload();
      setToast(`${activeDefinition.singular[0].toLocaleUpperCase("pt-PT")}${activeDefinition.singular.slice(1)} eliminado com sucesso.`);
    } catch (error) {
      setDeleteDialogOpen(false);
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldError = (key: string) =>
    fieldErrors[key] ? <span className="admin-field-error">{fieldErrors[key]}</span> : null;

  const listContent = useMemo(() => {
    if (activeItems.length === 0) {
      return (
        <div className="admin-master-empty">
          <Users size={22} aria-hidden="true" />
          <strong>Sem {activeDefinition.label.toLocaleLowerCase("pt-PT")}</strong>
          <span>Use o botão + para criar o primeiro registo.</span>
        </div>
      );
    }

    return activeItems.map((item) => {
      const isUser = activeTab === "users";
      const title = isUser ? (item as UserResponse).username : (item as ProfileResponse).displayName;
      const subtitle = isUser
        ? roleLabels[(item as UserResponse).roleId] ?? (item as UserResponse).role
        : (item as ProfileResponse).fullName;
      const selected = !creating && item.id === selectedId;
      return (
        <button
          className={`admin-record${selected ? " is-selected" : ""}`}
          type="button"
          key={item.id}
          aria-pressed={selected}
          onClick={() => selectItem(item.id)}
        >
          <span className="admin-record__avatar">{title.slice(0, 2).toLocaleUpperCase("pt-PT")}</span>
          <span className="admin-record__copy">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </button>
      );
    });
  }, [activeDefinition.label, activeItems, activeTab, creating, selectedId]);

  return (
    <PortalShell wide>
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Gestão do portal</p>
          <h1>Administração</h1>
          <p>Gere utilizadores e os respetivos perfis de acesso ao Blueprint.</p>
        </div>
      </header>

      <section className="admin-crud" aria-label="Gestão de entidades">
        <div className="admin-tabs" role="tablist" aria-label="Entidades">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.id === activeTab;
            return (
              <button
                type="button"
                role="tab"
                id={`admin-tab-${tab.id}`}
                aria-controls={`admin-panel-${tab.id}`}
                aria-selected={selected}
                className={selected ? "is-active" : ""}
                key={tab.id}
                onClick={() => changeTab(tab.id)}
              >
                <Icon size={17} aria-hidden="true" />
                {tab.label}
                <span>{data[tab.id].length}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="admin-loading" role="status">A carregar dados de administração…</div>
        ) : loadError ? (
          <div className="admin-load-error" role="alert">
            <strong>{loadError}</strong>
            <button type="button" className="secondary-action" onClick={() => window.location.reload()}>Tentar novamente</button>
          </div>
        ) : (
          <div
            className="admin-workspace"
            id={`admin-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`admin-tab-${activeTab}`}
          >
            <aside className="admin-master" aria-label={`Lista de ${activeDefinition.label.toLocaleLowerCase("pt-PT")}`}>
              <header>
                <strong>{activeDefinition.label}</strong>
                <span>{activeItems.length} {activeItems.length === 1 ? "registo" : "registos"}</span>
              </header>
              <div className="admin-records">{listContent}</div>
            </aside>

            <section className="admin-detail">
              <header className="admin-detail__header">
                <div>
                  <p>{creating ? "Novo registo" : "Detalhe"}</p>
                  <h2>
                    {creating
                      ? `Criar ${activeDefinition.singular}`
                      : activeTab === "users"
                        ? selectedUser?.username ?? "Sem seleção"
                        : selectedProfile?.displayName ?? "Sem seleção"}
                  </h2>
                </div>
                <button
                  className="admin-add"
                  type="button"
                  aria-label={`Criar ${activeDefinition.singular}`}
                  title={`Criar ${activeDefinition.singular}`}
                  onClick={beginCreate}
                >
                  <Plus size={20} aria-hidden="true" />
                </button>
              </header>

              {!creating && !selectedId ? (
                <div className="admin-detail-empty">
                  <UserRound size={26} aria-hidden="true" />
                  <strong>Selecione um registo</strong>
                  <span>Escolha um item da lista ou use o botão + para criar.</span>
                </div>
              ) : (
                <form className="admin-form" onSubmit={save} noValidate>
                  <div className="admin-form__body">
                    {formError && <div className="admin-form-error" role="alert">{formError}</div>}

                    {activeTab === "users" ? (
                      <>
                        <div className="admin-form-grid">
                          <label>
                            Nome de utilizador
                            <input
                              autoFocus={creating}
                              value={userForm.username}
                              maxLength={256}
                              aria-invalid={Boolean(fieldErrors.username)}
                              onChange={(event) => updateUserField("username", event.target.value)}
                            />
                            {fieldError("username")}
                          </label>
                          <label>
                            Perfil
                            <select
                              value={userForm.roleId}
                              aria-invalid={Boolean(fieldErrors.roleId)}
                              onChange={(event) => updateUserField("roleId", Number(event.target.value))}
                            >
                              {Object.entries(roleLabels).map(([id, label]) => (
                                <option value={id} key={id}>{label}</option>
                              ))}
                            </select>
                            {fieldError("roleId")}
                          </label>
                          <label className="admin-form-grid__wide">
                            Palavra-passe {creating ? "" : "(deixar em branco para manter)"}
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={userForm.password}
                              maxLength={1024}
                              aria-invalid={Boolean(fieldErrors.password)}
                              onChange={(event) => updateUserField("password", event.target.value)}
                            />
                            {fieldError("password")}
                          </label>
                        </div>

                        {selectedUser && !creating && (
                          <dl className="admin-audit">
                            <div><dt>Criado em</dt><dd>{formatDate(selectedUser.createdAt)}</dd></div>
                            <div><dt>Criado por</dt><dd>#{selectedUser.createdBy}</dd></div>
                            <div><dt>Atualizado em</dt><dd>{formatDate(selectedUser.updatedAt)}</dd></div>
                            <div><dt>Atualizado por</dt><dd>#{selectedUser.updatedBy}</dd></div>
                          </dl>
                        )}
                      </>
                    ) : (
                      <>
                        {creating ? (
                          <fieldset className="admin-credentials">
                            <legend>Conta de acesso</legend>
                            <div className="admin-form-grid">
                              <label>
                                Nome de utilizador
                                <input
                                  autoFocus
                                  value={profileForm.username}
                                  maxLength={256}
                                  aria-invalid={Boolean(fieldErrors.username)}
                                  onChange={(event) => updateProfileField("username", event.target.value)}
                                />
                                {fieldError("username")}
                              </label>
                              <label>
                                Palavra-passe
                                <input
                                  type="password"
                                  autoComplete="new-password"
                                  value={profileForm.password}
                                  maxLength={1024}
                                  aria-invalid={Boolean(fieldErrors.password)}
                                  onChange={(event) => updateProfileField("password", event.target.value)}
                                />
                                {fieldError("password")}
                              </label>
                            </div>
                          </fieldset>
                        ) : (
                          <div className="admin-linked-user">
                            <span>Conta associada</span>
                            <strong>{linkedUser?.username ?? `Utilizador #${selectedProfile?.userId}`}</strong>
                            <small>{roleLabels[activeDefinition.roleId!]}</small>
                          </div>
                        )}

                        <fieldset className="admin-profile-fields">
                          <legend>Informação do perfil</legend>
                          <div className="admin-form-grid">
                            <label>
                              Nome de apresentação
                              <input
                                value={profileForm.displayName}
                                maxLength={256}
                                aria-invalid={Boolean(fieldErrors.displayName)}
                                onChange={(event) => updateProfileField("displayName", event.target.value)}
                              />
                              {fieldError("displayName")}
                            </label>
                            <label>
                              Nome completo
                              <input
                                value={profileForm.fullName}
                                maxLength={512}
                                aria-invalid={Boolean(fieldErrors.fullName)}
                                onChange={(event) => updateProfileField("fullName", event.target.value)}
                              />
                              {fieldError("fullName")}
                            </label>
                            <label>
                              NIF
                              <input
                                value={profileForm.nif}
                                maxLength={32}
                                aria-invalid={Boolean(fieldErrors.nif)}
                                onChange={(event) => updateProfileField("nif", event.target.value)}
                              />
                              {fieldError("nif")}
                            </label>
                            <label>
                              Email
                              <input
                                type="email"
                                value={profileForm.email}
                                maxLength={320}
                                aria-invalid={Boolean(fieldErrors.email)}
                                onChange={(event) => updateProfileField("email", event.target.value)}
                              />
                              {fieldError("email")}
                            </label>
                            <label>
                              Telefone
                              <input
                                type="tel"
                                value={profileForm.phoneNumber}
                                maxLength={64}
                                aria-invalid={Boolean(fieldErrors.phoneNumber)}
                                onChange={(event) => updateProfileField("phoneNumber", event.target.value)}
                              />
                              {fieldError("phoneNumber")}
                            </label>
                            <label className="admin-form-grid__wide">
                              Morada
                              <textarea
                                value={profileForm.address}
                                maxLength={1024}
                                aria-invalid={Boolean(fieldErrors.address)}
                                onChange={(event) => updateProfileField("address", event.target.value)}
                              />
                              {fieldError("address")}
                            </label>
                          </div>
                        </fieldset>
                      </>
                    )}
                  </div>

                  <footer className="admin-form__footer">
                    {!creating && (
                      <button
                        className="admin-delete"
                        type="button"
                        disabled={submitting}
                        onClick={requestDelete}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                        Eliminar
                      </button>
                    )}
                    <button className="primary-action" type="submit" disabled={submitting || (!creating && !dirty)}>
                      {submitting ? "A guardar…" : "Guardar"}
                    </button>
                  </footer>
                </form>
              )}
            </section>
          </div>
        )}
      </section>

      {deleteDialogOpen && (
        <div className="admin-dialog-backdrop" role="presentation">
          <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <header>
              <span><Trash2 size={20} aria-hidden="true" /></span>
              <div>
                <h2 id="delete-title">Eliminar {activeDefinition.singular}?</h2>
                <p>
                  {activeTab === "users"
                    ? "O utilizador e qualquer perfil associado serão eliminados permanentemente."
                    : "O perfil e a respetiva conta de acesso serão eliminados permanentemente."}
                </p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setDeleteDialogOpen(false)}>
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <footer>
              <button className="secondary-action" type="button" onClick={() => setDeleteDialogOpen(false)}>Cancelar</button>
              <button className="admin-delete admin-delete--solid" type="button" onClick={confirmDelete}>Eliminar</button>
            </footer>
          </section>
        </div>
      )}

      {toast && <div className="admin-toast" role="status"><Check size={17} aria-hidden="true" />{toast}</div>}
    </PortalShell>
  );
}
