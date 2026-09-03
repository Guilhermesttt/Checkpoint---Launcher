// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startControllerBatteryMonitoring,
  getControllerBatteryState,
  subscribeControllerBattery,
} from "../src/services/controllerBatteryService";

describe("controllerBatteryService", () => {
  let stopMonitoring: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (stopMonitoring) {
      stopMonitoring();
      stopMonitoring = null;
    }
    vi.restoreAllMocks();
  });

  it("retorna estado inicial quando nenhum controle foi consultado", () => {
    const state = getControllerBatteryState();
    expect(state).toBeDefined();
    expect(state.isCharging).toBe(false);
  });

  it("consulta electronAPI.getControllerBattery e atualiza o estado", async () => {
    const mockElectronBattery = vi.fn().mockResolvedValue({
      connected: true,
      batteryLevel: 85,
      isCharging: false,
      connectionType: "bluetooth",
      deviceName: "DualShock 4 Wireless Controller",
    });

    (window as any).electronAPI = {
      getControllerBattery: mockElectronBattery,
    };

    const listener = vi.fn();
    const unsubscribe = subscribeControllerBattery(listener);

    stopMonitoring = startControllerBatteryMonitoring();

    // Aguarda microtarefas e timers
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    expect(mockElectronBattery).toHaveBeenCalled();
    expect(getControllerBatteryState().batteryLevel).toBe(85);
    expect(getControllerBatteryState().connectionType).toBe("bluetooth");

    unsubscribe();
  });

  it("dispara evento checkpoint:low-battery quando bateria bluetooth <= 20%", async () => {
    const lowBatListener = vi.fn();
    window.addEventListener("checkpoint:low-battery", lowBatListener);

    (window as any).electronAPI = {
      getControllerBattery: vi.fn().mockResolvedValue({
        connected: true,
        batteryLevel: 15,
        isCharging: false,
        connectionType: "bluetooth",
        deviceName: "DualSense Wireless Controller",
      }),
    };

    stopMonitoring = startControllerBatteryMonitoring();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    expect(lowBatListener).toHaveBeenCalled();
    const event = lowBatListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail.level).toBe(15);
    expect(event.detail.isCritical).toBe(false);

    window.removeEventListener("checkpoint:low-battery", lowBatListener);
  });
});

