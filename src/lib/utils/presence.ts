// Compute real presence status from lastSeen timestamp
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function isContactOnline(lastSeen?: Date | string | null, storedOnline?: boolean): boolean {
  // If webhook explicitly set online, check if it's recent
  if (lastSeen) {
    const lastSeenDate = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
    return Date.now() - lastSeenDate.getTime() < ONLINE_THRESHOLD_MS;
  }
  return false;
}

export function formatPresenceStatus(lastSeen?: Date | string | null): string {
  if (!lastSeen) return 'offline';
  const lastSeenDate = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
  if (Date.now() - lastSeenDate.getTime() < ONLINE_THRESHOLD_MS) return 'online';
  return 'offline';
}
