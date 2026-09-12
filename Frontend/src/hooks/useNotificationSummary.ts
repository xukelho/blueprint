import { useCallback, useEffect, useState } from "react";
import { getNotificationSummary, NOTIFICATIONS_CHANGED_EVENT, NotificationSummary } from "../api/notifications";

export function useNotificationSummary(enabled = true) {
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const loaded = await getNotificationSummary();
      setSummary({ ...loaded, projectUnreadCounts: loaded.projectUnreadCounts ?? [] });
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar o resumo das notificações.");
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setSummary(null); setError(""); return; }
    void load();
    const refresh = () => void load();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh); };
  }, [enabled, load]);

  return { summary, error, load };
}
