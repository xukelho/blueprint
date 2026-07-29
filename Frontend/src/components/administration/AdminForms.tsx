import type {
  ClientResponse,
  CompanyResponse,
  EmployeeResponse,
  FieldErrors,
  RoleResponse,
  UserResponse,
} from "../../api/administration";

export type ContactFormValue = {
  displayName: string;
  fullName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
};

export type UserFormValue = { username: string; password: string; roleIds: number[] };
export type ProfileFormValue = ContactFormValue & {
  username: string;
  password: string;
  companyId: number | null;
  architect: boolean;
};
export type CompanyFormValue = {
  name: string;
  legalName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
};

type CommonProps<T> = {
  value: T;
  errors: FieldErrors;
  disabled?: boolean;
  onChange: <K extends keyof T>(key: K, value: T[K]) => void;
};

const ErrorText = ({ errors, name }: { errors: FieldErrors; name: string }) =>
  errors[name] ? <span className="admin-field-error">{errors[name]}</span> : null;

const RoleBadges = ({ roles }: { roles: RoleResponse[] }) => (
  <span className="admin-role-badges">
    {roles.map((role) => <span className="admin-role-badge" key={role.id}>{role.name}</span>)}
  </span>
);

export function UserForm({
  value,
  errors,
  creating,
  user,
  roleCatalogue,
  onChange,
}: CommonProps<UserFormValue> & {
  creating: boolean;
  user: UserResponse | null;
  roleCatalogue: RoleResponse[];
}) {
  const employeeRole = roleCatalogue.find((role) => role.name === "employee");
  const architectRole = roleCatalogue.find((role) => role.name === "architect");
  const isEmployee = Boolean(employeeRole && value.roleIds.includes(employeeRole.id));
  const architectEnabled = Boolean(architectRole && value.roleIds.includes(architectRole.id));
  const toggleArchitect = (checked: boolean) => {
    if (!architectRole) return;
    onChange("roleIds", checked
      ? [...new Set([...value.roleIds, architectRole.id])]
      : value.roleIds.filter((id) => id !== architectRole.id));
  };

  return (
    <>
      <fieldset className="admin-credentials">
        <legend>Credenciais e permissões</legend>
        <div className="admin-form-grid">
          <label>
            Nome de utilizador
            <input value={value.username} disabled={false} onChange={(event) => onChange("username", event.target.value)} aria-invalid={Boolean(errors.username)} />
            <ErrorText errors={errors} name="username" />
          </label>
          <label>
            Palavra-passe{!creating && " (opcional)"}
            <input type="password" value={value.password} onChange={(event) => onChange("password", event.target.value)} aria-invalid={Boolean(errors.password)} />
            <ErrorText errors={errors} name="password" />
          </label>
        </div>
      </fieldset>
      <div className="admin-linked-user">
        <span>Perfis atribuídos</span>
        {creating ? (
          <strong>Administrador da plataforma</strong>
        ) : (
          <RoleBadges roles={user?.roles ?? []} />
        )}
        <small>
          {creating
            ? "Novos utilizadores criados aqui são administradores da plataforma."
            : "A categoria da conta é fixa. Colaboradores podem acumular a função de arquiteto."}
        </small>
      </div>
      {!creating && isEmployee && architectRole && (
        <label className="admin-check admin-form-grid__wide">
          <input type="checkbox" checked={architectEnabled} onChange={(event) => toggleArchitect(event.target.checked)} />
          Arquiteto/Arquiteta
        </label>
      )}
      <ErrorText errors={errors} name="roleIds" />
    </>
  );
}

function CompanySelect({
  companies,
  value,
  optional,
  errors,
  onChange,
}: {
  companies: CompanyResponse[];
  value: number | null;
  optional: boolean;
  errors: FieldErrors;
  onChange: (value: number | null) => void;
}) {
  const active = companies.filter((company) => company.isActive);
  const currentInactive = companies.find((company) => company.id === value && !company.isActive);
  return (
    <label className="admin-form-grid__wide">
      Empresa{optional ? " (opcional)" : ""}
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} aria-invalid={Boolean(errors.companyId)}>
        <option value="">{optional ? "Sem empresa" : "Selecione uma empresa"}</option>
        {currentInactive && <option value={currentInactive.id} disabled>{currentInactive.name} — Inativa (associação atual)</option>}
        {active.map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}
      </select>
      <ErrorText errors={errors} name="companyId" />
    </label>
  );
}

export function ContactFields({
  value,
  errors,
  onChange,
}: CommonProps<ContactFormValue>) {
  return (
    <fieldset className="admin-profile-fields">
      <legend>Dados de contacto e perfil</legend>
      <div className="admin-form-grid">
        {([
          ["displayName", "Nome de apresentação"],
          ["fullName", "Nome completo"],
          ["nif", "NIF"],
          ["email", "Email"],
          ["phoneNumber", "Telefone"],
        ] as const).map(([name, label]) => (
          <label key={name}>
            {label}
            <input type={name === "email" ? "email" : "text"} value={value[name]} onChange={(event) => onChange(name, event.target.value)} aria-invalid={Boolean(errors[name])} />
            <ErrorText errors={errors} name={name} />
          </label>
        ))}
        <label className="admin-form-grid__wide">
          Morada
          <textarea value={value.address} onChange={(event) => onChange("address", event.target.value)} aria-invalid={Boolean(errors.address)} />
          <ErrorText errors={errors} name="address" />
        </label>
      </div>
    </fieldset>
  );
}

