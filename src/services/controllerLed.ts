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
  for (const device of devices) {
    if (device.vendorId === SONY_VENDOR_ID && SONY_LED_PRODUCT_IDS.has(device.productId)) {
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
  // DualShock 4 USB output report 0x05. WebHID receives the reportId separately.
  const report = new Uint8Array(31);
  report[0] = 0xff;
  report[1] = 0x04;
  report[2] = 0x00;
  report[3] = 0x00; // small rumble
  report[4] = 0x00; // big rumble
  report[5] = r;
  report[6] = g;
  report[7] = b;
  report[8] = 0x00; // flash on
  report[9] = 0x00; // flash off
  await device.sendReport(0x05, report);
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
