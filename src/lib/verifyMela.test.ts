import { describe, expect, it } from "vitest";

import { allOk, checkReceipt, receiverMatches, type Receipt } from "./verifyMela";

const base: Receipt = {
  provider: "telebirr",
  reference: "DKATEST001",
  status: "Completed",
  payer: { name: "Kebede Alemu", account: "2519****1670" },
  receiver: { name: "EYOEL DEMIS", account: "2519****0001" },
  amount: 575,
  totalPaid: 576,
  currency: "ETB",
  paidAt: "2026-11-17T09:18:51Z",
  paidAtRaw: "17/11/2026 12:18:51",
  receiptUrl: null,
  cached: false,
};
const now = new Date("2026-11-18T09:00:00Z");

describe("checkReceipt", () => {
  it("passes a correct payment", () => {
    const c = checkReceipt(base, { amount: 575, receiverNames: ["Eyoel Demis"], now });
    expect(c).toEqual({ amount: "ok", receiver: "ok", status: "ok", recent: "ok" });
    expect(allOk(c)).toBe(true);
  });

  it("fails a short amount, wrong receiver, old payment", () => {
    const c = checkReceipt(
      {
        ...base,
        amount: 500,
        receiver: { name: "Someone Else", account: null },
        paidAt: "2026-10-01T00:00:00Z",
      },
      { amount: 575, receiverNames: ["Eyoel Demis"], now },
    );
    expect(c.amount).toBe("fail");
    expect(c.receiver).toBe("fail");
    expect(c.recent).toBe("fail");
  });

  it("treats a null status as settled and unset receiver names as unknown", () => {
    const c = checkReceipt({ ...base, status: null }, { amount: 575, receiverNames: [], now });
    expect(c.status).toBe("ok");
    expect(c.receiver).toBe("unknown");
    expect(allOk(c)).toBe(false);
  });

  it("compares status case-insensitively", () => {
    expect(
      checkReceipt({ ...base, status: "COMPLETED" }, { amount: 1, receiverNames: [], now }).status,
    ).toBe("ok");
    expect(
      checkReceipt({ ...base, status: "Failed" }, { amount: 1, receiverNames: [], now }).status,
    ).toBe("fail");
  });
});

describe("receiverMatches", () => {
  it("ignores case, order and extra words", () => {
    expect(receiverMatches("DEMIS EYOEL TESFAYE", ["Eyoel Demis"])).toBe(true);
    expect(receiverMatches("Eyoel", ["Eyoel Demis"])).toBe(false);
    expect(receiverMatches(null, ["Eyoel Demis"])).toBe(false);
  });
});
