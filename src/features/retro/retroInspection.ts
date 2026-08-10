export interface RetroInspectionState {
  inspectedIndex: number | null;
  playRequested: boolean;
}

export type RetroInspectionEvent =
  | { type: "SELECT" }
  | { type: "CONFIRM"; index: number }
  | { type: "CANCEL" }
  | { type: "PLAY_HANDLED" };

export const INITIAL_RETRO_INSPECTION_STATE: RetroInspectionState = {
  inspectedIndex: null,
  playRequested: false,
};

export function reduceRetroInspection(
  state: RetroInspectionState,
  event: RetroInspectionEvent,
): RetroInspectionState {
  switch (event.type) {
    case "SELECT":
      if (state.inspectedIndex === null && !state.playRequested) return state;
      return INITIAL_RETRO_INSPECTION_STATE;
    case "CONFIRM":
      if (state.inspectedIndex !== event.index) {
        return { inspectedIndex: event.index, playRequested: false };
      }
      if (state.playRequested) return state;
      return { ...state, playRequested: true };
    case "CANCEL":
      if (state.inspectedIndex === null) return state;
      return INITIAL_RETRO_INSPECTION_STATE;
    case "PLAY_HANDLED":
      if (!state.playRequested) return state;
      return { ...state, playRequested: false };
  }
}
