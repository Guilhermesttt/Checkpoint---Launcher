/**
 * battery-adapters.ts
 * Adaptadores modulares de telemetria de bateria e conexão para controladores de jogos.
 * Suporta PlayStation DualSense, DualShock 4, Xbox e controladores genéricos.
 */

export type ControllerTransport = "bluetooth" | "usb" | "unknown";

export interface ControllerDeviceInfo {
  vendorId: number;
  productId: number;
  name?: string;
  transport?: ControllerTransport;
}

export interface BatteryReading {
  level: number; // 0 a 100
  charging: boolean;
  transport: ControllerTransport;
  deviceName: string;
  timestamp: number;
}

export interface ControllerBatteryAdapter {
  readonly deviceName: string;
  matches(info: ControllerDeviceInfo): boolean;
  parseInputReport(reportId: number, data: DataView): BatteryReading | null;
}

/**
 * Sony PlayStation DualSense (PS5)
 * VID: 0x054c | PIDs: 0x0ce6, 0x0df2
 * - Bluetooth: Report ID 0x31 (byte 53 = battery/charging)
 * - USB: Report ID 0x01 (byte 52 = battery/charging)
 */
export class DualSenseBatteryAdapter implements ControllerBatteryAdapter {
  readonly deviceName = "PlayStation DualSense";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x0ce6, 0x0df2]);

  matches(info: ControllerDeviceInfo): boolean {
    if (info.vendorId === DualSenseBatteryAdapter.VENDOR_ID && DualSenseBatteryAdapter.SUPPORTED_PIDS.has(info.productId)) {
      return true;
    }
    return /dualsense|wireless controller/i.test(info.name ?? "") && (info.productId === 0x0ce6 || info.productId === 0x0df2);
  }

  parseInputReport(reportId: number, data: DataView): BatteryReading | null {
    // 0x31: Bluetooth (dados estendidos com telemetria de bateria)
    if (reportId === 0x31 && data.byteLength >= 54) {
      return this.extract(data.getUint8(53), "bluetooth");
    }
    // 0x01: Conexão direta via cabo USB
    if (reportId === 0x01 && data.byteLength >= 53) {
      return this.extract(data.getUint8(52), "usb");
    }
    return null;
  }

  private extract(byte: number, transport: ControllerTransport): BatteryReading {
    const rawLevel = byte & 0x0f;
    const isCharging = (byte & 0xf0) !== 0;
    // rawLevel 0x0 a 0xa mapeia para 0% a 100%
    const level = Math.min(100, Math.max(0, Math.round(rawLevel * 10)));
    return {
      level,
      charging: isCharging,
      transport,
      deviceName: this.deviceName,
      timestamp: Date.now(),
    };
  }
}

/**
 * Sony PlayStation DualShock 4 (PS4)
 * VID: 0x054c | PIDs: 0x05c4, 0x09cc
 * - Bluetooth: Report ID 0x11 (byte 30 = battery/charging)
 * - USB: Report ID 0x01 ou genérico (byte 12 = battery/charging)
 */
export class DualShock4BatteryAdapter implements ControllerBatteryAdapter {
  readonly deviceName = "PlayStation DualShock 4";
  private static readonly VENDOR_ID = 0x054c;
  private static readonly SUPPORTED_PIDS = new Set([0x05c4, 0x09cc]);

  matches(info: ControllerDeviceInfo): boolean {
    if (info.vendorId === DualShock4BatteryAdapter.VENDOR_ID && DualShock4BatteryAdapter.SUPPORTED_PIDS.has(info.productId)) {
      return true;
    }
    return /dualshock|wireless controller/i.test(info.name ?? "");
  }

  parseInputReport(reportId: number, data: DataView): BatteryReading | null {
    const isBluetooth = reportId === 0x11;
    if (isBluetooth && data.byteLength >= 31) {
      return this.extract(data.getUint8(30), "bluetooth");
    }
    if (!isBluetooth && data.byteLength >= 13) {
      return this.extract(data.getUint8(12), "usb");
    }
    return null;
  }

  private extract(byte: number, transport: ControllerTransport): BatteryReading {
    const rawLevel = byte & 0x0f;
    const isCharging = (byte & 0x10) !== 0;
    // DS4 reporta rawLevel de 0 a 8 (0 = vazio, 8 = 100%)
    const level = Math.min(100, Math.max(0, Math.round((rawLevel / 8) * 100)));
    return {
      level,
      charging: isCharging,
      transport,
      deviceName: this.deviceName,
      timestamp: Date.now(),
    };
  }
}

/**
 * Microsoft Xbox Controller
 * Xbox utiliza prioritariamente XInput no Windows.
 */
export class XboxBatteryAdapter implements ControllerBatteryAdapter {
  readonly deviceName = "Xbox Controller";
  private static readonly VENDOR_ID = 0x045e;

  matches(info: ControllerDeviceInfo): boolean {
    return info.vendorId === XboxBatteryAdapter.VENDOR_ID || /xbox|xinput/i.test(info.name ?? "");
  }

  parseInputReport(_reportId: number, _data: DataView): BatteryReading | null {
    // Xbox controllers usam polling XInput nativo no processo principal do Electron
    return null;
  }
}

/**
 * Registro e resolução de adaptadores
 */
const defaultAdapters: ControllerBatteryAdapter[] = [
  new DualSenseBatteryAdapter(),
  new DualShock4BatteryAdapter(),
  new XboxBatteryAdapter(),
];

export function findBatteryAdapter(info: ControllerDeviceInfo): ControllerBatteryAdapter | undefined {
  return defaultAdapters.find((adapter) => adapter.matches(info));
}
