import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KmDatabase, type LocalDay } from "../local/db";
import {
  countDirty,
  getLocalDay,
  getMeta,
  listLocalDays,
  saveLocalDay,
} from "../local/days";
import type { DayPayload, SyncResult } from "../schemas/day";
import { PUSH_BATCH, singleFlight, syncNow, type RemoteApi } from "./engine";
import { fromRemote, toPayload, type RemoteDayRow } from "./payload";

const USER = "u1";
let db: KmDatabase;
let seq = 0;
const newId = () =>
  `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

const day = (date: string, uberCents = 10000) => ({
  date,
  minutes: 480,
  km: 100,
  isDayOff: false,
  shifts: null,
  note: null,
  earnings: [
    {
      id: newId(),
      source: "uber" as const,
      label: null,
      amountCents: uberCents,
      minutes: null,
    },
  ],
  expenses: [],
});

/** A fake server holding rows like Postgres + save_day would. */
class FakeServer implements RemoteApi {
  rows = new Map<string, RemoteDayRow>(); // by date
  clock = 0;
  pushCalls = 0;
  failIds = new Set<string>();

  async push(days: DayPayload[]): Promise<SyncResult[]> {
    this.pushCalls += 1;
    return days.map((p) => {
      if (this.failIds.has(p.id))
        return { localId: p.id, ok: false, error: "boom" };
      const existing = this.rows.get(p.date);
      if (
        existing &&
        new Date(existing.client_updated_at) >= new Date(p.client_updated_at)
      ) {
        return {
          localId: p.id,
          ok: true,
          id: existing.id,
          applied: false,
          client_updated_at: existing.client_updated_at,
        };
      }
      const id = existing?.id ?? p.id;
      this.rows.set(p.date, {
        ...p,
        id,
        updated_at: this.tick(),
        expenses: p.expenses.map((x) => ({
          ...x,
          liters: x.liters == null ? null : String(x.liters),
        })),
      });
      return {
        localId: p.id,
        ok: true,
        id,
        applied: true,
        client_updated_at: p.client_updated_at,
      };
    });
  }

  async pull(since: string | null, limit: number) {
    return [...this.rows.values()]
      .filter((r) => since == null || r.updated_at > since)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      .slice(0, limit);
  }

  tick() {
    this.clock += 1;
    return `2026-11-23T12:00:${String(this.clock).padStart(2, "0")}.000000+00:00`;
  }
}

beforeEach(() => {
  db = new KmDatabase(`test-${Math.random()}`);
});
afterEach(async () => {
  await db.delete();
});

describe("local days", () => {
  it("saving the same date twice edits that day", async () => {
    const a = await saveLocalDay(db, USER, day("2026-11-23", 100), {
      newId,
      now: new Date("2026-11-23T20:00:00Z"),
    });
    const b = await saveLocalDay(db, USER, day("2026-11-23", 200), {
      newId,
      now: new Date("2026-11-23T21:00:00Z"),
    });
    expect(b.id).toBe(a.id);
    const stored = await getLocalDay(db, USER, "2026-11-23");
    expect(stored?.earnings[0]?.amountCents).toBe(200);
    expect(stored?.dirty).toBe(1);
    expect(await countDirty(db, USER)).toBe(1);
  });

  it("keeps users apart and lists by range", async () => {
    const opts = { newId, now: new Date() };
    await saveLocalDay(db, USER, day("2026-11-20"), opts);
    await saveLocalDay(db, USER, day("2026-11-23"), opts);
    await saveLocalDay(db, "other", day("2026-11-21"), opts);
    const list = await listLocalDays(db, USER, {
      start: "2026-11-21",
      end: "2026-11-30",
    });
    expect(list.map((d) => d.date)).toEqual(["2026-11-23"]);
    expect(await getLocalDay(db, USER, "2026-11-21")).toBeUndefined();
  });
});

describe("syncNow", () => {
  it("pushes dirty days and clears the flag", async () => {
    const server = new FakeServer();
    await saveLocalDay(db, USER, day("2026-11-23"), {
      newId,
      now: new Date("2026-11-23T20:00:00Z"),
    });
    const report = await syncNow(db, USER, server);
    expect(report).toEqual({ pushed: 1, failed: 0, pulled: 0 });
    expect(await countDirty(db, USER)).toBe(0);
    expect(server.rows.get("2026-11-23")?.earnings[0]?.amount_cents).toBe(
      10000,
    );

    // Nothing new: no more pushes.
    await syncNow(db, USER, server);
    expect(server.pushCalls).toBe(1);
  });

  it("keeps failed days dirty to retry later", async () => {
    const server = new FakeServer();
    const saved = await saveLocalDay(db, USER, day("2026-11-23"), {
      newId,
      now: new Date(),
    });
    server.failIds.add(saved.id);
    expect(await syncNow(db, USER, server)).toMatchObject({
      pushed: 0,
      failed: 1,
    });
    expect(await countDirty(db, USER)).toBe(1);
    server.failIds.clear();
    expect(await syncNow(db, USER, server)).toMatchObject({
      pushed: 1,
      failed: 0,
    });
  });

  it("does not lose an edit made while the push was in flight", async () => {
    const server = new FakeServer();
    await saveLocalDay(db, USER, day("2026-11-23", 100), {
      newId,
      now: new Date("2026-11-23T20:00:00Z"),
    });
    const slow: RemoteApi = {
      pull: (s, l) => server.pull(s, l),
      push: async (days) => {
        // The driver edits again before the server answers.
        await saveLocalDay(db, USER, day("2026-11-23", 999), {
          newId,
          now: new Date("2026-11-23T20:05:00Z"),
        });
        return server.push(days);
      },
    };
    await syncNow(db, USER, slow);
    expect(await countDirty(db, USER)).toBe(1);
    await syncNow(db, USER, server);
    expect(server.rows.get("2026-11-23")?.earnings[0]?.amount_cents).toBe(999);
    expect(await countDirty(db, USER)).toBe(0);
  });

  it("pulls days registered on another device", async () => {
    const server = new FakeServer();
    const otherPhone = new KmDatabase(`other-${Math.random()}`);
    await saveLocalDay(otherPhone, USER, day("2026-11-22", 5000), {
      newId,
      now: new Date("2026-11-22T20:00:00Z"),
    });
    await syncNow(otherPhone, USER, server);

    const report = await syncNow(db, USER, server);
    expect(report.pulled).toBe(1);
    const pulled = await getLocalDay(db, USER, "2026-11-22");
    expect(pulled).toMatchObject({ dirty: 0, userId: USER });
    expect(pulled?.earnings[0]?.amountCents).toBe(5000);
    expect(await getMeta(db, `pullCursor:${USER}`)).toBe(
      server.rows.get("2026-11-22")?.updated_at,
    );
    await otherPhone.delete();
  });

  it("adopts the server id when two phones registered the same date", async () => {
    const server = new FakeServer();
    const otherPhone = new KmDatabase(`other-${Math.random()}`);
    await saveLocalDay(otherPhone, USER, day("2026-11-23", 100), {
      newId,
      now: new Date("2026-11-23T19:00:00Z"),
    });
    await syncNow(otherPhone, USER, server);
    const serverId = server.rows.get("2026-11-23")!.id;

    // This phone, offline, registered the same date later (newer edit wins).
    const mine = await saveLocalDay(db, USER, day("2026-11-23", 300), {
      newId,
      now: new Date("2026-11-23T21:00:00Z"),
    });
    expect(mine.id).not.toBe(serverId);
    await syncNow(db, USER, server);
    const stored = await getLocalDay(db, USER, "2026-11-23");
    expect(stored?.id).toBe(serverId);
    expect(stored?.earnings[0]?.amountCents).toBe(300);
    expect(await db.days.count()).toBe(1);

    // The other phone pulls the newer edit and replaces its copy.
    await syncNow(otherPhone, USER, server);
    expect(
      (await getLocalDay(otherPhone, USER, "2026-11-23"))?.earnings[0]
        ?.amountCents,
    ).toBe(300);
    await otherPhone.delete();
  });

  it("never overwrites a local unsent edit with a pulled one", async () => {
    const server = new FakeServer();
    const otherPhone = new KmDatabase(`other-${Math.random()}`);
    await saveLocalDay(otherPhone, USER, day("2026-11-23", 100), {
      newId,
      now: new Date("2026-11-23T22:00:00Z"),
    });
    await syncNow(otherPhone, USER, server);
    await saveLocalDay(db, USER, day("2026-11-23", 300), {
      newId,
      now: new Date("2026-11-23T21:00:00Z"),
    });
    // Push is rejected as older; the pull then brings the newer server copy.
    await syncNow(db, USER, server);
    const stored = await getLocalDay(db, USER, "2026-11-23");
    expect(stored?.earnings[0]?.amountCents).toBe(100);
    expect(stored?.dirty).toBe(0);
    await otherPhone.delete();
  });

  it("pushes in batches and pulls in pages", async () => {
    const server = new FakeServer();
    for (let i = 1; i <= PUSH_BATCH + 5; i++) {
      await saveLocalDay(
        db,
        USER,
        day(`2026-10-${String(i).padStart(2, "0")}`),
        { newId, now: new Date() },
      );
    }
    const report = await syncNow(db, USER, server);
    expect(report.pushed).toBe(PUSH_BATCH + 5);
    expect(server.pushCalls).toBe(2);

    const fresh = new KmDatabase(`fresh-${Math.random()}`);
    const paged: RemoteApi = {
      push: (d) => server.push(d),
      pull: (s) => server.pull(s, 10),
    };
    // PULL_PAGE is large; simulate small pages by limiting the fake server.
    let pulled = 0;
    for (let i = 0; i < 5; i++)
      pulled += (await syncNow(fresh, USER, paged)).pulled;
    expect(pulled).toBe(PUSH_BATCH + 5);
    await fresh.delete();
  });
});

describe("payload conversion", () => {
  it("round-trips LocalDay ⇄ server row", async () => {
    const local: LocalDay = {
      ...day("2026-11-23"),
      id: newId(),
      userId: USER,
      clientUpdatedAt: "2026-11-23T20:00:00.000Z",
      dirty: 1,
      shifts: ["night"],
      expenses: [
        {
          id: newId(),
          category: "fuel",
          label: null,
          amountCents: 8500,
          liters: 14.2,
          odometerKm: 52340,
          fullTank: true,
        },
      ],
    };
    const p = toPayload(local);
    const row: RemoteDayRow = {
      ...p,
      client_updated_at: "2026-11-23T20:00:00+00:00",
      updated_at: "x",
      expenses: p.expenses.map((x) => ({ ...x, liters: "14.200" })),
    };
    expect(fromRemote(row, USER)).toEqual({ ...local, dirty: 0 });
    expect(
      fromRemote(
        {
          ...row,
          shifts: null,
          expenses: [{ ...row.expenses[0]!, liters: null }],
        },
        USER,
      ),
    ).toMatchObject({
      shifts: null,
      expenses: [{ liters: null }],
    });
  });
});

describe("singleFlight", () => {
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  };

  it("runs once when idle", async () => {
    let runs = 0;
    const run = singleFlight(async () => ++runs);
    expect(await run()).toBe(1);
    expect(await run()).toBe(2);
  });

  it("queues exactly one follow-up for calls made during a run", async () => {
    let runs = 0;
    const gates = [deferred(), deferred()];
    const run = singleFlight(async () => {
      const n = runs++;
      await gates[n]!.promise;
      return n;
    });
    const first = run();
    const second = run();
    const third = run();
    expect(second).toBe(third);
    gates[0]!.resolve();
    expect(await first).toBe(0);
    gates[1]!.resolve();
    expect(await second).toBe(1);
    expect(runs).toBe(2);
  });

  it("still runs the follow-up when the current run fails", async () => {
    let runs = 0;
    const run = singleFlight(async () => {
      runs += 1;
      if (runs === 1) {
        await new Promise((r) => setTimeout(r, 5));
        throw new Error("offline");
      }
      return runs;
    });
    const first = run();
    const second = run();
    await expect(first).rejects.toThrow("offline");
    expect(await second).toBe(2);
  });
});
