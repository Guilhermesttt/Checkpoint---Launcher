export function sendRumMetric(name: string, value: number) {
  if (!import.meta.env?.PROD) return;
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/rum", JSON.stringify({ name, value, ts: Date.now() }));
  }
}
