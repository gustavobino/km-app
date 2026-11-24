import { describe, expect, it } from "vitest";
import {
  appLabel,
  defaultEarningRows,
  emptyForm,
  formFromDay,
  liveSummary,
  parseDayForm,
  parseLiters,
  type DayForm,
  type StoredDay,
} from "./form";

let n = 0;
const ids = () => `id-${++n}`;

function fill(form: DayForm, values: Record<string, string>): DayForm {
  return {
    ...form,
    earnings: form.earnings.map((r) => ({
      ...r,
      amount: values[appLabel(r.source, r.label)] ?? r.amount,
    })),
  };
}

describe("defaultEarningRows", () => {
  it("follows the onboarding apps", () => {
    expect(
      defaultEarningRows(["uber", "inDrive"]).map((r) => [
        r.source,
        r.label,
        r.custom,
      ]),
    ).toEqual([
      ["uber", "", false],
      ["other", "inDrive", false],
    ]);
  });
  it("shows Uber, 99 and an editable 'Outro app' without an answer", () => {
    expect(defaultEarningRows([]).map((r) => [r.source, r.custom])).toEqual([
      ["uber", false],
      ["99", false],
      ["other", true],
    ]);
  });
  it("labels apps", () => {
    expect(appLabel("uber", null)).toBe("Uber");
    expect(appLabel("99", null)).toBe("99");
    expect(appLabel("other", " inDrive ")).toBe("inDrive");
    expect(appLabel("other", "")).toBe("Outro app");
  });
});

describe("parseDayForm", () => {
  const base = () => emptyForm("2026-11-23", ["uber", "99", "inDrive"]);

  it("parses the CLAUDE.md example day", () => {
    const form: DayForm = {
      ...fill(base(), { Uber: "212,50", "99": "98", inDrive: "40,00" }),
      hours: "8,5",
      km: "142",
      expenses: [
        {
          key: "a",
          category: "fuel",
          label: "",
          amount: "85,00",
          liters: "14,2",
          odometer: "52340",
          fullTank: true,
        },
        {
          key: "b",
          category: "food",
          label: "",
          amount: "22",
          liters: "9",
          odometer: "1",
          fullTank: true,
        },
      ],
      shifts: ["evening"],
      note: "  ",
    };
    const r = parseDayForm(form, ids);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.day).toMatchObject({
      date: "2026-11-23",
      minutes: 510,
      km: 142,
      isDayOff: false,
      shifts: ["evening"],
      note: null,
    });
    expect(
      r.day.earnings.map((e) => [e.source, e.label, e.amountCents]),
    ).toEqual([
      ["uber", null, 21250],
      ["99", null, 9800],
      ["other", "inDrive", 4000],
    ]);
    expect(r.day.expenses).toEqual([
      expect.objectContaining({
        category: "fuel",
        amountCents: 8500,
        liters: 14.2,
        odometerKm: 52340,
        fullTank: true,
      }),
      // Liters/odometer only apply to fuel.
      expect.objectContaining({
        category: "food",
        amountCents: 2200,
        liters: null,
        odometerKm: null,
        fullTank: null,
      }),
    ]);
  });

  it("needs at least one earning unless it is a day off", () => {
    expect(parseDayForm(base(), ids)).toEqual({
      ok: false,
      errors: {
        form: "Informe pelo menos um ganho, ou marque como dia de folga.",
      },
    });
  });

  it("accepts a day with only expenses", () => {
    const r = parseDayForm(
      {
        ...base(),
        expenses: [
          {
            key: "w",
            category: "wash",
            label: "",
            amount: "30",
            liters: "",
            odometer: "",
            fullTank: false,
          },
        ],
      },
      ids,
    );
    expect(r.ok).toBe(true);
  });

  it("reports invalid fields by key", () => {
    const form = fill(base(), { Uber: "12,345" });
    const uberKey = form.earnings[0]!.key;
    const r = parseDayForm(
      {
        ...form,
        hours: "25",
        km: "1,5",
        expenses: [
          {
            key: "f",
            category: "fuel",
            label: "",
            amount: "50",
            liters: "abc",
            odometer: "1.2",
            fullTank: false,
          },
          {
            key: "z",
            category: "other",
            label: "x",
            amount: "",
            liters: "",
            odometer: "",
            fullTank: false,
          },
        ],
      },
      ids,
    );
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      [
        `earning:${uberKey}`,
        "hours",
        "km",
        "liters:f",
        "odometer:f",
        "expense:z",
      ].sort(),
    );
  });

  it("rejects absurd km", () => {
    const r = parseDayForm(
      { ...fill(base(), { Uber: "10" }), km: "5000" },
      ids,
    );
    expect(r.errors.km).toBeDefined();
  });

  it("skips zero earnings and trims labels", () => {
    const form = emptyForm("2026-11-23", []);
    form.earnings[0]!.amount = "0";
    form.earnings[2]!.amount = "40";
    form.earnings[2]!.label = "  Lady Driver  ";
    const r = parseDayForm(form, ids);
    expect(r.ok && r.day.earnings.map((e) => [e.source, e.label])).toEqual([
      ["other", "Lady Driver"],
    ]);
    form.earnings[2]!.label = "";
    const r2 = parseDayForm(form, ids);
    expect(r2.ok && r2.day.earnings[0]!.label).toBeNull();
  });

  it("splits hours between apps and derives the total", () => {
    const form = {
      ...fill(base(), { Uber: "200", "99": "100" }),
      splitHours: true,
    };
    form.earnings[0]!.hours = "5";
    form.earnings[1]!.hours = "3h30";
    const r = parseDayForm(form, ids);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.day.minutes).toBe(510);
    expect(r.day.earnings.map((e) => e.minutes)).toEqual([300, 210]);

    // An explicit total wins over the sum.
    const r2 = parseDayForm({ ...form, hours: "9" }, ids);
    expect(r2.ok && r2.day.minutes).toBe(540);

    form.earnings[1]!.hours = "x";
    const bad = parseDayForm(form, ids);
    expect(bad.errors[`earningHours:${form.earnings[1]!.key}`]).toBeDefined();

    // Ignores per-app hours when splitting is off.
    const off = parseDayForm({ ...form, splitHours: false }, ids);
    expect(off.ok && off.day.earnings.every((e) => e.minutes === null)).toBe(
      true,
    );
    expect(off.ok && off.day.minutes).toBeNull();
  });

  it("keeps an app with hours but zero value when splitting", () => {
    const form = { ...fill(base(), { Uber: "0" }), splitHours: true };
    form.earnings[0]!.hours = "2";
    const r = parseDayForm(form, ids);
    expect(r.ok && r.day.earnings).toHaveLength(1);
  });

  it("stores a day off without earnings, hours or shifts", () => {
    const r = parseDayForm(
      {
        ...fill(base(), { Uber: "100" }),
        isDayOff: true,
        hours: "8",
        km: "10",
        shifts: ["morning"],
      },
      ids,
    );
    expect(r.ok && r.day).toMatchObject({
      isDayOff: true,
      earnings: [],
      minutes: null,
      km: null,
      shifts: null,
    });
  });
});

