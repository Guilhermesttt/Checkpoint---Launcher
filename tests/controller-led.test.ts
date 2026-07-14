import { describe, expect, it } from "vitest";
import {
  buildDs4BluetoothLightbarReport,
  buildDs4UsbLightbarReport,
  THEME_ACCENT_COLORS,
  THEME_LED_COLORS,
} from "../src/services/controllerLed";

describe("pacotes de LED do DualShock 4", () => {
  it("monta o output report USB 0x05 com os canais RGB corretos", () => {
    const report = buildDs4UsbLightbarReport(300, -10, 127.6);

    expect(report).toHaveLength(31);
    expect(report[0]).toBe(0x07);
    expect(Array.from(report.slice(3, 5))).toEqual([0, 0]);
    expect(Array.from(report.slice(5, 8))).toEqual([255, 0, 128]);
  });

  it("monta o output report Bluetooth 0x11 com flags, RGB e CRC", () => {
    const report = buildDs4BluetoothLightbarReport(10, 20, 30);

    expect(report).toHaveLength(77);
    expect(report[0]).toBe(0xc0);
    expect(report[2]).toBe(0x07);
    expect(Array.from(report.slice(5, 7))).toEqual([0, 0]);
    expect(Array.from(report.slice(7, 10))).toEqual([10, 20, 30]);
    expect(Array.from(report.slice(-4))).not.toEqual([0, 0, 0, 0]);
  });

});

describe("cores dos temas na lightbar", () => {
  it("mantem o accent da interface separado dos presets físicos escolhidos", () => {
    expect(THEME_ACCENT_COLORS.playstation).toEqual({ r: 37, g: 99, b: 235 });
    expect(THEME_LED_COLORS.checkpoint).toEqual({ r: 255, g: 255, b: 255 });
    expect(THEME_LED_COLORS.playstation).toEqual({ r: 0, g: 4, b: 255 });
    expect(THEME_LED_COLORS.gamecube).toEqual({ r: 167, g: 0, b: 255 });
    expect(THEME_LED_COLORS.xbox360).toEqual({ r: 33, g: 255, b: 0 });
  });
});