function ProfileAccount({
  creating,
  value,
  errors,
  user,
  onChange,
}: CommonProps<ProfileFormValue> & { creating: boolean; user: UserResponse | null }) {
  if (!creating) {
    return (
      <div className="admin-linked-user">
        <span>Conta associada</span>
        <strong>{user?.username ?? "Utilizador indisponível"}</strong>
        <RoleBadges roles={user?.roles ?? []} />
        <small>O nome de utilizador e os perfis são geridos em Utilizadores.</small>
      </div>
    );
  }
  return (
    <fieldset className="admin-credentials">
      <legend>Credenciais</legend>
      <div className="admin-form-grid">
        <label>
          Nome de utilizador
          <input value={value.username} onChange={(event) => onChange("username", event.target.value)} aria-invalid={Boolean(errors.username)} />
          <ErrorText errors={errors} name="username" />
        </label>
        <label>
          Palavra-passe
          <input type="password" value={value.password} onChange={(event) => onChange("password", event.target.value)} aria-invalid={Boolean(errors.password)} />
          <ErrorText errors={errors} name="password" />
        </label>
      </div>
    </fieldset>
  );
}

export function EmployeeForm(props: CommonProps<ProfileFormValue> & {
  creating: boolean;
  employee: EmployeeResponse | null;
  user: UserResponse | null;
  companies: CompanyResponse[];
}) {
  const { value, errors, onChange, creating, user, companies } = props;
  return (
    <>
      <ProfileAccount {...props} />
      <div className="admin-form-grid">
        <CompanySelect companies={companies} value={value.companyId} optional={false} errors={errors} onChange={(companyId) => onChange("companyId", companyId)} />
        {creating && (
          <label className="admin-check admin-form-grid__wide">
            <input type="checkbox" checked={value.architect} onChange={(event) => onChange("architect", event.target.checked)} />
            Arquiteto/Arquiteta
          </label>
        )}
      </div>
      <ContactFields value={value} errors={errors} onChange={onChange} />
      {!creating && user && <small>Perfis da conta: {user.roles.map((role) => role.name).join(", ")}</small>}
    </>
  );
}

export function ClientForm(props: CommonProps<ProfileFormValue> & {
  creating: boolean;
  client: ClientResponse | null;
  user: UserResponse | null;
  companies: CompanyResponse[];
}) {
  const { value, errors, onChange, companies } = props;
  return (
    <>
      <ProfileAccount {...props} />
      <div className="admin-form-grid">
        <CompanySelect companies={companies} value={value.companyId} optional errors={errors} onChange={(companyId) => onChange("companyId", companyId)} />
      </div>
      <ContactFields value={value} errors={errors} onChange={onChange} />
    </>
  );
}

export function CompanyForm({
  value,
  errors,
  disabled,
  onChange,
  company,
}: CommonProps<CompanyFormValue> & { company: CompanyResponse | null }) {
  return (
    <>
      {disabled && <div className="admin-form-error">Empresa inativa — este registo é apenas de leitura.</div>}
      <fieldset className="admin-profile-fields" disabled={disabled}>
        <legend>Dados da empresa</legend>
        <div className="admin-form-grid">
          {([
            ["name", "Nome"],
            ["legalName", "Nome legal"],
            ["nif", "NIF"],
            ["email", "Email"],
            ["phoneNumber", "Telefone"],
          ] as const).map(([name, label]) => (
            <label key={name}>
              {label}
              <input type={name === "email" ? "email" : "text"} value={value[name]} onChange={(event) => onChange(name, event.target.value)} aria-invalid={Boolean(errors[name])} />
              <ErrorText errors={errors} name={name} />
            </label>
          ))}
          <label className="admin-form-grid__wide">
            Morada
            <textarea value={value.address} onChange={(event) => onChange("address", event.target.value)} aria-invalid={Boolean(errors.address)} />
            <ErrorText errors={errors} name="address" />
          </label>
        </div>
      </fieldset>
      {company && (
        <dl className="admin-audit">
          <div><dt>Estado</dt><dd>{company.isActive ? "Ativa" : "Inativa"}</dd></div>
          <div><dt>Criada em</dt><dd>{new Date(company.createdAt).toLocaleString("pt-PT")}</dd></div>
          <div><dt>Criada por</dt><dd>{company.createdBy}</dd></div>
          <div><dt>Atualizada em</dt><dd>{new Date(company.updatedAt).toLocaleString("pt-PT")} · {company.updatedBy}</dd></div>
        </dl>
      )}
    </>
  );
}
