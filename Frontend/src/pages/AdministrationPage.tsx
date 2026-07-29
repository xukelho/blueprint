import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Plus, ShieldCheck, Trash2, UserRound, Users, X } from "lucide-react";
import {
  AdministrationApiError,
  administrationRequest,
  jsonRequest,
  loadAdministrationData,
  type AdministrationData,
  type ClientResponse,
  type CompanyResponse,
  type EmployeeResponse,
  type FieldErrors,
  type UserResponse,
} from "../api/administration";
import {
  ClientForm,
  CompanyForm,
  EmployeeForm,
  UserForm,
  type CompanyFormValue,
  type ProfileFormValue,
  type UserFormValue,
} from "../components/administration/AdminForms";
import PortalShell from "../components/PortalShell";

type TabId = "users" | "employees" | "clients" | "companies";
type Entity = UserResponse | EmployeeResponse | ClientResponse | CompanyResponse;

const tabs = [
  { id: "users", label: "Utilizadores", singular: "utilizador", icon: ShieldCheck },
  { id: "employees", label: "Colaboradores", singular: "colaborador", icon: UserRound },
  { id: "clients", label: "Clientes", singular: "cliente", icon: Users },
  { id: "companies", label: "Empresas", singular: "empresa", icon: Building2 },
] satisfies Array<{ id: TabId; label: string; singular: string; icon: typeof ShieldCheck }>;

const emptyData: AdministrationData = { roles: [], users: [], employees: [], clients: [], companies: [] };
const emptyUser = (): UserFormValue => ({ username: "", password: "", roleIds: [] });
const emptyProfile = (): ProfileFormValue => ({
  username: "", password: "", companyId: null, architect: false,
  displayName: "", fullName: "", nif: "", email: "", phoneNumber: "", address: "",
});
const emptyCompany = (): CompanyFormValue => ({
  name: "", legalName: "", nif: "", email: "", phoneNumber: "", address: "",
});
const normalize = (value: object) => JSON.stringify(value);
const titleCase = (value: string) => value.charAt(0).toLocaleUpperCase("pt-PT") + value.slice(1);

function validateRequired(errors: FieldErrors, key: string, value: string, label: string, max: number) {
  if (!value.trim()) errors[key] = `${label} é obrigatório.`;
  else if (value.length > max) errors[key] = `${label} não pode exceder ${max} caracteres.`;
}

function validateContact(value: ProfileFormValue, creating: boolean) {
  const errors: FieldErrors = {};
  if (creating) {
    validateRequired(errors, "username", value.username, "Nome de utilizador", 256);
    validateRequired(errors, "password", value.password, "Palavra-passe", 1024);
  }
  validateRequired(errors, "displayName", value.displayName, "Nome de apresentação", 256);
  validateRequired(errors, "fullName", value.fullName, "Nome completo", 512);
  validateRequired(errors, "nif", value.nif, "NIF", 32);
  validateRequired(errors, "email", value.email, "Email", 320);
  validateRequired(errors, "phoneNumber", value.phoneNumber, "Telefone", 64);
  validateRequired(errors, "address", value.address, "Morada", 1024);
  return errors;
}

function validateCompany(value: CompanyFormValue) {
  const errors: FieldErrors = {};
  validateRequired(errors, "name", value.name, "Nome", 256);
  validateRequired(errors, "legalName", value.legalName, "Nome legal", 512);
  validateRequired(errors, "nif", value.nif, "NIF", 32);
  validateRequired(errors, "email", value.email, "Email", 320);
  validateRequired(errors, "phoneNumber", value.phoneNumber, "Telefone", 64);
  validateRequired(errors, "address", value.address, "Morada", 1024);
  return errors;
}

