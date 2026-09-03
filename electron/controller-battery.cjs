const { execFile } = require("child_process");
const path = require("path");

let lastQueryTime = 0;
let cachedResult = {
  batteryLevel: null,
  isCharging: false,
  connectionType: "unknown",
  deviceName: null,
};
let pendingQuery = null;

const queryScriptPath = path.join(__dirname, "controller-query.ps1");

function queryWindowsControllerBattery() {
  const now = Date.now();
  // Cache por 1.5s para não sobrecarregar
  if (now - lastQueryTime < 1500 && cachedResult.connectionType !== "unknown") {
    return Promise.resolve(cachedResult);
  }

  // Se já há uma consulta em andamento, reaproveita a mesma promessa
  if (pendingQuery) {
    return pendingQuery;
  }

  lastQueryTime = now;

  pendingQuery = new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", queryScriptPath],
      { timeout: 8000 },
      (err, stdout) => {
        pendingQuery = null;
        if (err || !stdout) {
          resolve(cachedResult);
          return;
        }
        const trimmed = stdout.trim();
        const parts = trimmed.split("|");
        if (parts.length >= 3) {
          const bat = parts[0] ? parseInt(parts[0], 10) : null;
          const isCharging = parts[1] === "True";
          const connectionType = parts[2] || "unknown";
          const deviceName = parts[3] || "Controle";
          cachedResult = {
            batteryLevel: Number.isFinite(bat) ? bat : null,
            isCharging,
            connectionType,
            deviceName,
          };
        }
        resolve(cachedResult);
      }
    );
  });

  return pendingQuery;
}

module.exports = {
  queryWindowsControllerBattery,
};
