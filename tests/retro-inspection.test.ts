import { describe, expect, it } from "vitest";

import {
  INITIAL_RETRO_INSPECTION_STATE,
  reduceRetroInspection,
} from "../src/features/retro/retroInspection";

describe("retro game case inspection", () => {
  it("opens the selected case on the first confirmation", () => {
    expect(
      reduceRetroInspection(INITIAL_RETRO_INSPECTION_STATE, {
        type: "CONFIRM",
        index: 2,
      }),
    ).toEqual({ inspectedIndex: 2, playRequested: false });
  });

  it("requests play on the second confirmation of the open case", () => {
    expect(
      reduceRetroInspection(
        { inspectedIndex: 2, playRequested: false },
        { type: "CONFIRM", index: 2 },
      ),
    ).toEqual({ inspectedIndex: 2, playRequested: true });
  });

  it("retargets confirmation to a different case without requesting play", () => {
    expect(
      reduceRetroInspection(
        { inspectedIndex: 2, playRequested: false },
        { type: "CONFIRM", index: 4 },
      ),
    ).toEqual({ inspectedIndex: 4, playRequested: false });
  });

  it("closes inspection whenever selection changes", () => {
    expect(
      reduceRetroInspection(
        { inspectedIndex: 2, playRequested: true },
        { type: "SELECT" },
      ),
    ).toEqual(INITIAL_RETRO_INSPECTION_STATE);
  });

  it("closes an open case before allowing page cancellation", () => {
    expect(
      reduceRetroInspection(
        { inspectedIndex: 2, playRequested: false },
        { type: "CANCEL" },
      ),
    ).toEqual(INITIAL_RETRO_INSPECTION_STATE);
  });

  it("keeps a closed case unchanged when cancelled", () => {
    expect(reduceRetroInspection(INITIAL_RETRO_INSPECTION_STATE, { type: "CANCEL" })).toBe(
      INITIAL_RETRO_INSPECTION_STATE,
    );
  });

  it("clears a handled play request without closing the case", () => {
    expect(
      reduceRetroInspection(
        { inspectedIndex: 2, playRequested: true },
        { type: "PLAY_HANDLED" },
      ),
    ).toEqual({ inspectedIndex: 2, playRequested: false });
  });
});
