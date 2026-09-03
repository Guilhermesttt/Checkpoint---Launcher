/**
 * controllerBatteryService.ts
 * Serviço unificado de monitoramento de bateria de controles (WebHID, Electron IPC, Gamepad API)
 * Arquitetura baseada em Clean Code, SRP e OCP.
 */

import { findBatteryAdapter } from "./controllers/battery-adapters";

export type ControllerConnectionType = "bluetooth" | "usb" | "unknown";

export interface ControllerBatteryState {
  batteryLevel: number | null; // 0 a 100
  isCharging: boolean;
  connectionType: ControllerConnectionType;
  deviceName: string | null;
  isLowBattery: boolean;
  isCriticalBattery: boolean;
}

export type BatteryListener = (state: ControllerBatteryState) => void;

export interface ParsedBatteryResult {
  batteryLevel: number;
  isCharging: boolean;
  connectionType: ControllerConnectionType;
  deviceName: string;
}

/* ==========================================================================
   1. OCP: Contrato e Estratégias de Parsers HID
   ========================================================================== */

export interface HidReportParser {
  readonly deviceName: string;
  matches(vendorId: number, productId: number): boolean;
  parse(event: HIDInputReportEvent): ParsedBatteryResult | null;
}

export class DualSenseParser implements HidReportParser {
  readonly deviceName = "PlayStation DualSense";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x0ce6, 0x0df2]);

  matches(vendorId: number, productId: number): boolean {
    return vendorId === DualSenseParser.VENDOR_ID && DualSenseParser.SUPPORTED_PIDS.has(productId);
  }

  parse({ reportId, data }: HIDInputReportEvent): ParsedBatteryResult | null {
    // 0x31: Bluetooth, 0x01: USB
    if (reportId === 0x31 && data.byteLength >= 54) {
      return this.extractBattery(data.getUint8(53), "bluetooth");
    }
    if (reportId === 0x01 && data.byteLength >= 53) {
      return this.extractBattery(data.getUint8(52), "usb");
    }
    return null;
  }

  private extractBattery(byte: number, connectionType: ControllerConnectionType): ParsedBatteryResult {
    const rawLevel = byte & 0x0f;
    return {
      batteryLevel: Math.min(100, Math.max(0, rawLevel * 10)),
      isCharging: (byte & 0xf0) !== 0,
      connectionType,
      deviceName: this.deviceName,
    };
  }
}

export class DualShock4Parser implements HidReportParser {
  readonly deviceName = "PlayStation DualShock 4";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x05c4, 0x09cc]);

  matches(vendorId: number, productId: number): boolean {
    return vendorId === DualShock4Parser.VENDOR_ID && DualShock4Parser.SUPPORTED_PIDS.has(productId);
  }

  parse({ reportId, data }: HIDInputReportEvent): ParsedBatteryResult | null {
    // 0x11: Bluetooth, USB varia entre relatórios menores
    const isBluetooth = reportId === 0x11;

    if (isBluetooth && data.byteLength >= 31) {
      return this.extractBattery(data.getUint8(30), "bluetooth");
    }
    if (!isBluetooth && data.byteLength >= 13) {
      return this.extractBattery(data.getUint8(12), "usb");
    }
    return null;
  }

  private extractBattery(byte: number, connectionType: ControllerConnectionType): ParsedBatteryResult {
    const rawLevel = byte & 0x0f;
    return {
      batteryLevel: Math.min(100, Math.max(0, Math.round((rawLevel / 8) * 100))),
      isCharging: (byte & 0x10) !== 0,
      connectionType,
      deviceName: this.deviceName,
    };
  }
}

class HidParserRegistry {
  private parsers: HidReportParser[] = [
    new DualSenseParser(),
    new DualShock4Parser(),
  ];

  public register(parser: HidReportParser): void {
    this.parsers.push(parser);
  }

  public resolve(vendorId: number, productId: number): HidReportParser | undefined {
    return this.parsers.find((p) => p.matches(vendorId, productId));
  }
}

/* ==========================================================================
   2. SRP: Disparador de Alertas (Notificações DOM e IPC)
   ========================================================================== */

