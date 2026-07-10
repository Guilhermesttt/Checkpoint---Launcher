import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Mouse, MouseRight, Plus, Settings, UserPlus } from "lucide-react";
import { useGamepad, type GamepadButtonName } from "../../context/GamepadContext";

import psCross from "../../assets/PlayStation Series/Vector/playstation_button_cross.svg?raw";
import psCircle from "../../assets/PlayStation Series/Vector/playstation_button_circle.svg?raw";
import psSquare from "../../assets/PlayStation Series/Vector/playstation_button_square.svg?raw";
import psTriangle from "../../assets/PlayStation Series/Vector/playstation_button_triangle.svg?raw";
import psL1 from "../../assets/PlayStation Series/Vector/playstation_trigger_l1.svg?raw";
import psR1 from "../../assets/PlayStation Series/Vector/playstation_trigger_r1.svg?raw";
import psL2 from "../../assets/PlayStation Series/Vector/playstation_trigger_l2.svg?raw";
import psR2 from "../../assets/PlayStation Series/Vector/playstation_trigger_r2.svg?raw";
import psOptions from "../../assets/PlayStation Series/Vector/playstation5_button_options.svg?raw";
import psShare from "../../assets/PlayStation Series/Vector/playstation5_button_create.svg?raw";
import psDpadHorizontal from "../../assets/PlayStation Series/Vector/playstation_dpad_horizontal_outline.svg?raw";
import psRightStickVertical from "../../assets/PlayStation Series/Vector/playstation_stick_r_vertical.svg?raw";

type ExtraHintButton = "L1_R1" | "L2_R2" | "DPAD" | "CONTEXT" | "SCROLL";

export interface InputHintProps {
  hints: Array<{
    button: GamepadButtonName | ExtraHintButton;
    label: string;
  }>;
}

const KeyboardHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="min-w-6 rounded-md border border-white/20 px-1.5 py-0.5 text-center font-sans text-[10px] font-bold">
    {children}
  </kbd>
);

const PsIcon: React.FC<{ svg: string; label: string; className?: string }> = ({
  svg,
  label,
  className = "h-5 w-5",
}) => {
  const markup = React.useMemo(
    () => {
      const withViewBox = svg.includes("viewBox=")
        ? svg
        : svg.replace(/<svg([^>]*)width="(\d+)"([^>]*)height="(\d+)"([^>]*)>/, '<svg$1$3$5 viewBox="0 0 $2 $4">');

      return withViewBox
        .replace(/\swidth="[^"]*"/, "")
        .replace(/\sheight="[^"]*"/, "")
        .replace(
          "<svg ",
          '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
        );
    },
    [svg],
  );

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center text-white opacity-85 ${className}`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

const getPCHint = (button: string) => {
  switch (button) {
    case "X":
      return <CornerDownLeft className="h-3.5 w-3.5" />;
    case "O":
      return <KeyboardHint>ESC</KeyboardHint>;
    case "SQUARE":
      return <KeyboardHint>F</KeyboardHint>;
    case "TRIANGLE":
      return <Plus className="h-3.5 w-3.5" />;
    case "L1":
    case "R1":
    case "L1_R1":
    case "L2_R2":
      return <KeyboardHint>TAB</KeyboardHint>;
    case "OPTIONS":
      return <Settings className="h-3.5 w-3.5" />;
    case "SHARE":
      return <UserPlus className="h-3.5 w-3.5" />;
    case "DPAD":
      return <span className="text-[12px] font-bold">{"\u2190 \u2192"}</span>;
    case "SCROLL":
      return (
        <span className="flex items-center gap-1">
          <Mouse className="h-3.5 w-3.5" />
          <span className="text-[12px] font-bold">{"\u2195"}</span>
        </span>
      );
    case "CONTEXT":
      return <MouseRight className="h-3.5 w-3.5" />;
    default:
      return <KeyboardHint>{button}</KeyboardHint>;
  }
};

const getPSHint = (button: string) => {
  switch (button) {
    case "X":
      return <PsIcon svg={psCross} label="Cross" />;
    case "O":
      return <PsIcon svg={psCircle} label="Circle" />;
    case "SQUARE":
      return <PsIcon svg={psSquare} label="Square" />;
    case "TRIANGLE":
      return <PsIcon svg={psTriangle} label="Triangle" />;
    case "L1":
      return <PsIcon svg={psL1} label="L1" className="h-6 w-6" />;
    case "R1":
      return <PsIcon svg={psR1} label="R1" className="h-6 w-6" />;
    case "L1_R1":
      return (
        <div className="flex items-center gap-0.5">
          <PsIcon svg={psL1} label="L1" className="h-6 w-6" />
          <PsIcon svg={psR1} label="R1" className="h-6 w-6" />
        </div>
      );
    case "L2_R2":
      return (
        <div className="flex items-center gap-0.5">
          <PsIcon svg={psL2} label="L2" className="h-6 w-6" />
          <PsIcon svg={psR2} label="R2" className="h-6 w-6" />
        </div>
      );
    case "OPTIONS":
      return <PsIcon svg={psShare} label="Options" className="h-6 w-6" />;
    case "SHARE":
      return <PsIcon svg={psOptions} label="Create" className="h-6 w-6" />;
    case "DPAD":
      return <PsIcon svg={psDpadHorizontal} label="D-pad" className="h-6 w-6" />;
    case "SCROLL":
      return <PsIcon svg={psRightStickVertical} label="Right stick vertical" className="h-6 w-6" />;
    default:
      return null;
  }
};

const getXboxHint = (button: string) => {
  const xboxMap: Record<string, string> = {
    X: "A",
    O: "B",
    SQUARE: "X",
    TRIANGLE: "Y",
    L1: "LB",
    R1: "RB",
    L2: "LT",
    R2: "RT",
    L1_R1: "LB/RB",
    L2_R2: "LT/RT",
    DPAD: "D-Pad",
    SCROLL: "RS",
    SHARE: "View",
    OPTIONS: "Menu",
  };

  return <KeyboardHint>{xboxMap[button] ?? button}</KeyboardHint>;
};

const InputHints: React.FC<InputHintProps> = ({ hints }) => {
  const { activeInputType, isGamepadConnected, gamepadFamily } = useGamepad();
  const isGamepad = activeInputType === "gamepad" && isGamepadConnected;

  const renderHint = (button: string) => {
    if (!isGamepad) return getPCHint(button);
    if (gamepadFamily === "xbox") return getXboxHint(button);
    return getPSHint(button);
  };

  return (
    <div className="relative flex h-7 items-center gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={isGamepad ? "gamepad" : "pc"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 flex items-center gap-6 whitespace-nowrap"
        >
          {hints.map((hint, idx) => (
            <div key={`${hint.button}-${idx}`} className="flex items-center gap-2">
              <span style={{ color: "rgba(255,255,255,0.4)" }} className="flex items-center">
                {renderHint(hint.button)}
              </span>
              <span
                className="text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                {hint.label}
              </span>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default InputHints;
