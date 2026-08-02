export type ClientOption = { id: number; displayName: string };
export type ProjectMember = { employeeId: number; displayName: string; email: string };
export type ProjectPhase = { id: number; code: string; label: string; position: number; isCurrent: boolean };
export type Project = { id: number; title: string; code: string; address: string; googleMapsUrl: string | null; isArchived: boolean; client: ClientOption | null; members?: ProjectMember[]; phases?: ProjectPhase[]; canEditTimeline?: boolean; currentPhaseCode?: string | null };
export type ClientListItem = { id: number; displayName: string; email: string; projectCount: number };
export type ClientDetail = ClientListItem & { fullName: string; nif: string; phoneNumber: string; address: string; internalNotes: string; projects: Array<Pick<Project, "id" | "title" | "code" | "currentPhaseCode" | "isArchived">>; canManageProjects: boolean };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(response.status === 404 ? "Não tens acesso a este recurso." : "Não foi possível concluir a operação.");
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const getProjects = () => request<Project[]>("/api/projects/");
export const getProject = (id: string) => request<Project>(`/api/projects/${id}`);
export const createProject = (body: { title: string; code: string; address: string; googleMapsUrl: string; clientId: number | null; employeeIds: number[]; phaseCodes: string[]; currentPhaseIndex: number | null }) => request<Project>("/api/projects/", json("POST", body));
export const updateProject = (id: string, body: { title: string; code: string; address: string; googleMapsUrl: string; clientId: number | null }) => request<Project>(`/api/projects/${id}`, json("PUT", body));
export const updateProjectPhases = (id: string, body: { phaseCodes: string[]; currentPhaseIndex: number | null }) => request<Project>(`/api/projects/${id}/phases`, json("PUT", body));
export const updateMembers = (id: string, employeeIds: number[]) => request<Project>(`/api/projects/${id}/members`, json("PUT", { employeeIds }));
export const archiveProject = (id: string) => request<void>(`/api/projects/${id}/archive`, { method: "POST" });
export const getCompanyMembers = () => request<ProjectMember[]>("/api/projects/members");
export const getClients = () => request<ClientListItem[]>("/api/clients/");
export const getClient = (id: string) => request<ClientDetail>(`/api/clients/${id}`);
export const saveClientNotes = (id: string, internalNotes: string) => request<void>(`/api/clients/${id}/notes`, json("PUT", { internalNotes }));
export const associateClientProject = (clientId: string, projectId: number) => request<void>(`/api/clients/${clientId}/projects/${projectId}`, { method: "PUT" });
export const removeClientProject = (clientId: string, projectId: number) => request<void>(`/api/clients/${clientId}/projects/${projectId}`, { method: "DELETE" });
