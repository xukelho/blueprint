export type RoleResponse = { id: number; name: string };

export type UserResponse = {
  id: number;
  username: string;
  roles: RoleResponse[];
  createdAt: string;
  createdBy: number;
  updatedAt: string;
  updatedBy: number;
};

export type ContactProfile = {
  displayName: string;
  fullName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
};

export type EmployeeResponse = ContactProfile & {
  id: number;
  userId: number;
  companyId: number;
};

export type ClientResponse = ContactProfile & {
  id: number;
  userId: number;
  companyId: number | null;
};

export type CompanyResponse = {
  id: number;
  name: string;
  legalName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
  isActive: boolean;
  createdAt: string;
  createdBy: number;
  updatedAt: string;
  updatedBy: number;
};

export type AdministrationData = {
  roles: RoleResponse[];
  users: UserResponse[];
  employees: EmployeeResponse[];
  clients: ClientResponse[];
  companies: CompanyResponse[];
};

export type FieldErrors = Record<string, string>;

export class AdministrationApiError extends Error {
  constructor(message: string, public fieldErrors: FieldErrors = {}) {
    super(message);
  }
}

const camelCase = (value: string) => value.charAt(0).toLocaleLowerCase() + value.slice(1);

export async function administrationRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const hasJson = response.headers.get("content-type")?.includes("application/json");
  const body = hasJson ? await response.json() as Record<string, unknown> : null;
  if (!response.ok) {
    const problemErrors = body?.errors as Record<string, string[]> | undefined;
    const fieldErrors = Object.fromEntries(
      Object.entries(problemErrors ?? {}).map(([key, messages]) => [
        camelCase(key),
        Array.isArray(messages) ? messages.join(" ") : String(messages),
      ]),
    );
    const message = typeof body?.error === "string"
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

export const jsonRequest = (method: "POST" | "PUT", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function loadAdministrationData(): Promise<AdministrationData> {
  const [roles, users, employees, clients, companies] = await Promise.all([
    administrationRequest<RoleResponse[]>("/api/admin/roles"),
    administrationRequest<UserResponse[]>("/api/admin/users"),
    administrationRequest<EmployeeResponse[]>("/api/admin/employees"),
    administrationRequest<ClientResponse[]>("/api/admin/clients"),
    administrationRequest<CompanyResponse[]>("/api/admin/companies?includeInactive=true"),
  ]);
  return { roles, users, employees, clients, companies };
}