export default function AdministrationPage() {
  const [data, setData] = useState(emptyData);
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [selectedIds, setSelectedIds] = useState<Record<TabId, number | null>>({
    users: null, employees: null, clients: null, companies: null,
  });
  const [creating, setCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [userForm, setUserForm] = useState(emptyUser);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [baseline, setBaseline] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toast, setToast] = useState("");

  const definition = tabs.find((tab) => tab.id === activeTab)!;
  const selectedId = selectedIds[activeTab];
  const selectedUser = activeTab === "users" ? data.users.find((item) => item.id === selectedId) ?? null : null;
  const selectedEmployee = activeTab === "employees" ? data.employees.find((item) => item.id === selectedId) ?? null : null;
  const selectedClient = activeTab === "clients" ? data.clients.find((item) => item.id === selectedId) ?? null : null;
  const selectedCompany = activeTab === "companies" ? data.companies.find((item) => item.id === selectedId) ?? null : null;
  const selectedProfile = selectedEmployee ?? selectedClient;
  const linkedUser = selectedProfile ? data.users.find((item) => item.id === selectedProfile.userId) ?? null : null;
  const displayedCompanies = showInactive ? data.companies : data.companies.filter((company) => company.isActive);
  const activeItems: Entity[] = activeTab === "companies" ? displayedCompanies : data[activeTab];
  const currentSnapshot = activeTab === "users"
    ? normalize(userForm)
    : activeTab === "companies"
      ? normalize(companyForm)
      : normalize(profileForm);
  const dirty = currentSnapshot !== baseline;
  const readOnly = !creating && activeTab === "companies" && Boolean(selectedCompany && !selectedCompany.isActive);

  const applyLoadedData = useCallback((next: AdministrationData, preferred?: { tab: TabId; id: number }) => {
    setData(next);
    setSelectedIds((current) => {
      const result = { ...current };
      for (const tab of tabs) {
        const values = next[tab.id];
        const wanted = preferred?.tab === tab.id ? preferred.id : current[tab.id];
        const available = tab.id === "companies"
          ? (values as CompanyResponse[]).filter((item) => item.isActive)
          : values;
        result[tab.id] = values.some((item) => item.id === wanted) ? wanted : available[0]?.id ?? values[0]?.id ?? null;
      }
      return result;
    });
  }, []);

  const reload = useCallback(async (preferred?: { tab: TabId; id: number }) => {
    const next = await loadAdministrationData();
    applyLoadedData(next, preferred);
    return next;
  }, [applyLoadedData]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadAdministrationData()
      .then((next) => {
        if (!cancelled) {
          applyLoadedData(next);
          setLoadError("");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Não foi possível carregar os dados de administração.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [applyLoadedData]);

  useEffect(() => {
    if (creating) return;
    setFieldErrors({});
    setFormError("");
    if (activeTab === "users") {
      const next = selectedUser
        ? { username: selectedUser.username, password: "", roleIds: selectedUser.roles.map((role) => role.id) }
        : emptyUser();
      setUserForm(next);
      setBaseline(normalize(next));
    } else if (activeTab === "companies") {
      const next = selectedCompany ? {
        name: selectedCompany.name, legalName: selectedCompany.legalName, nif: selectedCompany.nif,
        email: selectedCompany.email, phoneNumber: selectedCompany.phoneNumber, address: selectedCompany.address,
      } : emptyCompany();
      setCompanyForm(next);
      setBaseline(normalize(next));
    } else {
      const next = selectedProfile ? {
        username: "", password: "", companyId: selectedProfile.companyId, architect: false,
        displayName: selectedProfile.displayName, fullName: selectedProfile.fullName, nif: selectedProfile.nif,
        email: selectedProfile.email, phoneNumber: selectedProfile.phoneNumber, address: selectedProfile.address,
      } : emptyProfile();
      setProfileForm(next);
      setBaseline(normalize(next));
    }
  }, [activeTab, creating, selectedCompany, selectedProfile, selectedUser]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    if (showInactive || activeTab !== "companies" || !selectedCompany || selectedCompany.isActive) return;
    setSelectedIds((current) => ({
      ...current,
      companies: data.companies.find((company) => company.isActive)?.id ?? null,
    }));
  }, [activeTab, data.companies, selectedCompany, showInactive]);

  const confirmDiscard = () => !dirty || window.confirm("Existem alterações por guardar. Pretende descartá-las?");
  const changeTab = (tab: TabId) => {
    if (tab === activeTab || !confirmDiscard()) return;
    setCreating(false);
    setActiveTab(tab);
  };
  const selectItem = (id: number) => {
    if ((!creating && id === selectedId) || !confirmDiscard()) return;
    setCreating(false);
    setSelectedIds((current) => ({ ...current, [activeTab]: id }));
  };
  const beginCreate = () => {
    if (!confirmDiscard()) return;
    setCreating(true);
    setFieldErrors({});
    setFormError("");
    if (activeTab === "users") {
      const next = emptyUser(); setUserForm(next); setBaseline(normalize(next));
    } else if (activeTab === "companies") {
      const next = emptyCompany(); setCompanyForm(next); setBaseline(normalize(next));
    } else {
      const next = emptyProfile(); setProfileForm(next); setBaseline(normalize(next));
    }
  };
  const cancelCreate = () => {
    if (!confirmDiscard()) return;
    setCreating(false);
  };
  const updateUser = <K extends keyof UserFormValue>(key: K, value: UserFormValue[K]) => {
    setUserForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" })); setFormError("");
  };
  const updateProfile = <K extends keyof ProfileFormValue>(key: K, value: ProfileFormValue[K]) => {
    setProfileForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" })); setFormError("");
  };
  const updateCompany = <K extends keyof CompanyFormValue>(key: K, value: CompanyFormValue[K]) => {
    setCompanyForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" })); setFormError("");
  };

  const profileBody = () => ({
    companyId: profileForm.companyId,
    displayName: profileForm.displayName.trim(), fullName: profileForm.fullName.trim(),
    nif: profileForm.nif.trim(), email: profileForm.email.trim(),
    phoneNumber: profileForm.phoneNumber.trim(), address: profileForm.address.trim(),
  });

  const saveUser = async () => {
    const errors: FieldErrors = {};
    validateRequired(errors, "username", userForm.username, "Nome de utilizador", 256);
    if (creating) validateRequired(errors, "password", userForm.password, "Palavra-passe", 1024);
    else if (userForm.password.length > 1024) errors.password = "A palavra-passe não pode exceder 1024 caracteres.";
    if (!creating && userForm.roleIds.length === 0) errors.roleIds = "A conta deve manter os seus perfis.";
    if (Object.keys(errors).length) throw new AdministrationApiError("Corrija os campos assinalados.", errors);
    const body = creating
      ? { username: userForm.username.trim(), password: userForm.password }
      : { username: userForm.username.trim(), password: userForm.password || null, roleIds: userForm.roleIds };
    const saved = creating
      ? await administrationRequest<UserResponse>("/api/admin/users", jsonRequest("POST", body))
      : await administrationRequest<UserResponse>(`/api/admin/users/${selectedUser!.id}`, jsonRequest("PUT", body));
    await reload({ tab: "users", id: saved.id });
  };

  const saveEmployee = async () => {
    const errors = validateContact(profileForm, creating);
    if (!profileForm.companyId) errors.companyId = "Empresa é obrigatória.";
    const employeeRole = data.roles.find((role) => role.name === "employee");
    const architectRole = data.roles.find((role) => role.name === "architect");
    if (creating && (!employeeRole || (profileForm.architect && !architectRole))) {
      errors.roleIds = "O catálogo de perfis não contém os perfis necessários.";
    }
    if (Object.keys(errors).length) throw new AdministrationApiError("Corrija os campos assinalados.", errors);
    const body = profileBody();
    const saved = creating
      ? await administrationRequest<EmployeeResponse>("/api/admin/employees", jsonRequest("POST", {
        username: profileForm.username.trim(), password: profileForm.password,
        roleIds: [employeeRole!.id, ...(profileForm.architect ? [architectRole!.id] : [])], ...body,
      }))
      : await administrationRequest<EmployeeResponse>(`/api/admin/employees/${selectedEmployee!.id}`, jsonRequest("PUT", body));
    await reload({ tab: "employees", id: saved.id });
  };

  const saveClient = async () => {
    const errors = validateContact(profileForm, creating);
    if (Object.keys(errors).length) throw new AdministrationApiError("Corrija os campos assinalados.", errors);
    const body = profileBody();
    const saved = creating
      ? await administrationRequest<ClientResponse>("/api/admin/clients", jsonRequest("POST", {
        username: profileForm.username.trim(), password: profileForm.password, ...body,
      }))
      : await administrationRequest<ClientResponse>(`/api/admin/clients/${selectedClient!.id}`, jsonRequest("PUT", body));
    await reload({ tab: "clients", id: saved.id });
  };

  const saveCompany = async () => {
    const errors = validateCompany(companyForm);
    if (Object.keys(errors).length) throw new AdministrationApiError("Corrija os campos assinalados.", errors);
    const body = Object.fromEntries(Object.entries(companyForm).map(([key, value]) => [key, value.trim()]));
    const saved = creating
      ? await administrationRequest<CompanyResponse>("/api/admin/companies", jsonRequest("POST", body))
      : await administrationRequest<CompanyResponse>(`/api/admin/companies/${selectedCompany!.id}`, jsonRequest("PUT", body));
    await reload({ tab: "companies", id: saved.id });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    setSubmitting(true); setFieldErrors({}); setFormError("");
    try {
      if (activeTab === "users") await saveUser();
      else if (activeTab === "employees") await saveEmployee();
      else if (activeTab === "clients") await saveClient();
      else await saveCompany();
      setCreating(false);
      const feminine = activeTab === "companies";
      setToast(`${titleCase(definition.singular)} ${creating ? (feminine ? "criada" : "criado") : (feminine ? "atualizada" : "atualizado")} com sucesso.`);
    } catch (error) {
      if (error instanceof AdministrationApiError) {
        setFieldErrors(error.fieldErrors); setFormError(error.message);
      } else setFormError("Não foi possível contactar o servidor. Tente novamente.");
    } finally { setSubmitting(false); }
  };

  const confirmDelete = async () => {
    const path = activeTab === "users"
      ? `/api/admin/users/${selectedUser?.id}`
      : activeTab === "employees"
        ? `/api/admin/employees/${selectedEmployee?.id}`
        : activeTab === "clients"
          ? `/api/admin/clients/${selectedClient?.id}`
          : `/api/admin/companies/${selectedCompany?.id}`;
    setSubmitting(true); setFormError("");
    try {
      await administrationRequest<void>(path, { method: "DELETE" });
      setDeleteDialogOpen(false);
      await reload();
      setToast(activeTab === "companies" ? "Empresa desativada com sucesso." : `${titleCase(definition.singular)} eliminado com sucesso.`);
    } catch (error) {
      setDeleteDialogOpen(false);
      if (error instanceof AdministrationApiError) setFormError(error.message);
      else setFormError("Não foi possível contactar o servidor. Tente novamente.");
    } finally { setSubmitting(false); }
  };

  const listContent = useMemo(() => activeItems.length ? activeItems.map((item) => {
    const user = activeTab === "users" ? item as UserResponse : null;
    const company = activeTab === "companies" ? item as CompanyResponse : null;
    const profile = activeTab === "employees" || activeTab === "clients" ? item as EmployeeResponse | ClientResponse : null;
    const title = user?.username ?? company?.name ?? profile?.displayName ?? "";
    const subtitle = user
      ? user.roles.map((role) => role.name).join(", ")
      : company ? `${company.legalName}${company.isActive ? "" : " · Inativa"}` : profile!.fullName;
    const selected = !creating && item.id === selectedId;
    return (
      <button className={`admin-record${selected ? " is-selected" : ""}${company && !company.isActive ? " is-inactive" : ""}`} type="button" key={item.id} aria-pressed={selected} onClick={() => selectItem(item.id)}>
        <span className="admin-record__avatar">{title.slice(0, 2).toLocaleUpperCase("pt-PT")}</span>
        <span className="admin-record__copy"><strong>{title}</strong><small>{subtitle}</small></span>
      </button>
    );
  }) : (
    <div className="admin-master-empty"><Users size={22} /><strong>Sem {definition.label.toLocaleLowerCase("pt-PT")}</strong><span>Use o botão + para criar o primeiro registo.</span></div>
  ), [activeItems, activeTab, creating, definition.label, selectedId]);

  const hasSelection = creating || Boolean(selectedUser || selectedProfile || selectedCompany);
  const heading = creating ? `Novo ${definition.singular}` : selectedUser?.username ?? selectedProfile?.displayName ?? selectedCompany?.name ?? definition.label;

  return (
    <PortalShell wide>
      <header className="admin-header">
        <div><p className="admin-eyebrow">Gestão do portal</p><h1>Administração</h1><p>Gere utilizadores, colaboradores, clientes e empresas do Blueprint.</p></div>
      </header>
      <section className="admin-crud" aria-label="Gestão de entidades">
        <div className="admin-tabs" role="tablist" aria-label="Entidades">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button type="button" role="tab" aria-selected={tab.id === activeTab} className={tab.id === activeTab ? "is-active" : ""} key={tab.id} onClick={() => changeTab(tab.id)}>
                <Icon size={17} />{tab.label}<span>{tab.id === "companies" ? displayedCompanies.length : data[tab.id].length}</span>
              </button>
            );
          })}
        </div>
        {loading ? <div className="admin-loading">A carregar dados de administração…</div> : loadError ? (
          <div className="admin-load-error" role="alert"><strong>{loadError}</strong><button className="secondary-action" type="button" onClick={() => void reload()}>Tentar novamente</button></div>
        ) : (
          <>
            {activeTab === "companies" && (
              <label className="admin-filter"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Mostrar inativas</label>
            )}
            <div className="admin-workspace">
              <aside className="admin-master">
                <header><div><strong>{definition.label}</strong><span>{activeItems.length} registos</span></div><button className="admin-add" type="button" aria-label={`Criar ${definition.singular}`} onClick={beginCreate}><Plus size={17} /></button></header>
                <div className="admin-records">{listContent}</div>
              </aside>
              <section className="admin-detail">
                <header className="admin-detail__header"><div><p>{creating ? "Criação" : readOnly ? "Inativa · Apenas leitura" : "Detalhe"}</p><h2>{heading}</h2></div></header>
                {!hasSelection ? (
                  <div className="admin-detail-empty"><Users size={25} /><strong>Selecione um registo</strong><span>Escolha um item da lista ou crie um novo.</span></div>
                ) : (
                  <form className="admin-form" onSubmit={save} noValidate>
                    <div className="admin-form__body">
                      {formError && <div className="admin-form-error" role="alert">{formError}</div>}
                      {activeTab === "users" && <UserForm value={userForm} errors={fieldErrors} creating={creating} user={selectedUser} roleCatalogue={data.roles} onChange={updateUser} />}
                      {activeTab === "employees" && <EmployeeForm value={profileForm} errors={fieldErrors} creating={creating} employee={selectedEmployee} user={linkedUser} companies={data.companies} onChange={updateProfile} />}
                      {activeTab === "clients" && <ClientForm value={profileForm} errors={fieldErrors} creating={creating} client={selectedClient} user={linkedUser} companies={data.companies} onChange={updateProfile} />}
                      {activeTab === "companies" && <CompanyForm value={companyForm} errors={fieldErrors} disabled={readOnly} company={creating ? null : selectedCompany} onChange={updateCompany} />}
                    </div>
                    <footer className="admin-form__footer">
                      {!creating && !readOnly && (
                        <button className="admin-delete" type="button" onClick={() => confirmDiscard() && setDeleteDialogOpen(true)}>
                          <Trash2 size={15} />{activeTab === "companies" ? "Desativar" : "Eliminar"}
                        </button>
                      )}
                      {creating && <button className="secondary-action" type="button" onClick={cancelCreate}>Cancelar</button>}
                      {!readOnly && <button className="primary-action" type="submit" disabled={submitting}>{submitting ? "A guardar…" : "Guardar"}</button>}
                    </footer>
                  </form>
                )}
              </section>
            </div>
          </>
        )}
      </section>
      {deleteDialogOpen && (
        <div className="admin-dialog-backdrop">
          <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true">
            <header><span><Trash2 size={19} /></span><div><h2>{activeTab === "companies" ? "Desativar empresa?" : `Eliminar ${definition.singular}?`}</h2><p>{activeTab === "companies" ? "A empresa fica inativa. Os utilizadores associados mantêm o acesso e não existe uma ação de restauro nesta área." : activeTab === "employees" || activeTab === "clients" || (activeTab === "users" && (selectedUser?.roles.some((role) => role.name === "employee" || role.name === "client"))) ? "A conta e o respetivo perfil serão removidos definitivamente." : "Esta ação é permanente."}</p></div><button type="button" aria-label="Fechar" onClick={() => setDeleteDialogOpen(false)}><X size={18} /></button></header>
            <footer><button className="secondary-action" type="button" onClick={() => setDeleteDialogOpen(false)}>Cancelar</button><button className="admin-delete admin-delete--solid" type="button" disabled={submitting} onClick={() => void confirmDelete()}>{activeTab === "companies" ? "Desativar" : "Eliminar"}</button></footer>
          </section>
        </div>
      )}
      {toast && <div className="admin-toast" role="status"><Check size={16} />{toast}</div>}
    </PortalShell>
  );
}
