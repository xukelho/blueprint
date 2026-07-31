export type ProfileType = "client" | "employee";

export type ProfileCompanyOption = {
  id: number;
  name: string;
};

export type CurrentProfile = {
  profileType: ProfileType;
  userId: number;
  username: string;
  displayName: string;
  fullName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
  companyId: number | null;
  companyName: string | null;
  roles: string[];
  availableCompanies: ProfileCompanyOption[];
  companyRole?: "owner" | "employee";
  isArchitect?: boolean;
};

export type UpdateCurrentProfile = {
  username: string;
  displayName: string;
  fullName: string;
  nif: string;
  email: string;
  phoneNumber: string;
  address: string;
  companyId: number | null;
  isArchitect: boolean;
};

export type ProfileFieldErrors = Record<string, string>;

export class ProfileApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: ProfileFieldErrors = {},
  ) {
    super(message);
  }
}

async function profileRequest<T>(init?: RequestInit): Promise<T> {
  const response = await fetch("/api/profile", init);
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
        : response.status === 404
          ? "Não foi encontrado um perfil para esta conta."
          : "Não foi possível guardar o perfil.";
    throw new ProfileApiError(message, response.status, fieldErrors);
  }
  return body as T;
}

export async function loadCurrentProfile() {
  const profile = await profileRequest<CurrentProfile>();
  if (
    (profile.profileType !== "client" && profile.profileType !== "employee") ||
    !Array.isArray(profile.roles)
  ) {
    throw new ProfileApiError("A resposta do perfil é inválida.", 500);
  }
  return profile;
}

export function saveCurrentProfile(payload: UpdateCurrentProfile) {
  return profileRequest<CurrentProfile>({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function changeCurrentPassword(currentPassword: string, newPassword: string) {
  return profileRequest<void>({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
}
