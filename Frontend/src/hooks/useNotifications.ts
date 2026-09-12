import { useCallback, useEffect, useState } from "react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  notifyNotificationsChanged,
  ProjectNotification,
} from "../api/notifications";

type UseNotificationsOptions = {
  unreadOnly?: boolean;
  limit?: number;
  projectId?: number;
  autoRefresh?: boolean;
};

export function useNotifications({ unreadOnly = false, limit, projectId, autoRefresh = true }: UseNotificationsOptions = {}) {
  const [items, setItems] = useState<ProjectNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const page = await getNotifications({ unreadOnly, limit, projectId });
      if (!Array.isArray(page.items) || typeof page.hasMore !== "boolean") throw new Error("Não foi possível carregar as notificações.");
      setItems(page.items);
      setHasMore(page.hasMore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [limit, projectId, unreadOnly]);

  useEffect(() => {
    setLoading(true);
    void load();
    if (!autoRefresh) return;
    const refresh = () => void load();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh); };
  }, [autoRefresh, load]);

  const read = useCallback(async (item: ProjectNotification) => {
    if (item.readAt) return;
    try {
      await markNotificationRead(item.id);
      const readAt = new Date().toISOString();
      setItems((current) => unreadOnly
        ? current.filter((candidate) => candidate.id !== item.id)
        : current.map((candidate) => candidate.id === item.id ? { ...candidate, readAt } : candidate));
      notifyNotificationsChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível marcar a notificação como lida.");
    }
  }, [unreadOnly]);

  const readAll = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => unreadOnly ? [] : current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      notifyNotificationsChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível marcar as notificações como lidas.");
    }
  }, [unreadOnly]);

  const loadMore = useCallback(async () => {
    const beforeId = items.at(-1)?.id;
    if (!beforeId || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getNotifications({ beforeId, unreadOnly, limit, projectId });
      if (!Array.isArray(page.items) || typeof page.hasMore !== "boolean") throw new Error("Não foi possível carregar as notificações.");
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar mais notificações.");
    } finally {
      setLoadingMore(false);
    }
  }, [items, limit, loadingMore, projectId, unreadOnly]);

  return { items, hasMore, loading, loadingMore, error, load, read, readAll, loadMore };
}
