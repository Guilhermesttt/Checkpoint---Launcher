import type { VisualTheme } from "../context/PreferencesContext";

export const THEME_LED_COLORS: Record<VisualTheme, { r: number; g: number; b: number }> = {
  checkpoint: { r: 255, g: 255, b: 255 },
  playstation: { r: 37, g: 99, b: 235 },
  gamecube: { r: 124, g: 58, b: 237 },
  xbox360: { r: 132, g: 204, b: 22 },
};

const SONY_VENDOR_ID = 0x054c;

/** Product IDs conhecidos: DS4, DS4 v2, DualSense, DualSense Edge */
const SONY_LED_PRODUCT_IDS = new Set([0x05c4, 0x09cc, 0x0ba0, 0x0ce6, 0x0df2]);

type LedDeviceKind = "ds4" | "dualsense";

interface LedDevice {
  device: HIDDevice;
  kind: LedDeviceKind;
}

let cachedDevice: LedDevice | null = null;
let crc32Table: Uint32Array | null = null;

function isHidSupported(): boolean {
  return typeof navigator !== "undefined" && "hid" in navigator;
}

function clampRgb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function resolveLedKind(productId: number): LedDeviceKind {
  if (productId === 0x05c4 || productId === 0x09cc) return "ds4";
  return "dualsense";
}

function getOutputReportIds(device: HIDDevice): Set<number> {
  const reportIds = new Set<number>();
  for (const collection of device.collections ?? []) {
    for (const report of collection.outputReports ?? []) {
      reportIds.add(report.reportId);
    }
  }
  return reportIds;
}

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    crc32Table[i] = crc >>> 0;
  }
  return crc32Table;
}

function crc32Le(initialCrc: number, data: Uint8Array): number {
  const table = getCrc32Table();
  let crc = initialCrc >>> 0;
  for (const byte of data) {
    crc = (table[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return crc >>> 0;
}

function writeLe32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

export async function requestControllerLedAccess(): Promise<boolean> {
  if (!isHidSupported()) return false;

  try {
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: SONY_VENDOR_ID }],
    });
    return devices.length > 0;
  } catch {
    return false;
  }
}

async function findSonyHidDevice(): Promise<LedDevice | null> {
  if (!isHidSupported()) return null;

  const devices = await navigator.hid.getDevices();
  const supportedDevices = devices.filter(
    (device) => device.vendorId === SONY_VENDOR_ID && SONY_LED_PRODUCT_IDS.has(device.productId),
  );

  for (const device of supportedDevices) {
    const reportIds = getOutputReportIds(device);
    if (reportIds.size === 0 || reportIds.has(0x05) || reportIds.has(0x11) || reportIds.has(0x02) || reportIds.has(0x31)) {
      return { device, kind: resolveLedKind(device.productId) };
    }
  }
  return null;
}

async function ensureOpenDevice(): Promise<LedDevice | null> {
  if (cachedDevice?.device.opened) return cachedDevice;

  cachedDevice = await findSonyHidDevice();
  if (!cachedDevice) return null;

  if (!cachedDevice.device.opened) {
    try {
      await cachedDevice.device.open();
    } catch {
      cachedDevice = null;
      return null;
    }
  }

  return cachedDevice;
}

async function sendDs4Lightbar(device: HIDDevice, r: number, g: number, b: number): Promise<void> {
  const reportIds = getOutputReportIds(device);
  const supportsUsbReport = reportIds.size === 0 || reportIds.has(0x05);
  const supportsBtReport = reportIds.size === 0 || reportIds.has(0x11);
  const attempts: Array<() => Promise<void>> = [];

  if (supportsUsbReport) {
    attempts.push(async () => {
      // DualShock 4 USB/dongle output report 0x05. WebHID receives the reportId separately.
      const report = new Uint8Array(31);
      report[0] = 0x02; // valid_flag0: LED
      report[1] = 0x00; // valid_flag1
      report[2] = 0x00; // reserved
      report[3] = 0x00; // small rumble
      report[4] = 0x00; // big rumble
      report[5] = r;
      report[6] = g;
      report[7] = b;
      report[8] = 0x00; // flash on
      report[9] = 0x00; // flash off
      await device.sendReport(0x05, report);
    });

    attempts.push(async () => {
      // Fallback used by some DS4 tooling/firmwares.
      const report = new Uint8Array(31);
      report[0] = 0xff;
      report[1] = 0x04;
      report[2] = 0x00;
      report[3] = 0x00;
      report[4] = 0x00;
      report[5] = r;
      report[6] = g;
      report[7] = b;
      report[8] = 0x00;
      report[9] = 0x00;
      await device.sendReport(0x05, report);
    });
  }

  if (supportsBtReport) {
    attempts.push(async () => {
      // DualShock 4 Bluetooth output report 0x11. The CRC covers seed 0xa2,
      // the report id, and the payload excluding the final CRC bytes.
      const reportId = 0x11;
      const report = new Uint8Array(77);
      report[0] = 0xc0; // hw_control: HID + CRC32
      report[1] = 0x00; // audio_control
      report[2] = 0x02; // valid_flag0: LED
      report[3] = 0x00; // valid_flag1
      report[4] = 0x00; // reserved
      report[5] = 0x00; // small rumble
      report[6] = 0x00; // big rumble
      report[7] = r;
      report[8] = g;
      report[9] = b;
      report[10] = 0x00; // flash on
      report[11] = 0x00; // flash off

      const crcInput = new Uint8Array(1 + report.length - 4);
      crcInput[0] = reportId;
      crcInput.set(report.subarray(0, report.length - 4), 1);
      const seedCrc = crc32Le(0xffffffff, new Uint8Array([0xa2]));
      const crc = (~crc32Le(seedCrc, crcInput)) >>> 0;
      writeLe32(report, report.length - 4, crc);

      await device.sendReport(reportId, report);
    });
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Nenhum output report DS4 compativel encontrado.");
}

async function sendDualSenseLightbar(device: HIDDevice, r: number, g: number, b: number): Promise<void> {
  // USB output report 0x02 (48 bytes) — lightbar + player LED
  const report = new Uint8Array(47);
  report[0] = 0x00;
  report[1] = 0x14;
  report[38] = 0x01;
  report[42] = 0x00;
  report[43] = 0x04;
  report[44] = r;
  report[45] = g;
  report[46] = b;
  await device.sendReport(0x02, report);
}

export async function setControllerLedColor(r: number, g: number, b: number): Promise<boolean> {
  const led = await ensureOpenDevice();
  if (!led) return false;

  try {
    const red = clampRgb(r);
    const green = clampRgb(g);
    const blue = clampRgb(b);

    if (led.kind === "ds4") {
      await sendDs4Lightbar(led.device, red, green, blue);
    } else {
      await sendDualSenseLightbar(led.device, red, green, blue);
    }
    return true;
  } catch {
    cachedDevice = null;
    return false;
  }
}

export async function applyThemeLed(theme: VisualTheme): Promise<boolean> {
  const color = THEME_LED_COLORS[theme];
  return setControllerLedColor(color.r, color.g, color.b);
}

export function resetCachedLedDevice(): void {
  if (cachedDevice?.device.opened) {
    cachedDevice.device.close().catch(() => undefined);
  }
  cachedDevice = null;
}
