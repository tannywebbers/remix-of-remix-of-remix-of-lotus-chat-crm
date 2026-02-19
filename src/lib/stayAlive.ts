/**
 * Stay-alive pinger — keeps the edge function/webhook warm
 * and ensures online status stays accurate.
 * Pings every 20 seconds.
 */

let pingInterval: ReturnType<typeof setInterval> | null = null;

export function startStayAlive(webhookUrl?: string) {
  if (pingInterval) return; // Already running

  const ping = async () => {
    try {
      const url = webhookUrl || `${window.location.origin}/api/health`;
      await fetch(url, { method: 'GET', mode: 'no-cors' });
    } catch {
      // Silently ignore — we just want to keep the connection alive
    }
  };

  // Immediate first ping
  ping();

  // Then every 20 seconds
  pingInterval = setInterval(ping, 20_000);
}

export function stopStayAlive() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}
