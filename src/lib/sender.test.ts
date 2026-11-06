import { describe, expect, it } from "vitest";

import { defaultSender, readSender, writeSender } from "./letters";

const org = { name_am: "ናሙና", name_en: "Namuna", tin: "123", address: "Bole", phone: "", email: "" };
const signer = { name_am: "አቶ ሰለሞን", position_am: "ዋና ሥራ አስኪያጅ" };

describe("sender per letter", () => {
  it("defaults come from Settings", () => {
    const s = defaultSender(org, signer);
    expect(s.org_name_am).toBe("ናሙና");
    expect(s.signer_name).toBe("አቶ ሰለሞን");
    expect(defaultSender(org, null).signer_name).toBe("");
  });

  it("a letter's own values win, including cleared ones", () => {
    const stored = writeSender(
      { employee_name: "አስቴር" },
      { ...defaultSender(org, signer), tin: " 999 ", signer_name: "ወ/ሮ ሔለን", phone: "" },
    );
    expect(stored["employee_name"]).toBe("አስቴር");
    const back = readSender(stored, defaultSender({ ...org, phone: "011" }, signer));
    expect(back.tin).toBe("999");
    expect(back.signer_name).toBe("ወ/ሮ ሔለን");
    expect(back.phone).toBe("");
  });

  it("older letters without stored values use Settings", () => {
    expect(readSender({ title: "አቶ" }, defaultSender(org, signer)).tin).toBe("123");
  });
});
