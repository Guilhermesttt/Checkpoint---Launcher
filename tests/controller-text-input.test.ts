// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  CONTROLLER_KEYBOARD_EVENT,
  activateElementWithController,
  isControllerTextTarget,
  setControllerTextValue,
} from "../src/utils/controllerTextInput";

describe("entrada textual pelo controle", () => {
  it("abre teclado virtual para inputs textuais", () => {
    const input = document.createElement("input");
    input.type = "search";
    const listener = vi.fn();
    window.addEventListener(CONTROLLER_KEYBOARD_EVENT, listener);
    activateElementWithController(input);
    expect(listener).toHaveBeenCalledOnce();
    expect(isControllerTextTarget(input)).toBe(true);
  });

  it("aciona normalmente botoes", () => {
    const button = document.createElement("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    activateElementWithController(button);
    expect(click).toHaveBeenCalledOnce();
  });

  it("atualiza valor e dispara eventos compativeis com React", () => {
    const input = document.createElement("input");
    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener("input", onInput);
    input.addEventListener("change", onChange);
    setControllerTextValue(input, "checkpoint");
    expect(input.value).toBe("checkpoint");
    expect(onInput).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();
  });
});