describe("parseLiters", () => {
  it.each([
    ["14,2", 14.2],
    ["32.555", 32.555],
    ["40", 40],
    ["0", null],
    ["abc", null],
    ["1,2345", null],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(parseLiters(input)).toBe(expected);
  });
});

describe("formFromDay", () => {
  const saved: StoredDay = {
    id: "d1",
    date: "2026-11-23",
    minutes: 510,
    km: 142,
    isDayOff: false,
    shifts: ["night"],
    note: "chuva",
    earnings: [
      {
        id: "e1",
        source: "uber",
        label: null,
        amountCents: 21250,
        minutes: 300,
      },
      {
        id: "e2",
        source: "other",
        label: "inDrive",
        amountCents: 4000,
        minutes: null,
      },
      {
        id: "e3",
        source: "other",
        label: "Garupa",
        amountCents: 1500,
        minutes: null,
      },
    ],
    expenses: [
      {
        id: "x1",
        category: "fuel",
        label: null,
        amountCents: 8500,
        liters: 14.2,
        odometerKm: 52340,
        fullTank: true,
      },
      {
        id: "x2",
        category: "food",
        label: null,
        amountCents: 2200,
        liters: null,
        odometerKm: null,
        fullTank: null,
      },
    ],
  };

  it("round-trips through parseDayForm", () => {
    const form = formFromDay(saved, ["uber", "99", "inDrive"]);
    expect(
      form.earnings.map((r) => [
        appLabel(r.source, r.label),
        r.amount,
        r.hours,
      ]),
    ).toEqual([
      ["Uber", "212,50", "5"],
      ["99", "", ""],
      ["inDrive", "40,00", ""],
      ["Garupa", "15,00", ""],
    ]);
    expect(form).toMatchObject({
      hours: "8,5",
      km: "142",
      splitHours: true,
      shifts: ["night"],
      note: "chuva",
    });
    expect(form.expenses[0]).toMatchObject({
      amount: "85,00",
      liters: "14,2",
      odometer: "52340",
      fullTank: true,
    });
    expect(form.expenses[1]).toMatchObject({
      liters: "",
      odometer: "",
      fullTank: false,
    });

    const r = parseDayForm(form, ids);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const strip = <T extends { id: string }>(xs: T[]) =>
      xs.map((x) => ({ ...x, id: "" }));
    expect(strip(r.day.earnings)).toEqual(strip(saved.earnings));
    expect(strip(r.day.expenses)).toEqual(strip(saved.expenses));
  });

  it("puts a named other app into the empty 'Outro app' row", () => {
    const form = formFromDay(saved, []);
    expect(form.earnings.map((r) => appLabel(r.source, r.label))).toEqual([
      "Uber",
      "99",
      "inDrive",
      "Garupa",
    ]);
  });

  it("restores an empty day", () => {
    const form = formFromDay(
      {
        ...saved,
        minutes: null,
        km: null,
        shifts: null,
        note: null,
        earnings: [],
        expenses: [],
        isDayOff: true,
      },
      ["uber"],
    );
    expect(form).toMatchObject({
      hours: "",
      km: "",
      shifts: [],
      note: "",
      splitHours: false,
      isDayOff: true,
    });
  });
});

