// Compute real presence status from lastSeen timestamp
// 70 seconds threshold as per WhatsApp standard
const ONLINE_THRESHOLD_MS = 70 * 1000; // 70 seconds

export function isContactOnline(lastSeen?: Date | string | null, storedOnline?: boolean): boolean {
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
