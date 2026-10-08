export function isNotificationRead(notification) {
  return !!notification?.read_at;
}

export function groupNotificationsByDay(notifications, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map();

  for (const notification of notifications) {
    const createdAt = new Date(notification.created_at);
    const day = Number.isNaN(createdAt.getTime())
      ? 'Earlier'
      : new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime() === today.getTime()
        ? 'Today'
        : new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate()).getTime() === yesterday.getTime()
          ? 'Yesterday'
          : createdAt.toLocaleDateString();
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(notification);
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
