import { buildExportFiles } from "./build";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { centsCell, toCsv } from "./csv";
import { crc32, zip } from "./zip";

describe("toCsv", () => {
  it("uses ; and a BOM, quotes when needed", () => {
    const csv = toCsv(
      ["data", "app", "valor"],
      [
        ["2026-11-23", "Uber", "212,50"],
        ["2026-11-23", 'Outro "app"; x', null],
        ["2026-11-24", "linha\nquebrada", true],
      ],
    );
    expect(csv).toBe(
      '﻿data;app;valor\r\n2026-11-23;Uber;212,50\r\n2026-11-23;"Outro ""app""; x";\r\n2026-11-24;"linha\nquebrada";sim\r\n',
    );
    expect(toCsv(["a"], [[false], [0]])).toBe("﻿a\r\nnão\r\n0\r\n");
  });

  it("neutralizes spreadsheet formulas but keeps negative numbers", () => {
    expect(
      toCsv(["x"], [["=HYPERLINK(1)"], ["-12,50"], ["@cmd"], ["-x"]]),
    ).toBe("﻿x\r\n'=HYPERLINK(1)\r\n-12,50\r\n'@cmd\r\n'-x\r\n");
  });

  it("formats cents", () => {
    expect(centsCell(21250)).toBe("212,50");
    expect(centsCell(5)).toBe("0,05");
    expect(centsCell(-10700)).toBe("-107,00");
    expect(centsCell(null)).toBe("");
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("produces a ZIP that unzip can read", () => {
    const bytes = zip(
      [
        { name: "dias.csv", content: "data;km\r\n2026-11-23;142\r\n" },
        { name: "ganhos.csv", content: "app;valor\r\nUber;212,50\r\nçãõ\r\n" },
      ],
      new Date("2026-11-24T12:00:00Z"),
    );
    const dir = mkdtempSync(join(tmpdir(), "kmzip-"));
    const file = join(dir, "dados.zip");
    writeFileSync(file, bytes);
    execFileSync("python3", [
      "-I",
      "-c",
      `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; z.extractall(sys.argv[2])`,
      file,
      dir,
    ]);
    expect(readFileSync(join(dir, "dias.csv"), "utf8")).toBe(
      "data;km\r\n2026-11-23;142\r\n",
    );
    expect(readFileSync(join(dir, "ganhos.csv"), "utf8")).toContain("çãõ");
  });
});

describe("buildExportFiles", () => {
  it("writes one CSV per kind of data", () => {
    const files = buildExportFiles({
      email: "m@email.com",
      profile: {
        apps: ["uber", "99"],
        monthly_goal_cents: 800000,
        vehicle_mode_enabled: true,
      },
      vehicle: {
        brand: "Chevrolet",
        model: "Onix",
        rent_cents: 70000,
        rent_period: "week",
      },
      platforms: [{ source: "uber", label: null, mode: "net_already" }],
      days: [
        {
          date: "2026-11-23",
          minutes: 510,
          km: 142,
          is_day_off: false,
          shifts: ["evening"],
          earnings: [
            { source: "uber", label: null, amount_cents: 21250, minutes: 300 },
          ],
          expenses: [
            {
              category: "fuel",
              amount_cents: 8500,
              liters: 14.2,
              odometer_km: 52340,
              full_tank: true,
            },
          ],
        },
        {
          date: "2026-11-20",
          minutes: null,
          km: null,
          is_day_off: true,
          shifts: null,
          earnings: [],
          expenses: [],
        },
      ],
      maintenance: [
        {
          name: "Troca de óleo",
          interval_km: 10000,
          last_done_km: 50000,
          last_done_date: null,
        },
      ],
      payments: [
        {
          provider_payment_id: "123",
          status: "approved",
          amount_cents: 1790,
          paid_at: "2026-11-24T10:00:00Z",
        },
      ],
      entitlements: [
        {
          plan: "premium",
          source: "purchase",
          granted_at: "2026-11-24T10:00:00Z",
          revoked_at: null,
        },
      ],
    });
    const byName = Object.fromEntries(files.map((f) => [f.name, f.content]));
    expect(Object.keys(byName)).toEqual([
      "LEIA-ME.txt",
      "perfil.csv",
      "carro.csv",
      "apps.csv",
      "dias.csv",
      "ganhos.csv",
      "gastos.csv",
      "manutencao.csv",
      "pagamentos.csv",
      "acesso.csv",
    ]);
    expect(byName["perfil.csv"]).toContain(
      "m@email.com;uber, 99;;;8000,00;;;sim;",
    );
    expect(byName["carro.csv"]).toContain("Chevrolet;Onix;;;700,00;week;");
    expect(byName["dias.csv"]!.split("\r\n").slice(1, 3)).toEqual([
      "2026-11-20;;;sim;;",
      "2026-11-23;8,5;142;não;evening;",
    ]);
    expect(byName["ganhos.csv"]).toContain("2026-11-23;uber;;212,50;5");
    expect(byName["gastos.csv"]).toContain(
      "2026-11-23;fuel;;85,00;14.2;52340;sim",
    );
    expect(byName["pagamentos.csv"]).toContain("123;approved;17,90;");
  });

  it("handles a brand-new account", () => {
    const files = buildExportFiles({
      email: null,
      profile: null,
      vehicle: null,
      platforms: [],
      days: [],
      maintenance: [],
      payments: [],
      entitlements: [],
    });
    expect(
      files.find((f) => f.name === "carro.csv")?.content.split("\r\n"),
    ).toHaveLength(2);
    expect(files.find((f) => f.name === "perfil.csv")?.content).toContain(
      "\r\n;;;;;;;;\r\n",
    );
  });
});
