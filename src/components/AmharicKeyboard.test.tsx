import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { AmharicKeyboardProvider } from "./AmharicKeyboard";

/** A React-controlled box, like every field in the app. */
function Box({ type = "text" }: { type?: string }) {
  const [v, setV] = useState("");
  return <input aria-label="box" type={type} value={v} onChange={(e) => setV(e.target.value)} />;
}

function typeKeys(el: HTMLInputElement, keys: string) {
  for (const key of keys) {
    const notHandled = fireEvent.keyDown(el, { key });
    // keys the keyboard leaves alone (space, digits…) are typed by the "browser"
    if (notHandled && key.length === 1) {
      if (el.type !== "text") {
        fireEvent.change(el, { target: { value: el.value + key } }); // no cursor in email boxes
        continue;
      }
      const pos = el.selectionStart ?? el.value.length;
      const next = el.value.slice(0, pos) + key + el.value.slice(pos);
      fireEvent.change(el, { target: { value: next } });
      el.setSelectionRange(pos + 1, pos + 1);
    }
  }
}

function setup(on: boolean, type?: string) {
  localStorage.setItem("debdabe.amharicKeyboard", on ? "on" : "off");
  render(
    <AmharicKeyboardProvider>
      <Box {...(type ? { type } : {})} />
    </AmharicKeyboardProvider>,
  );
  const el = screen.getByLabelText("box") as HTMLInputElement;
  el.focus();
  return el;
}

describe("live Amharic keyboard", () => {
  beforeEach(() => localStorage.clear());

  it("turns typed sounds into Amharic, letter by letter", () => {
    const el = setup(true);
    typeKeys(el, "selam abebe");
    expect(el.value).toBe("ሰላም አበበ");
  });

  it("numbers and punctuation pass through", () => {
    const el = setup(true);
    typeKeys(el, "br 25,000");
    expect(el.value).toBe("ብር 25,000");
  });

  it("does nothing when the toggle is off", () => {
    const el = setup(false);
    typeKeys(el, "selam");
    expect(el.value).toBe("selam");
  });

  it("leaves email boxes alone", () => {
    const el = setup(true, "email");
    typeKeys(el, "abebe");
    expect(el.value).toBe("abebe");
  });

  it("offers same-sounding letters and keeps the pick when a vowel follows", () => {
    const el = setup(true);
    typeKeys(el, "h");
    expect(el.value).toBe("ህ");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(el, { key: "2" }); // pick ሕ
    });
    expect(el.value).toBe("ሕ");
    typeKeys(el, "a");
    expect(el.value).toBe("ሓ"); // still the ሐ family
  });

  it("doubled letters count once", () => {
    const el = setup(true);
    typeKeys(el, "addis");
    expect(el.value).toBe("አዲስ");
  });
});
