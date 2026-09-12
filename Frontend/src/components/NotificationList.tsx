import { Bell, MessageSquare } from "lucide-react";
import { ProjectNotification } from "../api/notifications";

const dayLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "long" }).format(new Date(value));
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

type NotificationListProps = {
  items: ProjectNotification[];
  loading?: boolean;
  emptyText: string;
  groupByDay?: boolean;
  onRead: (item: ProjectNotification) => void | Promise<void>;
};

function NotificationCard({ item, onRead }: { item: ProjectNotification; onRead: NotificationListProps["onRead"] }) {
  return <button type="button" className={`notification-card ${item.readAt ? "" : "is-unread"}`} onClick={() => void onRead(item)}>
    <span className="notification-card__icon"><MessageSquare size={18} aria-hidden="true" /></span>
    <span className="notification-card__copy"><strong>{item.actorDisplayName} {item.summary}</strong><small>{item.projectTitle}</small></span>
    <time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
    {!item.readAt && <span className="notification-card__dot" aria-label="Não lida" />}
  </button>;
}

export function NotificationList({ items, loading = false, emptyText, groupByDay = true, onRead }: NotificationListProps) {
  if (loading) return <p role="status">A carregar notificações…</p>;
  if (!items.length) return <div className="notifications-empty"><Bell size={25} aria-hidden="true" /><p>{emptyText}</p></div>;
  if (!groupByDay) return <div className="notification-list">{items.map((item) => <NotificationCard item={item} onRead={onRead} key={item.id} />)}</div>;

  const groups = Object.entries(items.reduce<Record<string, ProjectNotification[]>>((result, item) => {
    const day = dayLabel(item.createdAt);
    result[day] = [...(result[day] ?? []), item];
    return result;
  }, {}));
  return <>{groups.map(([day, notifications]) => <div className="notification-day" key={day}>
    <h3>{day}</h3>
    <div className="notification-list">{notifications.map((item) => <NotificationCard item={item} onRead={onRead} key={item.id} />)}</div>
  </div>)}</>;
}