class BatteryAlertManager {
  private hasWarnedLow = false;
  private hasWarnedCritical = false;

  public evaluate(state: ControllerBatteryState): void {
    const isEligible = state.connectionType === "bluetooth" && !state.isCharging && state.batteryLevel !== null;

    if (!isEligible) {
      this.reset();
      return;
    }

    const level = state.batteryLevel!;

    if (level <= 10 && !this.hasWarnedCritical) {
      this.hasWarnedCritical = true;
      this.hasWarnedLow = true;
      this.dispatch(level, true);
    } else if (level <= 20 && !this.hasWarnedLow) {
      this.hasWarnedLow = true;
      this.dispatch(level, false);
    } else if (level > 20) {
      this.reset();
    }
  }

  private reset(): void {
    this.hasWarnedLow = false;
    this.hasWarnedCritical = false;
  }

  private dispatch(level: number, isCritical: boolean): void {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("checkpoint:low-battery", {
        detail: {
          level,
          isCritical,
          message: isCritical
            ? `Bateria Crítica do Controle (${level}%) — Conecte o cabo imediatamente!`
            : `Bateria Fraca do Controle (${level}%) — Conecte o cabo USB para continuar jogando.`,
        },
      })
    );

    try {
      const electron = (window as unknown as { electronAPI?: { showOverlayNotification?: (opts: unknown) => Promise<void> } }).electronAPI;
      if (typeof electron?.showOverlayNotification === "function") {
        void electron.showOverlayNotification({
          type: "battery-low",
          title: isCritical ? "Bateria Crítica do Controle!" : "Bateria Fraca do Controle",
          message: `Nível em ${level}%. Conecte o cabo USB.`,
          action: { actionId: "custom" },
        });
      }
    } catch {
      // Notificação opcional falhou
    }
  }
}

/* ==========================================================================
   3. Gerenciamento de Estado e Polling
   ========================================================================== */

const parserRegistry = new HidParserRegistry();
const alertManager = new BatteryAlertManager();
const listeners = new Set<BatteryListener>();

let currentState: ControllerBatteryState = {
  batteryLevel: null,
  isCharging: false,
  connectionType: "unknown",
  deviceName: null,
  isLowBattery: false,
  isCriticalBattery: false,
};

let pollTimer: number | null = null;
let activeHidDevice: HIDDevice | null = null;
let lastWebHidReportTime = 0;

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener(currentState);
    } catch {
      // Listener isolado
    }
  });
}

function updateBatteryState(partial: Partial<ControllerBatteryState>): void {
  const next: ControllerBatteryState = { ...currentState, ...partial };

  // Se o controle continua conectado no mesmo tipo e o novo poll veio temporariamente com batteryLevel null, preserva o último percentual conhecido
  if (partial.batteryLevel === null && currentState.batteryLevel !== null && (partial.connectionType === undefined || partial.connectionType === currentState.connectionType)) {
    next.batteryLevel = currentState.batteryLevel;
  }

  const { batteryLevel, isCharging, connectionType } = next;
  const isWireless = connectionType === "bluetooth";

  // Só alerta bateria fraca se estiver no Bluetooth, descarregando e com nível válido (> 0)
  next.isLowBattery = Boolean(isWireless && !isCharging && batteryLevel !== null && batteryLevel > 0 && batteryLevel <= 20);
  next.isCriticalBattery = Boolean(isWireless && !isCharging && batteryLevel !== null && batteryLevel > 0 && batteryLevel <= 10);

  const hasChanged =
    currentState.batteryLevel !== next.batteryLevel ||
    currentState.isCharging !== next.isCharging ||
    currentState.connectionType !== next.connectionType ||
    currentState.deviceName !== next.deviceName;

  currentState = next;

  if (hasChanged) {
    notifyListeners();
  }

  alertManager.evaluate(currentState);
}

