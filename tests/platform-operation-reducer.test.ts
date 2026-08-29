import { describe, expect, it } from "vitest";
import {
  createInitialPlatformOperationsState,
  getPlatformPhaseLabel,
  isPlatformBusy,
  platformOperationReducer,
} from "../src/utils/platformOperationReducer";

describe("platformOperationReducer", () => {
  const idle = createInitialPlatformOperationsState();

  it("tracks Steam and Epic independently", () => {
    const state = platformOperationReducer(idle, {
      type: "START_SYNC",
      platform: "epic",
      operationId: "op-epic-1",
      phase: "reading-library",
    });
    expect(state.epic).toMatchObject({
      status: "syncing",
      operationId: "op-epic-1",
      phase: "reading-library",
    });
    expect(state.steam).toEqual({ status: "idle" });
  });

  it("rejects duplicate active work for the same platform", () => {
    const syncing = platformOperationReducer(idle, {
      type: "START_SYNC",
      platform: "steam",
      operationId: "op-steam-1",
      phase: "reading-library",
    });
    expect(() =>
      platformOperationReducer(syncing, {
        type: "START_DISCONNECT",
        platform: "steam",
        operationId: "op-steam-2",
        phase: "revoking-account",
      }),
    ).toThrow("Operacao Steam ja esta em andamento.");
  });

  it("advances phases only for matching operation ID", () => {
    const syncing = platformOperationReducer(idle, {
      type: "START_SYNC",
      platform: "steam",
      operationId: "op-steam-1",
      phase: "reading-library",
    });

    const updated = platformOperationReducer(syncing, {
      type: "UPDATE_PHASE",
      platform: "steam",
      operationId: "op-steam-1",
      phase: "enriching-games",
      completed: 5,
      total: 10,
    });

    expect(updated.steam).toMatchObject({
      status: "syncing",
      phase: "enriching-games",
      completed: 5,
      total: 10,
    });

    // Stale operation ID is ignored or throws
    const ignored = platformOperationReducer(updated, {
      type: "UPDATE_PHASE",
      platform: "steam",
      operationId: "op-stale-99",
      phase: "saving-games",
    });
    expect(ignored.steam).toEqual(updated.steam);
  });

  it("transitions to idle on finish success", () => {
    const syncing = platformOperationReducer(idle, {
      type: "START_SYNC",
      platform: "epic",
      operationId: "op-epic-1",
      phase: "reading-library",
    });

    const finished = platformOperationReducer(syncing, {
      type: "FINISH_SUCCESS",
      platform: "epic",
      operationId: "op-epic-1",
    });

    expect(finished.epic).toEqual({ status: "idle" });
  });

  it("transitions to error state and allows reset", () => {
    const connecting = platformOperationReducer(idle, {
      type: "START_CONNECT",
      platform: "epic",
      operationId: "op-epic-1",
      phase: "authenticating",
    });

    const errored = platformOperationReducer(connecting, {
      type: "FAIL_ERROR",
      platform: "epic",
      operationId: "op-epic-1",
      operation: "connect",
      message: "Falha ao autenticar",
    });

    expect(errored.epic).toEqual({
      status: "error",
      operationId: "op-epic-1",
      operation: "connect",
      message: "Falha ao autenticar",
    });

    const reset = platformOperationReducer(errored, {
      type: "RESET",
      platform: "epic",
    });
    expect(reset.epic).toEqual({ status: "idle" });
  });

  it("isPlatformBusy helper reports correctly", () => {
    expect(isPlatformBusy(idle, "steam")).toBe(false);
    expect(isPlatformBusy(idle, "epic")).toBe(false);

    const syncing = platformOperationReducer(idle, {
      type: "START_SYNC",
      platform: "steam",
      operationId: "op-1",
    });
    expect(isPlatformBusy(syncing, "steam")).toBe(true);
    expect(isPlatformBusy(syncing, "epic")).toBe(false);
  });

  it("returns human-readable labels for phases", () => {
    expect(getPlatformPhaseLabel("reading-library")).toContain("Lendo biblioteca");
    expect(getPlatformPhaseLabel("revoking-account")).toContain("Revogando conta");
    expect(getPlatformPhaseLabel("removing-local-data")).toContain("Removendo dados locais");
    expect(getPlatformPhaseLabel("removing-cloud-data")).toContain("Removendo dados da nuvem");
  });
});