describe("liveSummary", () => {
  it("updates while typing and ignores invalid fields", () => {
    const form: DayForm = {
      ...fill(emptyForm("2026-11-23", ["uber", "99", "inDrive"]), {
        Uber: "212,50",
        "99": "98,00",
        inDrive: "40,0x",
      }),
      hours: "8,5",
      km: "142",
      expenses: [
        {
          key: "a",
          category: "fuel",
          label: "",
          amount: "85",
          liters: "",
          odometer: "",
          fullTank: false,
        },
        {
          key: "b",
          category: "food",
          label: "",
          amount: "22,00",
          liters: "",
          odometer: "",
          fullTank: false,
        },
      ],
    };
    const s = liveSummary(form, []);
    expect(s.netCents).toBe(31050 - 10700);
    expect(s.grossPerHourCents).toBe(3653);
    expect(s.grossPerKmCents).toBe(219);
  });

  it("uses split hours when there is no total", () => {
    const form = {
      ...fill(emptyForm("2026-11-23", ["uber"]), { Uber: "100" }),
      splitHours: true,
    };
    form.earnings[0]!.hours = "2";
    expect(liveSummary(form, []).grossPerHourCents).toBe(5000);
    form.earnings[0]!.hours = "";
    expect(liveSummary(form, []).grossPerHourCents).toBeNull();
  });

  it("is zero on a day off (expenses still count)", () => {
    const form = {
      ...fill(emptyForm("2026-11-23", ["uber"]), { Uber: "100" }),
      isDayOff: true,
      hours: "8",
    };
    expect(liveSummary(form, [])).toMatchObject({
      grossCents: 0,
      minutes: null,
    });
  });

  it("applies platform fees", () => {
    const form = fill(emptyForm("2026-11-23", ["uber"]), { Uber: "100" });
    const s = liveSummary(form, [
      {
        source: "uber",
        label: null,
        mode: "percent",
        percent: 25,
        passCents: null,
        passPeriod: null,
      },
    ]);
    expect(s.netCents).toBe(7500);
  });
});

describe("zeroing a saved day", () => {
  it("an empty form is an error for a new day but zeroes a saved one", () => {
    const empty = emptyForm("2026-11-23", ["uber"]);
    expect(parseDayForm(empty, ids).ok).toBe(false);
    const r = parseDayForm(empty, ids, { allowEmpty: true });
    expect(r.ok && r.day).toMatchObject({
      earnings: [],
      expenses: [],
      minutes: null,
      km: null,
      isDayOff: false,
    });
  });
  it("still reports invalid fields when zeroing", () => {
    const form = { ...emptyForm("2026-11-23", ["uber"]), hours: "99" };
    expect(
      parseDayForm(form, ids, { allowEmpty: true }).errors.hours,
    ).toBeDefined();
  });
});
