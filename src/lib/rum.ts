export function sendRumMetric(name: string, value: number) {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/rum", JSON.stringify({ name, value, ts: Date.now() }));
  }
}
