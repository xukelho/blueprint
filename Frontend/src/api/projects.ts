export type ClientOption = { id: number; displayName: string };
export type ProjectMember = { employeeId: number; displayName: string; email: string };
export type ProjectPhase = { id: number; code: string; label: string; position: number; isCurrent: boolean };
export type Project = { id: number; companyId: number; companyName: string; title: string; code: string; address: string; googleMapsUrl: string | null; isArchived: boolean; client: ClientOption | null; members?: ProjectMember[]; phases?: ProjectPhase[]; canEditTimeline?: boolean; currentPhaseCode?: string | null };
export type ClientListItem = { id: number; displayName: string; email: string; projectCount: number };
export type ClientDetail = ClientListItem & { fullName: string; nif: string; phoneNumber: string; address: string; internalNotes: string; projects: Array<Pick<Project, "id" | "title" | "code" | "currentPhaseCode" | "isArchived">>; canManageProjects: boolean };
export type ClientInvitation = { id: number; email: string; sentAt: string; expiresAt: string };
export type ReceivedClientInvitation = { id: number; companyId: number; companyName: string; sentAt: string; expiresAt: string };
export type ProjectDocument = {
  id: string;
  phaseId: number;
  fileName: string;
  contentType: string;
  length: number;
  status: string;
  createdBy: number;
  createdByDisplayName: string;
  createdAt: string;
  uploadedAt: string | null;
};
export type UploadGrant = { url: string; expiresAt: string; requiredHeaders: Record<string, string> };
export type PendingDocumentUpload = { documentId: string; storedObjectId: string; upload: UploadGrant };
export type CompleteDocumentUpload = { document: ProjectDocument };

export class ClientManagementApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const hasJson = response.headers.get("content-type")?.includes("application/json");
    const body = hasJson ? await response.json() as Record<string, unknown> : null;
    const problemErrors = body?.errors as Record<string, string[]> | undefined;
    const fieldErrors = Object.fromEntries(Object.entries(problemErrors ?? {}).map(([key, messages]) => [
      key.charAt(0).toLocaleLowerCase() + key.slice(1),
      Array.isArray(messages) ? messages.join(" ") : String(messages),
    ]));
    const message = typeof body?.error === "string"
      ? body.error
      : response.status === 403
        ? "Apenas o proprietário da empresa pode convidar clientes."
        : response.status === 404
          ? "Não tens acesso a este recurso."
          : "Não foi possível concluir a operação.";
    throw new ClientManagementApiError(message, response.status, fieldErrors);
  }
  if (!response.ok) {
    const hasJson = response.headers.get("content-type")?.includes("application/json");
    const body = hasJson ? await response.json() as Record<string, unknown> : null;
    const problemErrors = body?.errors as Record<string, string[]> | undefined;
    const fieldErrors = Object.fromEntries(Object.entries(problemErrors ?? {}).map(([key, messages]) => [
      key.charAt(0).toLocaleLowerCase() + key.slice(1),
      Array.isArray(messages) ? messages.join(" ") : String(messages),
    ]));
    const message = typeof body?.error === "string"
      ? body.error
      : response.status === 403
        ? "Apenas o proprietário da empresa pode convidar clientes."
        : response.status === 404
          ? "Não tens acesso a este recurso."
          : "Não foi possível concluir a operação.";
    throw new ClientManagementApiError(message, response.status, fieldErrors);
  }
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
export const reactivateProject = (id: string) => request<void>(`/api/projects/${id}/reactivate`, { method: "POST" });
export const getProjectDocuments = (id: string) => request<ProjectDocument[]>(`/api/projects/${id}/documents`);
export const createProjectDocumentUpload = (projectId: string, phaseId: string, file: File) => request<PendingDocumentUpload>(
  `/api/projects/${projectId}/phases/${phaseId}/documents/uploads`,
  json("POST", { fileName: file.name, contentType: file.type || "application/octet-stream", length: file.size }),
);
export async function putProjectDocument(upload: UploadGrant, file: File) {
  const response = await fetch(upload.url, { method: "PUT", headers: upload.requiredHeaders, body: file });
  if (!response.ok) throw new ClientManagementApiError(`Não foi possível enviar ${file.name}.`, response.status);
}
export const completeProjectDocumentUpload = (projectId: string, documentId: string) => request<CompleteDocumentUpload>(
  `/api/projects/${projectId}/documents/${documentId}/complete`, { method: "POST" },
);
export async function uploadProjectDocument(projectId: string, phaseId: string, file: File) {
  const pending = await createProjectDocumentUpload(projectId, phaseId, file);
  await putProjectDocument(pending.upload, file);
  return (await completeProjectDocumentUpload(projectId, pending.documentId)).document;
}
export const deleteProjectDocument = (projectId: string, documentId: string) => request<void>(
  `/api/projects/${projectId}/documents/${documentId}`, { method: "DELETE" },
);
export const getCompanyMembers = () => request<ProjectMember[]>("/api/projects/members");
export const getClients = () => request<ClientListItem[]>("/api/clients/");
export const getClient = (id: string) => request<ClientDetail>(`/api/clients/${id}`);
export const getClientInvitations = () => request<ClientInvitation[]>("/api/client-invitations/");
export const createClientInvitation = (email: string) => request<ClientInvitation>("/api/client-invitations/", json("POST", { email }));
export const getReceivedClientInvitations = () => request<ReceivedClientInvitation[]>("/api/client-invitations/received");
export const acceptClientInvitation = (id: number) => request<void>(`/api/client-invitations/${id}/accept`, { method: "POST" });
export const rejectClientInvitation = (id: number) => request<void>(`/api/client-invitations/${id}/reject`, { method: "POST" });
export const saveClientNotes = (id: string, internalNotes: string) => request<void>(`/api/clients/${id}/notes`, json("PUT", { internalNotes }));
export const associateClientProject = (clientId: string, projectId: number) => request<void>(`/api/clients/${clientId}/projects/${projectId}`, { method: "PUT" });
export const removeClientProject = (clientId: string, projectId: number) => request<void>(`/api/clients/${clientId}/projects/${projectId}`, { method: "DELETE" });
