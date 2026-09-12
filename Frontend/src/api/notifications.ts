export type NotificationTarget = {
  kind: "project" | "timeline" | "document" | "globalMessage" | "partConversation";
  projectId: number;
  documentId: string | null;
  conversationId: number | null;
  messageId: number | null;
};

export type ProjectNotification = {
  id: number;
  type: string;
  projectId: number;
  projectTitle: string;
  actorDisplayName: string;
  summary: string;
  createdAt: string;
  readAt: string | null;
  target: NotificationTarget;
};

export type NotificationPage = { items: ProjectNotification[]; hasMore: boolean };
export type ProjectUnreadCount = { projectId: number; unreadCount: number };
export type NotificationSummary = { unreadCount: number; pendingInvitationCount: number; total: number; projectUnreadCounts: ProjectUnreadCount[] };
export const NOTIFICATIONS_CHANGED_EVENT = "blueprint:notifications-changed";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error("Não foi possível atualizar as notificações.");
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function getNotifications(options: { beforeId?: number; unreadOnly?: boolean; limit?: number; projectId?: number } = {}) {
  const query = new URLSearchParams();
  if (options.beforeId !== undefined) query.set("beforeId", String(options.beforeId));
  if (options.unreadOnly) query.set("unreadOnly", "true");
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  if (options.projectId !== undefined) query.set("projectId", String(options.projectId));
  return request<NotificationPage>(`/api/notifications${query.size ? `?${query}` : ""}`);
}

export const getNotificationSummary = () => request<NotificationSummary>("/api/notifications/summary");
export const markNotificationRead = (id: number) => request<void>(`/api/notifications/${id}/read`, { method: "PUT" });
export const markAllNotificationsRead = () => request<void>("/api/notifications/read-all", { method: "PUT" });
export const notifyNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
