import { describe, expect, it } from "vitest";
import {
  isDayClosed,
  reminderMessage,
  reminderSlot,
  reminderTimes,
} from "./reminders";

describe("reminderSlot", () => {
  it.each([
    ["2026-11-25T23:37:10Z", "2026-11-25", "20:30"], // 20:37 in São Paulo (UTC−3)
    ["2026-11-26T02:59:00Z", "2026-11-25", "23:45"],
    ["2026-11-26T03:00:00Z", "2026-11-26", "00:00"],
    ["2026-11-25T12:14:59Z", "2026-11-25", "09:00"],
  ])("%s → %s %s", (iso, date, slot) => {
    expect(reminderSlot(new Date(iso))).toEqual({ date, slot });
  });
});

describe("reminderTimes", () => {
  it("offers 06:00 to 23:45 every 15 minutes", () => {
    const t = reminderTimes();
    expect(t[0]).toBe("06:00");
    expect(t.at(-1)).toBe("23:45");
    expect(t).toHaveLength(18 * 4);
    expect(t).toContain("20:30");
  });
});

describe("isDayClosed", () => {
  it("needs an earning or a day off", () => {
    expect(isDayClosed(null)).toBe(false);
    expect(isDayClosed({ is_day_off: false, earnings: [] })).toBe(false);
    expect(
      isDayClosed({ is_day_off: false, earnings: [{ amount_cents: 0 }] }),
    ).toBe(false);
    expect(
      isDayClosed({ is_day_off: false, earnings: [{ amount_cents: 100 }] }),
    ).toBe(true);
    expect(isDayClosed({ is_day_off: true, earnings: [] })).toBe(true);
  });
});

describe("reminderMessage", () => {
  it("is short, opens Registrar and varies by day", () => {
    const a = reminderMessage("2026-11-25");
    const b = reminderMessage("2026-11-26");
    expect(a.title).toBe("Km+");
    expect(a.url).toBe("/registrar");
    expect(a.body).not.toBe(b.body);
    for (const d of ["01", "02", "03"])
      expect(reminderMessage(`2026-11-${d}`).body.length).toBeLessThan(60);
  });
});