function handleHidInputReport(event: HIDInputReportEvent): void {
  // 1. Tenta adaptador modular centralizado
  const adapter = findBatteryAdapter({
    vendorId: event.device.vendorId,
    productId: event.device.productId,
    name: event.device.productName,
  });

  if (adapter) {
    const reading = adapter.parseInputReport(event.reportId, event.data);
    if (reading) {
      lastWebHidReportTime = Date.now();
      updateBatteryState({
        batteryLevel: reading.level,
        isCharging: reading.charging,
        connectionType: reading.transport,
        deviceName: reading.deviceName,
      });
      return;
    }
  }

  // 2. Fallback para parser registrado
  const parser = parserRegistry.resolve(event.device.vendorId, event.device.productId);
  if (!parser) return;

  const result = parser.parse(event);
  if (result) {
    lastWebHidReportTime = Date.now();
    updateBatteryState(result);
  }
}

async function initWebHidBatteryListener(): Promise<void> {
  if (typeof navigator === "undefined" || !("hid" in navigator)) return;

  try {
    const devices = await navigator.hid.getDevices();
    for (const device of devices) {
      const adapter = findBatteryAdapter({
        vendorId: device.vendorId,
        productId: device.productId,
        name: device.productName,
      });
      const parser = parserRegistry.resolve(device.vendorId, device.productId);
      if (!adapter && !parser) continue;

      if (!device.opened) {
        try {
          await device.open();
        } catch {
          continue;
        }
      }

      if (device.opened) {
        activeHidDevice = device;
        device.addEventListener("inputreport", handleHidInputReport as EventListener);
        break;
      }
    }
  } catch {
    // WebHID indisponível ou permissão negada
  }
}

async function pollFallbackBatterySources(): Promise<void> {
  // Se WebHID estiver ativo e transmitindo relatórios recentes (últimos 3s), não deixa o fallback sobrescrever
  if (Date.now() - lastWebHidReportTime < 3000) {
    return;
  }

  // 1. Electron IPC (Windows PnP + HID nativo via PowerShell / C# - Mais confiável no Windows para Xbox / fallbacks)
  try {
    const electron = (window as unknown as { electronAPI?: { getControllerBattery?: () => Promise<Record<string, unknown>> } }).electronAPI;
    if (typeof electron?.getControllerBattery === "function") {
      const res = await electron.getControllerBattery();
      if (res && (res.connectionType !== "unknown" || res.batteryLevel !== null)) {
        updateBatteryState({
          batteryLevel: typeof res.batteryLevel === "number" ? res.batteryLevel : null,
          isCharging: Boolean(res.isCharging),
          connectionType: (res.connectionType as ControllerConnectionType) || "unknown",
          deviceName: typeof res.deviceName === "string" ? res.deviceName : "Controle",
        });
        return;
      }
    }
  } catch {
    // Electron IPC indisponível
  }

  if (activeHidDevice?.opened) return;

  // 2. Standard Gamepad API
  if (typeof navigator !== "undefined" && navigator.getGamepads) {
    const gamepads = Array.from(navigator.getGamepads()).filter(Boolean);
    const primaryGamepad = gamepads[0] as (Gamepad & { battery?: { level: number; charging: boolean } }) | undefined;

    if (primaryGamepad?.battery) {
      updateBatteryState({
        batteryLevel: Math.round(primaryGamepad.battery.level * 100),
        isCharging: Boolean(primaryGamepad.battery.charging),
        connectionType: "bluetooth",
        deviceName: primaryGamepad.id || "Gamepad",
      });
    }
  }
}

/* ==========================================================================
   4. API Pública
   ========================================================================== */

export function registerCustomHidParser(parser: HidReportParser): void {
  parserRegistry.register(parser);
}

export function startControllerBatteryMonitoring(): () => void {
  // Ativa WebHID tanto no Electron quanto no navegador web para telemetria de 0 latência
  void initWebHidBatteryListener();
  void pollFallbackBatterySources();

  if (!pollTimer) {
    pollTimer = window.setInterval(() => {
      void pollFallbackBatterySources();
    }, 1500);
  }

  return () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (activeHidDevice) {
      activeHidDevice.removeEventListener("inputreport", handleHidInputReport as EventListener);
      activeHidDevice = null;
    }
  };
}

export function getControllerBatteryState(): ControllerBatteryState {
  return currentState;
}

export function subscribeControllerBattery(listener: BatteryListener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}