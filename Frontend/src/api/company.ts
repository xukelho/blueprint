export type CompanyResponse = {
  id: number;
  name: string;
  legalName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
  website: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: number;
  updatedAt: string;
  updatedBy: number;
};

export type UpdateCurrentCompany = {
  name: string;
  legalName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
  website: string;
};

export type ProjectStorageUsage = { projectId: number; title: string; code: string; isArchived: boolean; occupiedBytes: number; reservedBytes: number; totalBytes: number };
export type CompanyStorageUsage = {
  baseLimitBytes: number; adminExtraBytes: number; purchasedExtraBytes: number; totalCapacityBytes: number;
  occupiedBytes: number; reservedBytes: number; availableBytes: number; usagePercent: number; isOverCapacity: boolean;
  projects: ProjectStorageUsage[];
};

export class CompanyApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function companyRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/company", init);
  const hasJson = response.headers.get("content-type")?.includes("application/json");
  const body = hasJson ? await response.json() as Record<string, unknown> : null;
  if (!response.ok) {
    const problemErrors = body?.errors as Record<string, string[]> | undefined;
    const fieldErrors = Object.fromEntries(
      Object.entries(problemErrors ?? {}).map(([key, messages]) => [
        key.charAt(0).toLocaleLowerCase() + key.slice(1),
        Array.isArray(messages) ? messages.join(" ") : String(messages),
      ]),
    );
    const message = typeof body?.error === "string"
      ? body.error
      : response.status === 401
        ? "A tua sessão terminou. Inicia sessão novamente."
        : response.status === 403
          ? "Não tens permissão para gerir este atelier."
          : response.status === 404
            ? "Não foi encontrado um atelier ativo para esta conta."
            : "Não foi possível concluir o pedido.";
    throw new CompanyApiError(message, response.status, fieldErrors);
  }
  return body as T;
}

async function companyPathRequest<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new CompanyApiError("Não foi possível carregar o armazenamento do atelier.", response.status);
  return response.json() as Promise<T>;
}

export function loadCurrentCompany() {
  return companyRequest<CompanyResponse>();
}

export function saveCurrentCompany(payload: UpdateCurrentCompany) {
  return companyRequest<CompanyResponse>({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const loadCompanyStorage = () => companyPathRequest<CompanyStorageUsage>("/api/company/storage");
